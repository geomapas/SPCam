import type { Feature, FeatureCollection } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CAPAS_TEMATICAS,
  MAPAS_BASE,
  colorRelleno,
  type CapaProyecto,
  type EstadoCapas,
  type Fuente,
  type GestorCapas,
  type GestorProyecto,
} from '@/domain/capas';
import { LIMITE_PINES_ICONO, OPACIDAD_RELLENO, UMBRAL_PINS_ZOOM } from '@/config';
import { porTramos } from '@/domain/tracks/geo';
import type { TrackPoint } from '@/domain/types';
import { mostrarAviso } from './aviso';

function crearCapaLeaflet(f: Fuente, zIndex: number): L.TileLayer {
  if (f.tipo === 'xyz') {
    return L.tileLayer(f.url, {
      maxZoom: f.maxZoom,
      maxNativeZoom: f.maxNativeZoom,
      attribution: f.atribucion,
      zIndex,
    });
  }
  return L.tileLayer.wms(f.url, {
    layers: f.capas,
    format: f.formato,
    transparent: f.transparente,
    version: f.version,
    uppercase: f.mayusculas,
    crs: L.CRS.EPSG3857,
    maxZoom: f.maxZoom,
    maxNativeZoom: f.maxNativeZoom,
    attribution: f.atribucion,
    zIndex,
    ...(f.minZoom !== undefined ? { minZoom: f.minZoom } : {}),
    ...(f.claseCss ? { className: f.claseCss } : {}),
  });
}

const esPunto = (f?: Feature) => f?.geometry?.type === 'Point' || f?.geometry?.type === 'MultiPoint';

/** Estilo de una capa del proyecto: borde y relleno propios (relleno suave en polígonos) y círculo blanco en puntos. */
const estiloCapa = (color: string, relleno: string) => (f?: Feature): L.PathOptions & { radius?: number } =>
  esPunto(f)
    ? { radius: 6, color: '#ffffff', weight: 1.5, fillColor: relleno, fillOpacity: 0.9 }
    : { color, weight: 2, opacity: 0.95, fillColor: relleno, fillOpacity: OPACIDAD_RELLENO };

/** Chincheta de GEOmapas (misma forma), con el color de la capa. */
const iconoPin = (color: string) =>
  L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.925 0 0 4.925 0 11c0 7.333 11 19 11 19s11-11.667 11-19C22 4.925 17.075 0 11 0z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="11" cy="11" r="4.5" fill="white" opacity="0.85"/></svg>`,
    className: '',
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -30],
  });

/** Punto donde se coloca el pin de un elemento: centro del polígono, medio de la línea o el propio punto. */
function centroide(f: Feature): L.LatLngTuple | null {
  const g = f.geometry;
  if (!g) return null;
  const media = (pts: number[][]): L.LatLngTuple | null =>
    pts.length ? [pts.reduce((s, p) => s + p[1]!, 0) / pts.length, pts.reduce((s, p) => s + p[0]!, 0) / pts.length] : null;
  const centroAnillo = (anillo: number[][]): L.LatLngTuple | null => {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < anillo.length - 1; i++) {
      const [x0, y0] = anillo[i]!, [x1, y1] = anillo[i + 1]!;
      const k = x0! * y1! - x1! * y0!;
      a += k;
      cx += (x0! + x1!) * k;
      cy += (y0! + y1!) * k;
    }
    return Math.abs(a) < 1e-14 ? media(anillo) : [cy / (3 * a), cx / (3 * a)];
  };
  switch (g.type) {
    case 'Point': return [g.coordinates[1]!, g.coordinates[0]!];
    case 'MultiPoint': return media(g.coordinates);
    case 'LineString': return media([g.coordinates[Math.floor(g.coordinates.length / 2)]!]);
    case 'MultiLineString': return media(g.coordinates.flat());
    case 'Polygon': return centroAnillo(g.coordinates[0]!);
    case 'MultiPolygon': {
      // el polígono con más vértices en su anillo exterior
      const mayor = [...g.coordinates].sort((p, q) => q[0]!.length - p[0]!.length)[0]!;
      return centroAnillo(mayor[0]!);
    }
    default: return null;
  }
}

/** Ventana con los atributos del elemento tocado (sin los campos internos __*). */
function contenidoPopup(nombreCapa: string, props: Record<string, unknown> | null | undefined): HTMLElement {
  const div = document.createElement('div');
  div.className = 'popup-attr';
  const t = document.createElement('div');
  t.className = 'popup-attr-titulo';
  t.textContent = nombreCapa;
  div.append(t);
  const filas = Object.entries(props ?? {}).filter(([k]) => !k.startsWith('__')).slice(0, 40);
  if (filas.length === 0) {
    const v = document.createElement('div');
    v.textContent = 'Sin atributos';
    div.append(v);
    return div;
  }
  const tabla = document.createElement('table');
  for (const [k, v] of filas) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = k;
    const td = document.createElement('td');
    td.textContent = v === null || v === undefined ? '' : String(v);
    tr.append(th, td);
    tabla.append(tr);
  }
  div.append(tabla);
  return div;
}

export interface MapaApp {
  map: L.Map;
  /** Sincroniza el mapa con el gestor de capas (mapa base + capas precargadas). */
  conectar(gestor: GestorCapas): void;
  /** Dibuja las capas del proyecto (archivos cargados) y las mantiene al día. */
  conectarProyecto(proyecto: GestorProyecto): void;
  /** Encuadra el mapa en una capa del proyecto. */
  zoomACapa(id: string): Promise<void>;
}

interface EntradaProyecto {
  /** Geometrías (se ven de cerca) */
  vector: L.GeoJSON | null;
  /** Pinpoints (se ven de lejos) */
  pines: L.FeatureGroup | null;
  color: string;
  relleno: string;
  cargando: boolean;
}

/**
 * Mapa Leaflet. Las capas se crean al activarlas por primera vez (no se piden teselas ni se leen datos de lo que no se ve).
 * Orden de dibujo: mapa base < capas precargadas < capas del proyecto < recorrido.
 */
export function crearMapa(contenedor: HTMLElement): MapaApp {
  const map = L.map(contenedor, { zoomControl: false, maxZoom: 21 }).setView([39.5, -3.0], 8);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // ── mapa base y capas precargadas ──
  const cache = new Map<string, L.TileLayer>();
  let baseActual: string | null = null;

  const obtener = (clave: string, f: Fuente, z: number): L.TileLayer => {
    let l = cache.get(clave);
    if (!l) {
      l = crearCapaLeaflet(f, z);
      cache.set(clave, l);
    }
    return l;
  };

  const aplicar = (e: EstadoCapas): void => {
    if (e.base !== baseActual) {
      if (baseActual) cache.get(`base:${baseActual}`)?.remove();
      const def = MAPAS_BASE.find((m) => m.id === e.base);
      if (def) obtener(`base:${def.id}`, def.fuente, 1).addTo(map);
      baseActual = def ? def.id : null;
    }
    CAPAS_TEMATICAS.forEach((c, i) => {
      const activa = e.enMapa.includes(c.id);
      const capa = activa ? obtener(`capa:${c.id}`, c.fuente, 10 + i) : cache.get(`capa:${c.id}`);
      if (!capa) return;
      if (activa && !map.hasLayer(capa)) capa.addTo(map);
      if (!activa && map.hasLayer(capa)) capa.remove();
    });
  };

  // ── capas del proyecto ──
  // Un único lienzo (canvas) compartido: con miles de recintos, un <path> por geometría satura el navegador.
  const lienzo = L.canvas({ padding: 0.5 });
  const entradas = new Map<string, EntradaProyecto>();
  let proyecto: GestorProyecto | null = null;

  const alTocar = (nombre: string) => (ev: L.LeafletMouseEvent & { layer?: L.Layer }) => {
    const feature = (ev.layer as (L.Layer & { feature?: Feature }) | undefined)?.feature;
    if (!feature) return;
    L.popup({ maxWidth: 320 }).setLatLng(ev.latlng).setContent(contenidoPopup(nombre, feature.properties)).openOn(map);
  };

  const crearVector = (datos: FeatureCollection, c: CapaProyecto): L.GeoJSON => {
    // Leaflet pasa estas opciones a cada geometría; los tipos no declaran `renderer` aquí, de ahí el cast.
    const opciones = {
      renderer: lienzo,
      style: estiloCapa(c.color, colorRelleno(c)),
      pointToLayer: (_f: Feature, ll: L.LatLng) => L.circleMarker(ll, { renderer: lienzo, radius: 6 }),
    } as L.GeoJSONOptions;
    const capa = L.geoJSON(datos, opciones);
    capa.on('click', alTocar(c.nombre)); // un solo manejador para toda la capa
    return capa;
  };

  /** Pinpoints de GEOmapas: una chincheta por elemento. En capas enormes, puntos sueltos (mucho más ligeros). */
  const crearPines = (datos: FeatureCollection, c: CapaProyecto): L.FeatureGroup => {
    const grupo = L.featureGroup();
    const conIcono = datos.features.length <= LIMITE_PINES_ICONO;
    for (const f of datos.features) {
      const ll = centroide(f);
      if (!ll) continue;
      const m: L.Marker | L.CircleMarker = conIcono
        ? L.marker(ll, { icon: iconoPin(c.color) })
        : L.circleMarker(ll, { renderer: lienzo, radius: 6, color: '#fff', weight: 1.5, fillColor: c.color, fillOpacity: 0.9 });
      (m as unknown as { feature: Feature }).feature = f;
      grupo.addLayer(m);
    }
    grupo.on('click', alTocar(c.nombre));
    return grupo;
  };

  const restilar = (e: EntradaProyecto, c: CapaProyecto): void => {
    const relleno = colorRelleno(c);
    if (e.color === c.color && e.relleno === relleno) return;
    e.color = c.color;
    e.relleno = relleno;
    e.vector?.setStyle(estiloCapa(c.color, relleno));
    e.pines?.eachLayer((m) => {
      if (m instanceof L.Marker) m.setIcon(iconoPin(c.color));
      else if (m instanceof L.CircleMarker) m.setStyle({ fillColor: c.color });
    });
  };

  const quitarDelMapa = (e: EntradaProyecto): void => {
    e.vector?.remove();
    e.pines?.remove();
  };

  const reconciliar = (): void => {
    if (!proyecto) return;
    const g = proyecto;
    const lista = g.capasEnPanel;
    const ids = new Set(lista.map((c) => c.id));
    for (const [id, e] of entradas) {
      if (!ids.has(id)) {
        quitarDelMapa(e);
        entradas.delete(id); // quitada del panel o eliminada: se libera de memoria
      }
    }
    // De lejos, pinpoints; de cerca, geometrías (igual que GEOmapas)
    const deLejos = map.getZoom() < UMBRAL_PINS_ZOOM;
    for (const c of lista) {
      let e = entradas.get(c.id);
      if (!e) {
        e = { vector: null, pines: null, color: c.color, relleno: colorRelleno(c), cargando: false };
        entradas.set(c.id, e);
      }
      restilar(e, c);
      if (!c.visible) {
        quitarDelMapa(e);
        continue;
      }
      if (!e.vector || !e.pines) {
        if (e.cargando) continue;
        e.cargando = true;
        const entrada = e;
        void g
          .datos(c.id)
          .then((datos) => {
            entrada.cargando = false;
            const actual = g.capasEnPanel.find((x) => x.id === c.id);
            if (!datos || !actual || entradas.get(c.id) !== entrada) return;
            entrada.vector = crearVector(datos, actual);
            entrada.pines = crearPines(datos, actual);
            entrada.color = actual.color;
            entrada.relleno = colorRelleno(actual);
            reconciliar();
          })
          .catch((err) => {
            entrada.cargando = false;
            console.warn('No se pudo leer la capa', err);
            mostrarAviso(`No se pudo cargar la capa «${c.nombre}»`, 'error');
          });
        continue;
      }
      const ver = deLejos ? e.pines : e.vector;
      const ocultar = deLejos ? e.vector : e.pines;
      if (!map.hasLayer(ver)) ver.addTo(map);
      if (map.hasLayer(ocultar)) ocultar.remove();
    }
  };

  return {
    map,
    conectar(gestor) {
      aplicar(gestor.estado);
      gestor.suscribir(aplicar);
    },
    conectarProyecto(g) {
      proyecto = g;
      reconciliar();
      g.suscribir(reconciliar);
      map.on('zoomend', reconciliar);
    },
    async zoomACapa(id) {
      let b = entradas.get(id)?.vector?.getBounds();
      if (!b && proyecto) {
        const datos = await proyecto.datos(id);
        if (datos) b = L.geoJSON(datos).getBounds();
      }
      if (b?.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 19 });
    },
  };
}

/** Recorrido dibujado sobre el mapa. Va en su propia capa (pane) para quedar siempre por encima de las capas del proyecto. */
export class Traza {
  private linea: L.Polyline;
  private posicion: L.CircleMarker;
  private tramos: L.LatLngTuple[][] = [];
  private segActual: number | null = null;

  constructor(private readonly mapa: L.Map, color = '#d93025') {
    if (!mapa.getPane('trazas')) mapa.createPane('trazas').style.zIndex = '450';
    this.linea = L.polyline([], { color, weight: 4, pane: 'trazas' }).addTo(mapa);
    this.posicion = L.circleMarker([0, 0], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
      pane: 'trazas',
    });
  }

  limpiar(): void {
    this.tramos = [];
    this.segActual = null;
    this.linea.setLatLngs([]);
    this.posicion.remove();
  }

  /** Añade un punto en directo. Si cambia de tramo (tras una pausa), empieza una línea nueva. */
  anadir(p: TrackPoint, seguir = true): void {
    const ll: L.LatLngTuple = [p.lat, p.lon];
    const seg = p.seg ?? 0;
    if (this.tramos.length === 0 || seg !== this.segActual) {
      this.tramos.push([]);
      this.segActual = seg;
    }
    this.tramos[this.tramos.length - 1]!.push(ll);
    this.linea.setLatLngs(this.tramos);
    this.posicion.setLatLng(ll).addTo(this.mapa);
    if (seguir) this.mapa.panTo(ll, { animate: false });
  }

  /** Dibuja un recorrido ya terminado y encuadra el mapa en él. */
  dibujar(puntos: TrackPoint[]): void {
    this.limpiar();
    this.tramos = porTramos(puntos).map((t) => t.map((p) => [p.lat, p.lon] as L.LatLngTuple));
    this.linea.setLatLngs(this.tramos);
    const b = this.linea.getBounds();
    if (b.isValid()) this.mapa.fitBounds(b, { padding: [30, 30] });
  }
}

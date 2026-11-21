import type { Feature, FeatureCollection } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CAPAS_TEMATICAS,
  MAPAS_BASE,
  type EstadoCapas,
  type Fuente,
  type GestorCapas,
  type GestorProyecto,
} from '@/domain/capas';
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

/** Estilo de una capa del proyecto: relleno suave en polígonos, trazo en líneas, círculo blanco en puntos. */
const estiloCapa = (color: string) => (f?: Feature): L.PathOptions & { radius?: number } =>
  esPunto(f)
    ? { radius: 6, color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 0.9 }
    : { color, weight: 2, opacity: 0.95, fillColor: color, fillOpacity: 0.25 };

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
  layer: L.GeoJSON | null;
  color: string;
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

  const crearGeoJson = (datos: FeatureCollection, color: string, nombre: string): L.GeoJSON => {
    // Leaflet pasa estas opciones a cada geometría; los tipos no declaran `renderer` aquí, de ahí el cast.
    const opciones = {
      renderer: lienzo,
      style: estiloCapa(color),
      pointToLayer: (_f: Feature, ll: L.LatLng) => L.circleMarker(ll, { renderer: lienzo, radius: 6 }),
    } as L.GeoJSONOptions;
    const capa = L.geoJSON(datos, opciones);
    // Un solo manejador de clic para toda la capa (no uno por geometría).
    capa.on('click', (ev: L.LeafletMouseEvent & { layer?: L.Layer }) => {
      const feature = (ev.layer as (L.Layer & { feature?: Feature }) | undefined)?.feature;
      if (!feature) return;
      L.popup({ maxWidth: 320 })
        .setLatLng(ev.latlng)
        .setContent(contenidoPopup(nombre, feature.properties))
        .openOn(map);
    });
    return capa;
  };

  const reconciliar = (): void => {
    if (!proyecto) return;
    const g = proyecto;
    const lista = g.capas;
    const ids = new Set(lista.map((c) => c.id));
    for (const [id, e] of entradas) {
      if (!ids.has(id)) {
        e.layer?.remove();
        entradas.delete(id);
      }
    }
    for (const c of lista) {
      let e = entradas.get(c.id);
      if (!e) {
        e = { layer: null, color: c.color, cargando: false };
        entradas.set(c.id, e);
      }
      if (e.layer && e.color !== c.color) {
        e.color = c.color;
        e.layer.setStyle(estiloCapa(c.color));
      }
      if (c.visible) {
        if (!e.layer) {
          if (e.cargando) continue;
          e.cargando = true;
          const entrada = e;
          void g
            .datos(c.id)
            .then((datos) => {
              entrada.cargando = false;
              const actual = g.capas.find((x) => x.id === c.id);
              if (!datos || !actual || entradas.get(c.id) !== entrada) return;
              entrada.layer = crearGeoJson(datos, actual.color, actual.nombre);
              entrada.color = actual.color;
              reconciliar();
            })
            .catch((err) => {
              entrada.cargando = false;
              console.warn('No se pudo leer la capa', err);
              mostrarAviso(`No se pudo cargar la capa «${c.nombre}»`, 'error');
            });
        } else if (!map.hasLayer(e.layer)) {
          e.layer.addTo(map);
        }
      } else if (e.layer && map.hasLayer(e.layer)) {
        e.layer.remove();
      }
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
    },
    async zoomACapa(id) {
      let b = entradas.get(id)?.layer?.getBounds();
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

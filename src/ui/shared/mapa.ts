import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAPAS_TEMATICAS, MAPAS_BASE, type Fuente, type EstadoCapas, type GestorCapas } from '@/domain/capas';
import { porTramos } from '@/domain/tracks/geo';
import type { TrackPoint } from '@/domain/types';

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

export interface MapaApp {
  map: L.Map;
  /** Sincroniza el mapa con el gestor de capas (mapa base + capas temáticas). */
  conectar(gestor: GestorCapas): void;
}

/**
 * Mapa Leaflet. Las capas se crean al activarlas por primera vez (no se piden teselas de lo que no se ve).
 * Las capas temáticas siempre quedan por encima del mapa base.
 */
export function crearMapa(contenedor: HTMLElement): MapaApp {
  const map = L.map(contenedor, { zoomControl: false, maxZoom: 21 }).setView([39.5, -3.0], 8);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

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
      const activa = e.activas.includes(c.id);
      const capa = activa ? obtener(`capa:${c.id}`, c.fuente, 10 + i) : cache.get(`capa:${c.id}`);
      if (!capa) return;
      if (activa && !map.hasLayer(capa)) capa.addTo(map);
      if (!activa && map.hasLayer(capa)) capa.remove();
    });
  };

  return {
    map,
    conectar(gestor) {
      aplicar(gestor.estado);
      gestor.suscribir(aplicar);
    },
  };
}

export class Traza {
  private linea: L.Polyline;
  private posicion: L.CircleMarker;
  private tramos: L.LatLngTuple[][] = [];
  private segActual: number | null = null;

  constructor(private readonly mapa: L.Map, color = '#d93025') {
    this.linea = L.polyline([], { color, weight: 4 }).addTo(mapa);
    this.posicion = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 });
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

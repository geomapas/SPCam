import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackPoint } from '@/domain/types';

/**
 * Mapa base de PRUEBA con OpenStreetMap (requiere red).
 * Las ortofotos offline (PNOA / Junta de CLM) llegan en el paso 6 del plan,
 * con una capa propia que busque primero en local.
 */
export function crearMapa(contenedor: HTMLElement): L.Map {
  const mapa = L.map(contenedor, { zoomControl: true }).setView([39.5, -3.0], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(mapa);
  return mapa;
}

export class Traza {
  private linea: L.Polyline;
  private posicion: L.CircleMarker;

  constructor(private readonly mapa: L.Map, color = '#d32f2f') {
    this.linea = L.polyline([], { color, weight: 4 }).addTo(mapa);
    this.posicion = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 });
  }

  limpiar(): void {
    this.linea.setLatLngs([]);
    this.posicion.remove();
  }

  anadir(p: TrackPoint, seguir = true): void {
    const ll: L.LatLngTuple = [p.lat, p.lon];
    this.linea.addLatLng(ll);
    this.posicion.setLatLng(ll).addTo(this.mapa);
    if (seguir) this.mapa.panTo(ll, { animate: false });
  }

  dibujar(puntos: TrackPoint[]): void {
    this.linea.setLatLngs(puntos.map((p) => [p.lat, p.lon] as L.LatLngTuple));
    this.posicion.remove();
    const b = this.linea.getBounds();
    if (b.isValid()) this.mapa.fitBounds(b, { padding: [30, 30] });
  }
}

import type { TrackPoint } from '@/domain/types';
import { porTramos } from './geo';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const punto = (p: TrackPoint) => {
  const ele = p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : '';
  return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${ele}<time>${new Date(p.t).toISOString()}</time></trkpt>`;
};

/** GPX con un <trkseg> por tramo: las pausas quedan como cortes, no como líneas rectas. */
export function aGpx(puntos: TrackPoint[], nombre: string): string {
  const tramos = porTramos(puntos)
    .map((t) => `    <trkseg>\n${t.map(punto).join('\n')}\n    </trkseg>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SPCam" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(nombre)}</name>
${tramos}
  </trk>
</gpx>
`;
}

/** Lee el archivo incremental (un punto JSON por línea). Ignora una última línea cortada. */
export function leerJsonl(texto: string): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue;
    try {
      const p = JSON.parse(linea) as TrackPoint;
      if (Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.t)) out.push(p);
    } catch {
      /* línea incompleta por un cierre brusco: se descarta */
    }
  }
  return out;
}

/** Lee un GPX (para la web del gestor). Cada <trkseg> pasa a ser un tramo. */
export function leerGpx(xml: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('GPX no válido');
  const out: TrackPoint[] = [];
  const leer = (el: Element, seg: number) => {
    const lat = Number(el.getAttribute('lat'));
    const lon = Number(el.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const time = el.querySelector('time')?.textContent;
    const ele = el.querySelector('ele')?.textContent;
    out.push({ lat, lon, t: time ? Date.parse(time) : 0, acc: null, alt: ele ? Number(ele) : null, speed: null, seg });
  };
  const segs = doc.querySelectorAll('trkseg');
  if (segs.length > 0) segs.forEach((s, i) => s.querySelectorAll('trkpt').forEach((el) => leer(el, i)));
  else doc.querySelectorAll('trkpt').forEach((el) => leer(el, 0));
  return out;
}

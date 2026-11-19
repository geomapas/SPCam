import '@/ui/shared/estilos.css';
import { leerGpx } from '@/domain/tracks/gpx';
import { longitudM } from '@/domain/tracks/geo';
import { crearMapa, Traza } from '@/ui/shared/mapa';

const mapa = crearMapa(document.getElementById('mapa')!);
const traza = new Traza(mapa);
const estado = document.getElementById('estado')!;

document.getElementById('archivo')!.addEventListener('change', async (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const puntos = leerGpx(await f.text());
    traza.dibujar(puntos);
    estado.textContent = `${f.name}: ${puntos.length} puntos, ${(longitudM(puntos) / 1000).toFixed(2)} km`;
  } catch (e) {
    estado.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
});

import { miUbicacion } from '@/domain/ubicacion';
import { mostrarAviso } from './aviso';
import type { MapaApp } from './mapa';

/** «Localizarme»: lee la posición actual, centra el mapa en ella y la marca. */
export function montarBotonUbicacion(opts: { boton: HTMLButtonElement; app: MapaApp }): void {
  const { boton, app } = opts;
  let ocupado = false;
  boton.addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    boton.classList.add('cargando'); // color de acento mientras espera el GPS
    boton.setAttribute('aria-busy', 'true');
    try {
      app.mostrarPosicion(await miUbicacion());
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      ocupado = false;
      boton.classList.remove('cargando');
      boton.removeAttribute('aria-busy');
    }
  });
}

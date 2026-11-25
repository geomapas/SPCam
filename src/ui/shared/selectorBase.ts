import { MAPAS_BASE, type GestorCapas } from '@/domain/capas';
import { puede } from '@/domain/permisos';

/**
 * Selector de mapa base flotante (abajo a la derecha), como el de GEOmapas: «Orto | Mapa».
 * Va dentro del contenedor del mapa.
 */
export function montarSelectorBase(opts: { gestor: GestorCapas; contenedor: HTMLElement }): void {
  const { gestor, contenedor } = opts;
  if (!puede('cambiar_mapa_base')) return;

  const caja = document.createElement('div');
  caja.className = 'selector-base glass-card';
  caja.setAttribute('role', 'radiogroup');
  caja.setAttribute('aria-label', 'Mapa base');

  const botones = new Map<string, HTMLButtonElement>();
  for (const m of MAPAS_BASE) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bm-btn';
    b.setAttribute('role', 'radio');
    b.title = m.nombre;
    b.textContent = m.etiqueta;
    b.addEventListener('click', () => gestor.cambiarBase(m.id));
    botones.set(m.id, b);
    caja.append(b);
  }

  const pintar = (base: string): void =>
    botones.forEach((b, id) => b.setAttribute('aria-checked', String(id === base)));
  pintar(gestor.estado.base);
  gestor.suscribir((e) => pintar(e.base));
  contenedor.append(caja);
}

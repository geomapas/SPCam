import { MAPAS_BASE, type GestorCapas } from '@/domain/capas';
import { puede } from '@/domain/permisos';
import { iconoRaster } from './iconos';

/**
 * Selector de mapa base como el de GEOmapas en el móvil: una píldora abajo a la derecha con la selección actual
 * (icono + «Orto» o «Mapa»). Al tocarla se despliegan las opciones y al elegir una se cierra.
 */
export function montarSelectorBase(opts: { gestor: GestorCapas; contenedor: HTMLElement }): void {
  const { gestor, contenedor } = opts;
  if (!puede('cambiar_mapa_base')) return;

  const caja = document.createElement('div');
  caja.className = 'selector-base';

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'sb-boton';
  boton.setAttribute('aria-haspopup', 'listbox');
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-label', 'Mapa base');
  boton.innerHTML = iconoRaster(16);
  const etiqueta = document.createElement('span');
  boton.append(etiqueta);

  const lista = document.createElement('div');
  lista.className = 'sb-panel';
  lista.setAttribute('role', 'listbox');
  lista.hidden = true;

  const opciones = new Map<string, HTMLButtonElement>();
  for (const m of MAPAS_BASE) {
    const o = document.createElement('button');
    o.type = 'button';
    o.className = 'sb-opcion';
    o.setAttribute('role', 'option');
    o.textContent = m.etiqueta;
    o.title = m.nombre;
    o.addEventListener('click', () => {
      gestor.cambiarBase(m.id);
      abrir(false);
    });
    opciones.set(m.id, o);
    lista.append(o);
  }

  function abrir(si: boolean): void {
    lista.hidden = !si;
    boton.classList.toggle('active', si);
    boton.setAttribute('aria-expanded', String(si));
  }
  boton.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrir(lista.hidden);
  });
  // Tocar fuera o pulsar Escape lo cierra
  document.addEventListener('click', (ev) => {
    if (!lista.hidden && !caja.contains(ev.target as Node)) abrir(false);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !lista.hidden) abrir(false);
  });

  const pintar = (base: string): void => {
    etiqueta.textContent = MAPAS_BASE.find((m) => m.id === base)?.etiqueta ?? '';
    opciones.forEach((o, id) => {
      o.classList.toggle('active', id === base);
      o.setAttribute('aria-selected', String(id === base));
    });
  };
  pintar(gestor.estado.base);
  gestor.suscribir((e) => pintar(e.base));

  caja.append(lista, boton);
  contenedor.append(caja);
}

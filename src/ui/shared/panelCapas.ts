import { CAPAS_TEMATICAS, MAPAS_BASE, type EstadoCapas, type GestorCapas } from '@/domain/capas';
import { puede } from '@/domain/permisos';
import { iconoCapas, iconoCerrar, iconoMapa, iconoSatelite } from './iconos';

const ICONOS = { satelite: iconoSatelite, mapa: iconoMapa } as const;

/**
 * Panel "Cartografía y capas": selector de mapa base (botones) y capas temáticas (interruptores).
 * Se abre con el botón de la cabecera y se dibuja dentro del contenedor del mapa.
 */
export function montarPanelCapas(opts: {
  gestor: GestorCapas;
  boton: HTMLButtonElement;
  contenedor: HTMLElement;
}): void {
  const { gestor, boton, contenedor } = opts;
  const verBase = puede('cambiar_mapa_base');
  const verCapas = puede('ver_capas_tematicas');
  if (!verBase && !verCapas) return;

  const panel = document.createElement('section');
  panel.className = 'panel-capas glass-card';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Cartografía y capas');

  const cab = document.createElement('div');
  cab.className = 'pc-cab';
  cab.innerHTML = `<span class="pc-titulo">${iconoCapas(14)}<span>Cartografía y capas</span></span>`;
  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'pc-cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar');
  cerrar.innerHTML = iconoCerrar(16);
  cab.append(cerrar);
  panel.append(cab);

  const cuerpo = document.createElement('div');
  cuerpo.className = 'pc-cuerpo';
  panel.append(cuerpo);

  // ── Mapa base ──
  const botonesBase = new Map<string, HTMLButtonElement>();
  if (verBase) {
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    sec.innerHTML = `<div class="pc-label">Mapa base</div>`;
    const grupo = document.createElement('div');
    grupo.className = 'segmentado';
    grupo.setAttribute('role', 'radiogroup');
    grupo.setAttribute('aria-label', 'Mapa base');
    for (const m of MAPAS_BASE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.setAttribute('role', 'radio');
      b.innerHTML = ICONOS[m.icono](16);
      const t = document.createElement('span');
      t.textContent = m.nombre;
      b.append(t);
      b.addEventListener('click', () => gestor.cambiarBase(m.id));
      botonesBase.set(m.id, b);
      grupo.append(b);
    }
    sec.append(grupo);
    cuerpo.append(sec);
  }

  // ── Capas temáticas ──
  const interruptores = new Map<string, HTMLInputElement>();
  if (verCapas) {
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    sec.innerHTML = `<div class="pc-label">Capas temáticas</div>`;
    for (const c of CAPAS_TEMATICAS) {
      const fila = document.createElement('label');
      fila.className = 'capa-row';
      const color = document.createElement('span');
      color.className = 'capa-color';
      color.style.background = c.color;
      const textos = document.createElement('span');
      textos.className = 'capa-textos';
      const nombre = document.createElement('span');
      nombre.className = 'capa-nombre';
      nombre.textContent = c.nombre;
      const sub = document.createElement('span');
      sub.className = 'capa-sub';
      sub.textContent = c.descripcion;
      textos.append(nombre, sub);
      const sw = document.createElement('span');
      sw.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('aria-label', c.nombre);
      input.addEventListener('change', () => gestor.alternarCapa(c.id, input.checked));
      const pista = document.createElement('span');
      pista.className = 'switch-pista';
      sw.append(input, pista);
      fila.append(color, textos, sw);
      interruptores.set(c.id, input);
      sec.append(fila);
    }
    cuerpo.append(sec);
  }

  const pintar = (e: EstadoCapas): void => {
    botonesBase.forEach((b, id) => b.setAttribute('aria-checked', String(id === e.base)));
    interruptores.forEach((i, id) => (i.checked = e.activas.includes(id)));
  };
  pintar(gestor.estado);
  gestor.suscribir(pintar);

  const abrir = (abierto: boolean): void => {
    panel.hidden = !abierto;
    boton.classList.toggle('active', abierto);
    boton.setAttribute('aria-expanded', String(abierto));
  };
  boton.addEventListener('click', () => abrir(panel.hidden));
  cerrar.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !panel.hidden) abrir(false);
  });

  contenedor.append(panel);
}

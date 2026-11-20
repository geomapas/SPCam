import { CAPAS_TEMATICAS, MAPAS_BASE, type EstadoCapas, type GestorCapas } from '@/domain/capas';
import { puede } from '@/domain/permisos';
import { iconoCapas, iconoMapa, iconoSatelite } from './iconos';
import { crearPanelFlotante } from './panelFlotante';

const ICONOS = { satelite: iconoSatelite, mapa: iconoMapa } as const;

/**
 * Panel "Cartografía y capas": selector de mapa base (botones) y capas temáticas (interruptores).
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

  const { cuerpo } = crearPanelFlotante({
    titulo: 'Cartografía y capas',
    icono: iconoCapas(14),
    boton,
    contenedor,
  });

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
}

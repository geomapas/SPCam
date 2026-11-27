import { iconoCerrar } from './iconos';

/** Algo que se abre y se cierra encima del mapa: un popover o una hoja inferior. */
export interface Superficie {
  readonly abierta: boolean;
  abrir(): void;
  cerrar(): void;
  alternar(): void;
}

const todas = new Set<Superficie>();
const cerrarOtras = (yo: Superficie) => todas.forEach((s) => s !== yo && s.cerrar());

/** Teclado: Escape cierra lo que esté abierto. Se registra una sola vez. */
let escapeRegistrado = false;
function registrarEscape(): void {
  if (escapeRegistrado) return;
  escapeRegistrado = true;
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') todas.forEach((s) => s.cerrar());
  });
}

/**
 * Popover: menú flotante anclado a la cabecera (zona «cabecera») o al dock inferior (zona «dock»).
 * Solo hay una superficie abierta a la vez. Se cierra al tocar fuera, con Escape o al pulsar de nuevo el botón.
 */
export function crearPopover(opts: {
  boton: HTMLElement;
  zona: 'cabecera' | 'dock';
  alinear?: 'inicio' | 'fin' | 'centro';
  etiqueta: string;
  contenido: HTMLElement;
  /** Clase extra para fijar el ancho de la tarjeta */
  ancho?: string;
  alAbrir?: () => void;
}): Superficie & { tarjeta: HTMLElement } {
  const { boton, zona, alinear = 'fin', etiqueta, contenido, ancho, alAbrir } = opts;
  const raiz = document.createElement('div');
  raiz.className = `popover popover-${zona}`;
  raiz.dataset.alinear = alinear;
  raiz.hidden = true;
  const fila = document.createElement('div');
  fila.className = 'popover-fila';
  const tarjeta = document.createElement('div');
  tarjeta.className = `tarjeta-popover vidrio${ancho ? ' ' + ancho : ''}`;
  tarjeta.setAttribute('role', 'dialog');
  tarjeta.setAttribute('aria-label', etiqueta);
  tarjeta.append(contenido);
  fila.append(tarjeta);
  raiz.append(fila);
  document.body.append(raiz);
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.setAttribute('aria-expanded', 'false');

  const api: Superficie & { tarjeta: HTMLElement } = {
    tarjeta,
    get abierta() {
      return !raiz.hidden;
    },
    abrir() {
      cerrarOtras(api);
      raiz.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
      alAbrir?.();
    },
    cerrar() {
      raiz.hidden = true;
      boton.setAttribute('aria-expanded', 'false');
    },
    alternar() {
      if (raiz.hidden) api.abrir();
      else api.cerrar();
    },
  };
  boton.addEventListener('click', () => api.alternar());
  document.addEventListener('click', (ev) => {
    const t = ev.target as Node;
    if (!raiz.hidden && !tarjeta.contains(t) && !boton.contains(t)) api.cerrar();
  });
  todas.add(api);
  registrarEscape();
  return api;
}

/**
 * Hoja inferior (bottom sheet): sube desde abajo con un tirador; se cierra arrastrándola hacia abajo,
 * tocando el fondo oscuro, con la X o con Escape.
 */
export function crearHoja(opts: {
  boton: HTMLElement;
  titulo: string;
  alAbrir?: () => void;
}): Superficie & { cuerpo: HTMLElement } {
  const { boton, titulo, alAbrir } = opts;
  const fondo = document.createElement('div');
  fondo.className = 'hoja-fondo';
  const raiz = document.createElement('section');
  raiz.className = 'hoja';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-label', titulo);
  const panel = document.createElement('div');
  panel.className = 'hoja-panel';

  const asa = document.createElement('div');
  asa.className = 'hoja-asa';
  const barra = document.createElement('div');
  barra.className = 'hoja-barra';
  const cab = document.createElement('div');
  cab.className = 'hoja-cab';
  const h = document.createElement('h2');
  h.className = 'hoja-titulo';
  h.textContent = titulo;
  const cerrarBtn = document.createElement('button');
  cerrarBtn.type = 'button';
  cerrarBtn.className = 'btn-cerrar';
  cerrarBtn.setAttribute('aria-label', 'Cerrar');
  cerrarBtn.innerHTML = iconoCerrar(14);
  cab.append(h, cerrarBtn);
  asa.append(barra, cab);

  const cuerpo = document.createElement('div');
  cuerpo.className = 'hoja-cuerpo';
  panel.append(asa, cuerpo);
  raiz.append(panel);
  document.body.append(fondo, raiz);
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.setAttribute('aria-expanded', 'false');

  let abierta = false;
  const api: Superficie & { cuerpo: HTMLElement } = {
    cuerpo,
    get abierta() {
      return abierta;
    },
    abrir() {
      cerrarOtras(api);
      abierta = true;
      fondo.classList.add('abierta');
      raiz.classList.add('abierta');
      boton.setAttribute('aria-expanded', 'true');
      alAbrir?.();
    },
    cerrar() {
      abierta = false;
      fondo.classList.remove('abierta');
      raiz.classList.remove('abierta');
      panel.style.transform = '';
      boton.setAttribute('aria-expanded', 'false');
    },
    alternar() {
      if (abierta) api.cerrar();
      else api.abrir();
    },
  };
  boton.addEventListener('click', () => api.alternar());
  cerrarBtn.addEventListener('click', () => api.cerrar());
  fondo.addEventListener('click', () => api.cerrar());

  // Arrastrar el tirador hacia abajo para cerrar
  let y0: number | null = null;
  asa.addEventListener('pointerdown', (ev) => {
    if ((ev.target as HTMLElement).closest('button')) return;
    y0 = ev.clientY;
    panel.style.transition = 'none';
    asa.setPointerCapture?.(ev.pointerId);
  });
  asa.addEventListener('pointermove', (ev) => {
    if (y0 === null) return;
    panel.style.transform = `translateY(${Math.max(0, ev.clientY - y0)}px)`;
  });
  const soltar = (ev: PointerEvent) => {
    if (y0 === null) return;
    const dy = ev.clientY - y0;
    y0 = null;
    panel.style.transition = '';
    if (dy > 90) api.cerrar();
    else panel.style.transform = '';
  };
  asa.addEventListener('pointerup', soltar);
  asa.addEventListener('pointercancel', soltar);

  todas.add(api);
  registrarEscape();
  return api;
}

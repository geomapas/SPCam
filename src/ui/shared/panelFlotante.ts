import { iconoCerrar } from './iconos';

export interface PanelFlotante {
  el: HTMLElement;
  /** Zona donde cada panel dibuja su contenido. */
  cuerpo: HTMLElement;
  readonly abierto: boolean;
  abrir(): void;
  cerrar(): void;
  alternar(): void;
}

const todos: PanelFlotante[] = [];

/**
 * Panel flotante sobre el mapa, con su botón de apertura en la cabecera.
 * Solo hay uno abierto a la vez. Cerrarlo solo lo oculta: lo que haya en marcha
 * (por ejemplo, una grabación) sigue funcionando.
 */
export function crearPanelFlotante(opts: {
  titulo: string;
  /** SVG del icono pequeño junto al título */
  icono: string;
  boton: HTMLButtonElement;
  contenedor: HTMLElement;
  alAbrir?: () => void;
  /** Menú pequeño anclado a la derecha, en vez de un panel ancho */
  compacto?: boolean;
}): PanelFlotante {
  const { titulo, icono, boton, contenedor, alAbrir } = opts;

  const el = document.createElement('section');
  el.className = `panel-flotante glass-card${opts.compacto ? ' compacto' : ''}`;
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', titulo);

  const cab = document.createElement('div');
  cab.className = 'pc-cab';
  const tit = document.createElement('span');
  tit.className = 'pc-titulo';
  tit.innerHTML = icono;
  const txt = document.createElement('span');
  txt.textContent = titulo;
  tit.append(txt);
  const cerrarBtn = document.createElement('button');
  cerrarBtn.type = 'button';
  cerrarBtn.className = 'pc-cerrar';
  cerrarBtn.setAttribute('aria-label', 'Cerrar');
  cerrarBtn.innerHTML = iconoCerrar(16);
  cab.append(tit, cerrarBtn);

  const cuerpo = document.createElement('div');
  cuerpo.className = 'pc-cuerpo';
  el.append(cab, cuerpo);

  const api: PanelFlotante = {
    el,
    cuerpo,
    get abierto() {
      return !el.hidden;
    },
    abrir() {
      todos.forEach((p) => p !== api && p.cerrar());
      el.hidden = false;
      boton.classList.add('active');
      boton.setAttribute('aria-expanded', 'true');
      alAbrir?.();
    },
    cerrar() {
      el.hidden = true;
      boton.classList.remove('active');
      boton.setAttribute('aria-expanded', 'false');
    },
    alternar() {
      if (el.hidden) api.abrir();
      else api.cerrar();
    },
  };

  boton.addEventListener('click', () => api.alternar());
  cerrarBtn.addEventListener('click', () => api.cerrar());
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !el.hidden) api.cerrar();
  });

  contenedor.append(el);
  todos.push(api);
  return api;
}

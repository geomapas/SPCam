import { puede } from '@/domain/permisos';
import { iconoCapas, iconoLogo } from './iconos';

export interface Cabecera {
  /** Botón que abre el panel de capas (oculto si el perfil no puede usarlo). */
  botonCapas: HTMLButtonElement;
}

/** Cabecera común: logotipo, estado de red y botón de capas. Se inserta al principio del <body>. */
export function montarCabecera(subtitulo?: string): Cabecera {
  const header = document.createElement('header');
  header.innerHTML = `
    <div class="logo">
      <div class="logo-icon">${iconoLogo(18)}</div>
      <div>
        <div class="logo-text"><span class="geo">geo</span><span class="resto">campo</span></div>
        ${subtitulo ? `<div class="logo-sub"></div>` : ''}
      </div>
    </div>
    <div class="header-sep"></div>
    <div class="status-pill" id="pill-red"><span class="dot"></span><span class="txt"></span></div>
    <button class="btn-cabecera" id="btn-capas" type="button" aria-haspopup="dialog" aria-expanded="false">
      ${iconoCapas(16)}<span>Capas</span>
    </button>`;
  if (subtitulo) header.querySelector('.logo-sub')!.textContent = subtitulo;
  document.body.prepend(header);

  const pill = header.querySelector<HTMLElement>('#pill-red')!;
  const txt = pill.querySelector<HTMLElement>('.txt')!;
  const pintarRed = () => {
    const online = navigator.onLine;
    pill.classList.toggle('off', !online);
    txt.textContent = online ? 'En línea' : 'Sin conexión';
  };
  pintarRed();
  window.addEventListener('online', pintarRed);
  window.addEventListener('offline', pintarRed);

  const botonCapas = header.querySelector<HTMLButtonElement>('#btn-capas')!;
  if (!puede('cambiar_mapa_base') && !puede('ver_capas_tematicas')) botonCapas.hidden = true;
  return { botonCapas };
}

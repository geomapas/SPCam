import { puede } from '@/domain/permisos';
import { iconoCapas, iconoLogo, iconoTrack } from './iconos';

export interface OpcionesCabecera {
  subtitulo?: string;
  /** Muestra el icono del recorrido (track). Solo la app del técnico lo usa. */
  conTrack?: boolean;
}

export interface Cabecera {
  /** Abre el panel de capas (oculto si el perfil no puede usarlo). */
  botonCapas: HTMLButtonElement;
  /** Abre el panel del recorrido; null si esta pantalla no lo tiene. */
  botonTrack: HTMLButtonElement | null;
}

/** Cabecera común: logotipo SPCam, estado de red y dos iconos (capas y recorrido). */
export function montarCabecera(opciones: OpcionesCabecera = {}): Cabecera {
  const { subtitulo, conTrack = false } = opciones;
  const header = document.createElement('header');
  header.innerHTML = `
    <div class="logo">
      <div class="logo-icon">${iconoLogo(18)}</div>
      <div>
        <div class="logo-text"><span class="sp">SP</span><span class="cam">Cam</span></div>
        ${subtitulo ? `<div class="logo-sub"></div>` : ''}
      </div>
    </div>
    <div class="header-sep"></div>
    <div class="status-pill" id="pill-red"><span class="dot"></span><span class="txt"></span></div>
    ${
      conTrack
        ? `<button class="btn-icono" id="btn-track" type="button" aria-haspopup="dialog" aria-expanded="false"
             aria-label="Recorrido (track)" title="Recorrido (track)">${iconoTrack(20)}</button>`
        : ''
    }
    <button class="btn-icono" id="btn-capas" type="button" aria-haspopup="dialog" aria-expanded="false"
      aria-label="Capas" title="Capas">${iconoCapas(20)}</button>`;
  if (subtitulo) header.querySelector('.logo-sub')!.textContent = subtitulo;
  document.body.prepend(header);

  const pill = header.querySelector<HTMLElement>('#pill-red')!;
  const txt = pill.querySelector<HTMLElement>('.txt')!;
  const pintarRed = () => {
    const online = navigator.onLine;
    pill.classList.toggle('off', !online);
    pill.title = online ? 'Hay conexión' : 'Sin conexión';
    txt.textContent = online ? 'En línea' : 'Sin conexión';
  };
  pintarRed();
  window.addEventListener('online', pintarRed);
  window.addEventListener('offline', pintarRed);

  const botonCapas = header.querySelector<HTMLButtonElement>('#btn-capas')!;
  if (!puede('cambiar_mapa_base') && !puede('ver_capas_tematicas')) botonCapas.hidden = true;

  const botonTrack = header.querySelector<HTMLButtonElement>('#btn-track');
  if (botonTrack && !puede('grabar_recorridos') && !puede('ver_recorridos_guardados')) botonTrack.hidden = true;

  return { botonCapas, botonTrack };
}

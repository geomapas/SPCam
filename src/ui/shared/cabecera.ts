import { puede } from '@/domain/permisos';
import { iconoCapas, iconoLogo, iconoTrack, iconoUsuario } from './iconos';

export interface OpcionesCabecera {
  subtitulo?: string;
  /** Muestra el icono del recorrido (track). Solo la app del técnico lo usa. */
  conTrack?: boolean;
}

export interface Cabecera {
  /** Abre el menú del usuario (verde con conexión, rojo sin conexión). */
  botonUsuario: HTMLButtonElement;
  /** Abre el panel de capas (oculto si el perfil no puede usarlo). */
  botonCapas: HTMLButtonElement;
  /** Abre el panel del recorrido; null si esta pantalla no lo tiene. */
  botonTrack: HTMLButtonElement | null;
}

/** Cabecera común: logotipo SPCam y tres iconos: usuario (estado de la conexión), recorrido y capas. */
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
    <button class="btn-icono" id="btn-usuario" type="button" aria-haspopup="dialog" aria-expanded="false">${iconoUsuario(20)}</button>
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

  // El icono de usuario indica la conexión: verde = en línea, rojo = sin conexión
  const botonUsuario = header.querySelector<HTMLButtonElement>('#btn-usuario')!;
  const pintarRed = () => {
    const online = navigator.onLine;
    botonUsuario.classList.toggle('en-linea', online);
    botonUsuario.classList.toggle('sin-conexion', !online);
    const texto = online ? 'en línea' : 'sin conexión';
    botonUsuario.title = `Usuario (${texto})`;
    botonUsuario.setAttribute('aria-label', `Usuario: ${texto}`);
  };
  pintarRed();
  window.addEventListener('online', pintarRed);
  window.addEventListener('offline', pintarRed);

  const botonCapas = header.querySelector<HTMLButtonElement>('#btn-capas')!;
  if (!puede('cambiar_mapa_base') && !puede('ver_capas_tematicas')) botonCapas.hidden = true;

  const botonTrack = header.querySelector<HTMLButtonElement>('#btn-track');
  if (botonTrack && !puede('grabar_recorridos') && !puede('ver_recorridos_guardados')) botonTrack.hidden = true;

  return { botonUsuario, botonCapas, botonTrack };
}

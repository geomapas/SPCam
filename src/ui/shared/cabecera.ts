import { puede } from '@/domain/permisos';
import { iconoLogo, iconoTrack, iconoUsuario } from './iconos';

export interface OpcionesCabecera {
  subtitulo?: string;
  /** Muestra el botón del recorrido (track). Solo la app del técnico lo usa. */
  conTrack?: boolean;
}

export interface Cabecera {
  /** Abre el menú del usuario (verde con conexión, coral sin conexión). */
  botonUsuario: HTMLButtonElement;
  /** Abre el panel del recorrido; null si esta pantalla no lo tiene. */
  botonTrack: HTMLButtonElement | null;
}

/** Cabecera flotante: cápsula con el logotipo SPCam y el usuario, y el botón redondo del recorrido. */
export function montarCabecera(opciones: OpcionesCabecera = {}): Cabecera {
  const { subtitulo, conTrack = false } = opciones;
  const raiz = document.createElement('header');
  raiz.className = 'hud-cabecera';
  raiz.innerHTML = `
    <div class="cabecera-fila">
      <div class="capsula vidrio">
        <div class="logo">
          <div class="logo-icono">${iconoLogo(16)}</div>
          <span class="logo-texto"><span class="sp">SP</span>Cam</span>
          ${subtitulo ? '<span class="logo-sub"></span>' : ''}
        </div>
        <button class="btn-usuario" id="btn-usuario" type="button">${iconoUsuario(16)}</button>
      </div>
      ${
        conTrack
          ? `<button class="btn-circulo vidrio" id="btn-track" type="button" aria-label="Recorrido (track)" title="Recorrido (track)">${iconoTrack(22)}</button>`
          : ''
      }
    </div>`;
  if (subtitulo) raiz.querySelector('.logo-sub')!.textContent = subtitulo;
  document.body.prepend(raiz);

  // El icono de usuario indica la conexión: verde = en línea, coral = sin conexión
  const botonUsuario = raiz.querySelector<HTMLButtonElement>('#btn-usuario')!;
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

  const botonTrack = raiz.querySelector<HTMLButtonElement>('#btn-track');
  if (botonTrack && !puede('grabar_recorridos') && !puede('ver_recorridos_guardados')) botonTrack.hidden = true;
  return { botonUsuario, botonTrack };
}

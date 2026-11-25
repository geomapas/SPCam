import { cerrarSesion, usuarioActual } from '@/domain/sesion';
import { mostrarAviso } from './aviso';
import { iconoSalir, iconoUsuario } from './iconos';
import { crearPanelFlotante } from './panelFlotante';

/**
 * Menú del usuario: su nombre y «Cerrar sesión».
 * Cerrar sesión vuelve al inicio de la app (cuando exista el login, será la pantalla de usuario y contraseña).
 */
export function montarPanelUsuario(opts: {
  boton: HTMLButtonElement;
  contenedor: HTMLElement;
  /** Si devuelve un texto, no se puede cerrar sesión ahora y se muestra ese motivo (p. ej. hay una grabación en curso). */
  motivoBloqueo?: () => string | null;
}): void {
  const { boton, contenedor, motivoBloqueo } = opts;
  const panel = crearPanelFlotante({
    titulo: 'Usuario',
    icono: iconoUsuario(14),
    boton,
    contenedor,
    compacto: true,
    alAbrir: () => pintar(),
  });

  const nombre = document.createElement('div');
  nombre.className = 'usr-nombre';
  const zona = document.createElement('div');
  zona.className = 'usr-zona';
  panel.cuerpo.append(nombre, zona);

  let confirmando = false;

  function pintar(): void {
    nombre.textContent = usuarioActual().nombre;
    zona.replaceChildren();
    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'btn-grande gris con-icono';
    salir.innerHTML = iconoSalir(16);
    salir.append(Object.assign(document.createElement('span'), { textContent: 'Cerrar sesión' }));

    if (confirmando) {
      // Sin conexión no se puede volver a entrar: se avisa antes de cerrar.
      const aviso = document.createElement('div');
      aviso.className = 'usr-aviso';
      aviso.textContent = 'Estás sin conexión: si cierras sesión no podrás volver a entrar hasta que tengas cobertura.';
      const botones = document.createElement('div');
      botones.className = 'tk-botones';
      const cancelar = Object.assign(document.createElement('button'), { type: 'button', className: 'btn-grande gris', textContent: 'Cancelar' });
      cancelar.addEventListener('click', () => {
        confirmando = false;
        pintar();
      });
      const si = Object.assign(document.createElement('button'), { type: 'button', className: 'btn-grande rojo', textContent: 'Cerrar sesión' });
      si.addEventListener('click', () => void salirAhora());
      botones.append(cancelar, si);
      zona.append(aviso, botones);
      return;
    }
    salir.addEventListener('click', () => {
      const motivo = motivoBloqueo?.() ?? null;
      if (motivo) return mostrarAviso(motivo, 'error');
      if (!navigator.onLine) {
        confirmando = true;
        pintar();
        return;
      }
      void salirAhora();
    });
    zona.append(salir);
  }

  async function salirAhora(): Promise<void> {
    try {
      await cerrarSesion();
      location.reload(); // vuelta al inicio
    } catch (e) {
      mostrarAviso(`No se pudo cerrar la sesión: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  pintar();
}

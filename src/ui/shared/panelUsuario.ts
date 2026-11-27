import { cerrarSesion, usuarioActual } from '@/domain/sesion';
import { mostrarAviso } from './aviso';
import { iconoSalir } from './iconos';
import { crearPopover } from './superficies';

/**
 * Menú del usuario: su nombre y «Cerrar sesión».
 * Cerrar sesión vuelve al inicio de la app (cuando exista el login, será la pantalla de usuario y contraseña).
 */
export function montarPanelUsuario(opts: {
  boton: HTMLButtonElement;
  /** Si devuelve un texto, no se puede cerrar sesión ahora y se muestra ese motivo (p. ej. hay una grabación en curso). */
  motivoBloqueo?: () => string | null;
}): void {
  const { boton, motivoBloqueo } = opts;
  const cont = document.createElement('div');
  const nombre = document.createElement('div');
  nombre.className = 'usr-nombre';
  const zona = document.createElement('div');
  cont.append(nombre, zona);

  let confirmando = false;
  const pop = crearPopover({
    boton,
    zona: 'cabecera',
    alinear: 'fin',
    etiqueta: 'Usuario',
    contenido: cont,
    ancho: 'usr-ancho',
    alAbrir: () => {
      confirmando = false;
      pintar();
    },
  });

  function boton2(texto: string, clase: string, alPulsar: () => void, icono?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${clase}`;
    if (icono) b.innerHTML = icono;
    b.append(document.createTextNode(texto));
    b.addEventListener('click', alPulsar);
    return b;
  }

  function pintar(): void {
    nombre.textContent = usuarioActual().nombre;
    zona.replaceChildren();
    if (confirmando) {
      // Sin conexión no se puede volver a entrar: se avisa antes de cerrar.
      const aviso = document.createElement('div');
      aviso.className = 'usr-aviso';
      aviso.textContent = 'Estás sin conexión: si cierras sesión no podrás volver a entrar hasta que tengas cobertura.';
      const botones = document.createElement('div');
      botones.className = 'tk-botones';
      botones.append(
        boton2('Cancelar', 'btn-suave', () => {
          confirmando = false;
          pintar();
        }),
        boton2('Cerrar sesión', 'btn-coral', () => void salirAhora()),
      );
      zona.append(aviso, botones);
      return;
    }
    zona.append(
      boton2(
        'Cerrar sesión',
        'btn-suave btn-bloque',
        () => {
          const motivo = motivoBloqueo?.() ?? null;
          if (motivo) return mostrarAviso(motivo, 'error');
          if (!navigator.onLine) {
            confirmando = true;
            pintar();
            return;
          }
          void salirAhora();
        },
        iconoSalir(16),
      ),
    );
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
  void pop;
}

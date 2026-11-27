// Tema visual compartido. Cada pantalla lo importa una vez: carga las tipografías (empaquetadas) y los estilos,
// y aplica el tema guardado. Las reglas de diseño están en estilos.css y en DISENO.md.
import './estilos.css';

export type Tema = 'claro' | 'oscuro';
// Clave nueva (v2): el valor anterior se guardó sin que el usuario eligiera nada y habría dejado el oscuro fijado en todos los dispositivos.
const CLAVE = 'spcam.tema2';
const COLOR_BARRA: Record<Tema, string> = { oscuro: '#090a0c', claro: '#f4f4f5' };

export function temaActual(): Tema {
  return document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro';
}

function aplicar(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'oscuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema]);
}

/** Cambia el tema (elección del usuario) y la recuerda en el dispositivo. */
export function fijarTema(tema: Tema): void {
  aplicar(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento: el tema vale para esta sesión */
  }
}

/** Claro por defecto. Solo se recuerda lo que el usuario elige. Un pequeño script en el HTML ya lo aplica antes de pintar. */
export function iniciarTema(): void {
  let guardado: string | null = null;
  try {
    guardado = localStorage.getItem(CLAVE);
  } catch {
    /* ignorar */
  }
  aplicar(guardado === 'oscuro' ? 'oscuro' : 'claro');
}

iniciarTema();

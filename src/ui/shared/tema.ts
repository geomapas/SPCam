// Tema visual compartido. Cada pantalla lo importa una vez: carga las tipografías (empaquetadas) y los estilos,
// y aplica el tema guardado. Las reglas de diseño están en estilos.css y en DISENO.md.
import './estilos.css';

export type Tema = 'claro' | 'oscuro';
const CLAVE = 'spcam.tema';
const COLOR_BARRA: Record<Tema, string> = { oscuro: '#090a0c', claro: '#f4f4f5' };

export function temaActual(): Tema {
  return document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro';
}

/** Cambia el tema, lo recuerda en el dispositivo y ajusta el color de la barra del sistema. */
export function fijarTema(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'oscuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema]);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento: el tema vale para esta sesión */
  }
}

/** Oscuro por defecto. Un pequeño script en el HTML ya lo aplica antes de pintar para evitar el parpadeo. */
export function iniciarTema(): void {
  let guardado: string | null = null;
  try {
    guardado = localStorage.getItem(CLAVE);
  } catch {
    /* ignorar */
  }
  fijarTema(guardado === 'claro' ? 'claro' : 'oscuro');
}

iniciarTema();

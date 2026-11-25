/**
 * Sesión del usuario.
 *
 * PROVISIONAL: el inicio de sesión (Firebase Auth) aún no existe, así que no hay un usuario real.
 * Cuando exista, `usuarioActual()` devolverá el de la sesión y `cerrarSesion()` cerrará la de Firebase.
 * La interfaz no cambia: solo cambia lo que hay dentro de estas dos funciones.
 */
export interface Usuario {
  nombre: string;
}

export function usuarioActual(): Usuario {
  return { nombre: 'Usuario de prueba' };
}

/** Cierra la sesión. Hoy no hay nada que cerrar; la pantalla vuelve al inicio al terminar. */
export async function cerrarSesion(): Promise<void> {
  /* pendiente: cerrar sesión en Firebase y vaciar los datos de la sesión */
}

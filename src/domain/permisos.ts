/**
 * Puertas de permisos. Cada función de la app pregunta `puede('...')` antes de mostrarse o actuar.
 *
 * HOY todo está abierto ("sí" para todos los perfiles): así la app se comporta como la app completa
 * mientras se construye. Esta tabla pasará a leerse de Firebase (paso 3) y se cerrará al final.
 * Regla: lo que no esté en la tabla, o no se pueda determinar, queda DENEGADO.
 */
export type Perfil = 'tecnico' | 'colaborador' | 'gestor';

export const PERMISOS = [
  'grabar_recorridos',
  'ver_recorridos_guardados',
  'ver_mi_ubicacion',
  'cambiar_mapa_base',
  'ver_capas_tematicas',
  'configurar_capas_precargadas',
  'ver_capas_proyecto',
  'anadir_capas_proyecto',
  'eliminar_capas_proyecto',
  'editar_capas_proyecto',
  'descargar_capas_proyecto',
  'sincronizar_capas_proyecto',
  'compartir_capas_proyecto',
] as const;
export type Permiso = (typeof PERMISOS)[number];

const TODOS: Record<Perfil, boolean> = { tecnico: true, colaborador: true, gestor: true };

const TABLA: Record<Permiso, Record<Perfil, boolean>> = {
  grabar_recorridos: { ...TODOS },
  ver_recorridos_guardados: { ...TODOS },
  ver_mi_ubicacion: { ...TODOS },
  cambiar_mapa_base: { ...TODOS },
  ver_capas_tematicas: { ...TODOS },
  configurar_capas_precargadas: { ...TODOS },
  ver_capas_proyecto: { ...TODOS },
  anadir_capas_proyecto: { ...TODOS },
  eliminar_capas_proyecto: { ...TODOS },
  editar_capas_proyecto: { ...TODOS },
  descargar_capas_proyecto: { ...TODOS },
  sincronizar_capas_proyecto: { ...TODOS },
  compartir_capas_proyecto: { ...TODOS },
};

// Hasta que exista el login, el perfil depende del destino de build.
let perfilActual: Perfil | null =
  typeof __DESTINO__ !== 'undefined' ? (__DESTINO__ === 'gestor' ? 'gestor' : 'tecnico') : null;

export function fijarPerfil(perfil: Perfil | null): void {
  perfilActual = perfil;
}

export function puede(permiso: Permiso): boolean {
  if (!perfilActual) return false;
  return TABLA[permiso]?.[perfilActual] === true;
}

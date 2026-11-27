import { obtenerPosicion, type PosicionActual } from '@/data/gps/posicionActual';
import { puede } from '@/domain/permisos';

export type { PosicionActual };

/** Dónde estoy ahora mismo. */
export async function miUbicacion(): Promise<PosicionActual> {
  if (!puede('ver_mi_ubicacion')) throw new Error('No tienes permiso para usar la ubicación');
  return obtenerPosicion();
}

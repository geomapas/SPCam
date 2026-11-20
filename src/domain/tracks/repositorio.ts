import { compartirArchivo } from '@/data/files/compartir';
import { db, pedirPersistencia } from '@/data/local/db';
import type { TrackRecord } from '@/domain/types';

export { pedirPersistencia };

export async function listarTracksFinalizados(): Promise<TrackRecord[]> {
  const todos = await db.tracks.orderBy('startedAt').reverse().toArray();
  return todos.filter((t) => t.status === 'finalizado');
}

/** true si se abrió el diálogo de compartir; false si no es posible (p. ej. en el navegador). */
export async function compartirGpx(reg: TrackRecord): Promise<boolean> {
  if (!reg.gpxPath) throw new Error('Este recorrido no tiene puntos');
  return compartirArchivo(reg.gpxPath, `recorrido-${reg.id}.gpx`, 'Recorrido GPX');
}

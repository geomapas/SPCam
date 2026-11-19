import Dexie, { type Table } from 'dexie';
import type { TrackRecord } from '@/domain/types';

/**
 * Base local (IndexedDB). El esquema está versionado desde el día uno:
 * cuando cambie, NO edites la versión 1; añade `this.version(2).stores({...}).upgrade(...)`.
 * Habrá móviles con datos sin subir, así que las migraciones deben conservar datos.
 */
class GeoCampoDB extends Dexie {
  tracks!: Table<TrackRecord, string>;

  constructor() {
    super('geocampo');
    this.version(1).stores({
      tracks: 'id, status, startedAt',
    });
  }
}

export const db = new GeoCampoDB();

/** Pide al sistema que no borre los datos sin subir. Llamar al arrancar. */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* sin soporte: seguimos */
  }
  return false;
}

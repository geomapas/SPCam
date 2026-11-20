import Dexie, { type Table } from 'dexie';
import type { TrackRecord } from '@/domain/types';

export interface Preferencia {
  clave: string;
  valor: unknown;
}

/**
 * Base local (IndexedDB). Esquema versionado desde el día uno:
 * NUNCA edites una versión ya publicada; añade `this.version(N+1).stores({...}).upgrade(...)`.
 * Habrá móviles con datos sin subir, así que las migraciones deben conservar datos.
 *
 *  v1: tracks
 *  v2: preferencias (mapa base, capas activas…)
 */
class GeoCampoDB extends Dexie {
  tracks!: Table<TrackRecord, string>;
  preferencias!: Table<Preferencia, string>;

  constructor() {
    super('geocampo');
    this.version(1).stores({
      tracks: 'id, status, startedAt',
    });
    this.version(2).stores({
      tracks: 'id, status, startedAt',
      preferencias: 'clave',
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

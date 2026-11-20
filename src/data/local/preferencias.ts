import type { Almacen } from '@/domain/capas/gestorCapas';
import { db } from './db';

/** Preferencias guardadas en la base local (Dexie). */
export const almacenPreferencias: Almacen = {
  async leer(clave) {
    return (await db.preferencias.get(clave))?.valor;
  },
  async guardar(clave, valor) {
    await db.preferencias.put({ clave, valor });
  },
};

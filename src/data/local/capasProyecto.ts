import type { AlmacenProyecto } from '@/domain/capas/proyecto';
import { db } from './db';

/** Capas del proyecto guardadas en la base local (Dexie): funcionan sin conexión. */
export const almacenProyecto: AlmacenProyecto = {
  listar: () => db.capasProyecto.toArray(),
  async leerDatos(id) {
    return (await db.capasProyectoDatos.get(id))?.datos;
  },
  async guardarNueva(capa, datos) {
    await db.transaction('rw', db.capasProyecto, db.capasProyectoDatos, async () => {
      await db.capasProyectoDatos.put({ id: capa.id, datos });
      await db.capasProyecto.put(capa);
    });
  },
  async actualizar(id, cambios) {
    await db.capasProyecto.update(id, cambios);
  },
  async borrar(id) {
    await db.transaction('rw', db.capasProyecto, db.capasProyectoDatos, async () => {
      await db.capasProyecto.delete(id);
      await db.capasProyectoDatos.delete(id);
    });
  },
};

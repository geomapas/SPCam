import { almacenPreferencias } from '@/data/local/preferencias';
import { GestorCapas } from './gestorCapas';

/** Gestor de capas ya conectado al almacenamiento local. La UI usa esto. */
export async function crearGestorCapas(): Promise<GestorCapas> {
  const g = new GestorCapas(almacenPreferencias);
  await g.cargar();
  return g;
}

export { GestorCapas } from './gestorCapas';
export type { EstadoCapas } from './gestorCapas';
export { CAPAS_TEMATICAS, MAPAS_BASE } from './catalogo';
export type { CapaTematica, Fuente, MapaBase } from './catalogo';

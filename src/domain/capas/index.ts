import { almacenProyecto } from '@/data/local/capasProyecto';
import { almacenPreferencias } from '@/data/local/preferencias';
import { GestorCapas } from './gestorCapas';
import { GestorProyecto } from './proyecto';

/** Gestor de capas ya conectado al almacenamiento local. La UI usa esto. */
export async function crearGestorCapas(): Promise<GestorCapas> {
  const g = new GestorCapas(almacenPreferencias);
  await g.cargar();
  return g;
}

/** Capas del proyecto (archivos cargados por el usuario), guardadas en el dispositivo. */
export async function crearGestorProyecto(): Promise<GestorProyecto> {
  const g = new GestorProyecto(almacenProyecto);
  await g.cargar();
  return g;
}

export { GestorCapas } from './gestorCapas';
export type { EstadoCapas } from './gestorCapas';
export { GestorProyecto, PALETA, colorRelleno, opacidadRelleno } from './proyecto';
export type { CapaProyecto } from './proyecto';
export { NubeNoDisponible } from './nube';
export type { FichaNube } from './nube';
export type { FormatoExport } from '@/data/files/exportarCapa';
export { CAPAS_TEMATICAS, MAPAS_BASE } from './catalogo';
export type { CapaTematica, Fuente, MapaBase } from './catalogo';

import type { FeatureCollection } from 'geojson';
import type { CapaProyecto } from './proyecto';

/** Ficha de una capa guardada en la nube (sin sus geometrías). */
export interface FichaNube {
  id: string;
  nombre: string;
  nElementos: number;
  color: string;
  actualizada: number;
}

/**
 * Copia de las capas en la nube (Firebase: ficha en Firestore, geometrías en Cloud Storage).
 * La interfaz ya está lista; la implementación real llega con el inicio de sesión (pasos 3 y 5 del plan).
 */
export interface Nube {
  readonly disponible: boolean;
  subir(capa: CapaProyecto, datos: FeatureCollection): Promise<void>;
  listar(): Promise<FichaNube[]>;
  descargar(id: string): Promise<{ capa: CapaProyecto; datos: FeatureCollection }>;
  compartirCon(correos: string[], capa: CapaProyecto): Promise<void>;
}

export class NubeNoDisponible extends Error {
  constructor() {
    super('La nube todavía no está conectada: se activará con el inicio de sesión de Firebase.');
    this.name = 'NubeNoDisponible';
  }
}

/** Mientras no exista la conexión con Firebase. */
export const nubeNoConectada: Nube = {
  disponible: false,
  subir: () => Promise.reject(new NubeNoDisponible()),
  listar: async () => [],
  descargar: () => Promise.reject(new NubeNoDisponible()),
  compartirCon: () => Promise.reject(new NubeNoDisponible()),
};

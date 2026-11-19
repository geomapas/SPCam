/**
 * Tipos del dominio. Regla de capas:
 *   ui → domain → data
 * `data` solo puede importar *tipos* de aquí (import type), nunca lógica.
 */
export interface TrackPoint {
  lat: number;
  lon: number;
  /** ms desde epoch */
  t: number;
  /** precisión horizontal en metros */
  acc: number | null;
  alt: number | null;
  /** m/s */
  speed: number | null;
}

export type TrackStatus = 'grabando' | 'finalizado';

export interface TrackRecord {
  /** UUID generado en el dispositivo */
  id: string;
  status: TrackStatus;
  startedAt: number;
  endedAt?: number;
  pointCount: number;
  lengthM: number;
  /** Ruta relativa (Directory.Data) del archivo incremental: un punto JSON por línea */
  jsonlPath: string;
  /** Ruta relativa del GPX final (solo cuando status = finalizado) */
  gpxPath?: string;
  /** true si la app se cerró durante la grabación y se finalizó al reabrir */
  recuperado?: boolean;
}

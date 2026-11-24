/** Ajustes del seguimiento GPS. Cámbialos aquí, no repartidos por el código. */
export const GPS = {
  /** Metros mínimos entre puntos (el plugin no emite si te mueves menos). */
  distanciaMinimaM: 5,
  /** Se descartan fixes con peor precisión que esto (metros). */
  precisionMaximaM: 50,
  /** Cada cuántos puntos se actualiza el contador en la base local. */
  guardarMetadatosCadaN: 10,
  tituloNotificacion: 'SPCam: grabando recorrido',
  textoNotificacion: 'Toca para volver a la app. Se guarda cada punto.',
} as const;

export const CARPETA_TRACKS = 'tracks';

/** Capas del proyecto: por debajo de este zoom se ven como pinpoints; a partir de él, como geometrías (igual que GEOmapas). */
export const UMBRAL_PINS_ZOOM = 14;
/** Hasta este número de elementos los pinpoints llevan el icono de chincheta; por encima se dibujan como puntos (más ligeros). */
export const LIMITE_PINES_ICONO = 3000;

/** Transparencia del relleno de las geometrías de las capas del proyecto (igual que GEOmapas). */
export const OPACIDAD_RELLENO = 0.25;

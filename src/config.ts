/** Ajustes del seguimiento GPS. Cámbialos aquí, no repartidos por el código. */
export const GPS = {
  /** Metros mínimos entre puntos (el plugin no emite si te mueves menos). */
  distanciaMinimaM: 5,
  /** Se descartan fixes con peor precisión que esto (metros). */
  precisionMaximaM: 50,
  /** Cada cuántos puntos se actualiza el contador en la base local. */
  guardarMetadatosCadaN: 10,
  tituloNotificacion: 'GeoCampo: grabando recorrido',
  textoNotificacion: 'Toca para volver a la app. Se guarda cada punto.',
} as const;

export const CARPETA_TRACKS = 'tracks';

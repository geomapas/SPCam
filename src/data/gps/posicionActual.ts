/** Posición actual, una sola vez (para «localizarme»). Distinta del seguimiento del recorrido. */
export interface PosicionActual {
  lat: number;
  lon: number;
  /** precisión en metros */
  acc: number;
}

export function obtenerPosicion(): Promise<PosicionActual> {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('Este dispositivo no tiene geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      (e) =>
        rechazar(
          new Error(
            e.code === 1
              ? 'Permiso de ubicación denegado'
              : e.code === 3
                ? 'No se pudo obtener la posición a tiempo (¿sin señal GPS?)'
                : 'Posición no disponible',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  });
}

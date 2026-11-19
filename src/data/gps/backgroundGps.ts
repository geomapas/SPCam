import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { GPS } from '@/config';
import type { TrackPoint } from '@/domain/types';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface GpsError {
  code: string;
  message: string;
}

export interface GpsSession {
  stop(): Promise<void>;
}

/**
 * Android 13+: la notificación permanente del servicio en primer plano necesita
 * el permiso POST_NOTIFICATIONS en tiempo de ejecución.
 */
async function asegurarPermisoNotificaciones(): Promise<void> {
  const estado = await LocalNotifications.checkPermissions();
  if (estado.display === 'granted') return;
  await LocalNotifications.requestPermissions();
}

/**
 * Inicia el seguimiento.
 * - En el móvil (Capacitor): servicio en primer plano con notificación → sigue con pantalla apagada.
 * - En el navegador (desarrollo): navigator.geolocation, solo en primer plano.
 */
export async function iniciarGps(
  alPunto: (p: TrackPoint) => void,
  alError: (e: GpsError) => void,
): Promise<GpsSession> {
  if (Capacitor.isNativePlatform()) {
    await asegurarPermisoNotificaciones();
    const id = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: GPS.tituloNotificacion,
        backgroundMessage: GPS.textoNotificacion,
        requestPermissions: true,
        stale: false,
        distanceFilter: GPS.distanciaMinimaM,
      },
      (loc, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') void BackgroundGeolocation.openSettings();
          alError({ code: error.code ?? 'ERROR', message: error.message });
          return;
        }
        if (!loc) return;
        alPunto({
          lat: loc.latitude,
          lon: loc.longitude,
          t: loc.time ?? Date.now(),
          acc: loc.accuracy ?? null,
          alt: loc.altitude ?? null,
          speed: loc.speed ?? null,
        });
      },
    );
    return { stop: () => BackgroundGeolocation.removeWatcher({ id }) };
  }

  if (!('geolocation' in navigator)) {
    throw new Error('Este navegador no tiene geolocalización');
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) =>
      alPunto({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        t: pos.timestamp,
        acc: pos.coords.accuracy,
        alt: pos.coords.altitude,
        speed: pos.coords.speed,
      }),
    (err) => alError({ code: String(err.code), message: err.message }),
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return { stop: async () => navigator.geolocation.clearWatch(watchId) };
}

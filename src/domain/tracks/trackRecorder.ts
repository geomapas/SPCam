import { CARPETA_TRACKS, GPS } from '@/config';
import { db } from '@/data/local/db';
import { anexar, crearArchivo, escribirTexto, existe, leerTexto } from '@/data/files/trackFiles';
import { iniciarGps, type GpsError, type GpsSession } from '@/data/gps/backgroundGps';
import type { TrackPoint, TrackRecord } from '@/domain/types';
import { distanciaM, longitudM } from './geo';
import { aGpx, leerJsonl } from './gpx';

export interface RecorderEvents {
  punto?: (p: TrackPoint, estado: TrackRecord) => void;
  error?: (e: GpsError) => void;
}

/**
 * Graba un track:
 *  - Cada punto se anexa al archivo `.jsonl` según llega (se serializa la cola para no desordenar).
 *  - Al parar se genera el `.gpx` completo a partir del `.jsonl`.
 *  - Si la app muere en mitad de la grabación, `recuperarPendientes()` la finaliza al reabrir.
 */
export class TrackRecorder {
  private sesion: GpsSession | null = null;
  private registro: TrackRecord | null = null;
  private ultimo: TrackPoint | null = null;
  private cola: Promise<void> = Promise.resolve();

  constructor(private readonly eventos: RecorderEvents = {}) {}

  get grabando(): boolean {
    return this.registro !== null;
  }

  get actual(): TrackRecord | null {
    return this.registro;
  }

  async iniciar(): Promise<TrackRecord> {
    if (this.registro) throw new Error('Ya hay una grabación en curso');
    const id = crypto.randomUUID();
    const registro: TrackRecord = {
      id,
      status: 'grabando',
      startedAt: Date.now(),
      pointCount: 0,
      lengthM: 0,
      jsonlPath: `${CARPETA_TRACKS}/${id}.jsonl`,
    };
    await crearArchivo(registro.jsonlPath);
    await db.tracks.put(registro);
    this.registro = registro;
    this.ultimo = null;

    try {
      this.sesion = await iniciarGps(
        (p) => this.alPunto(p),
        (e) => this.eventos.error?.(e),
      );
    } catch (e) {
      // Sin GPS no hay grabación: se deshace el registro vacío.
      this.registro = null;
      await db.tracks.delete(id);
      throw e;
    }
    return registro;
  }

  private alPunto(p: TrackPoint): void {
    const reg = this.registro;
    if (!reg) return;
    if (p.acc != null && p.acc > GPS.precisionMaximaM) return;

    if (this.ultimo) reg.lengthM += distanciaM(this.ultimo, p);
    this.ultimo = p;
    reg.pointCount += 1;
    const guardarMeta = reg.pointCount % GPS.guardarMetadatosCadaN === 0;
    const instantanea = { ...reg };

    this.cola = this.cola
      .then(async () => {
        await anexar(reg.jsonlPath, JSON.stringify(p) + '\n');
        if (guardarMeta) await db.tracks.put(instantanea);
      })
      .catch((err) => this.eventos.error?.({ code: 'ESCRITURA', message: String(err) }));

    this.eventos.punto?.(p, instantanea);
  }

  async parar(): Promise<TrackRecord> {
    const reg = this.registro;
    if (!reg) throw new Error('No hay grabación en curso');
    await this.sesion?.stop();
    this.sesion = null;
    this.registro = null;
    await this.cola; // espera a que se escriba el último punto
    return finalizarArchivo(reg, false);
  }

  /** Finaliza grabaciones que se quedaron abiertas (app cerrada/muerta). Devuelve las recuperadas. */
  async recuperarPendientes(): Promise<TrackRecord[]> {
    const abiertos = await db.tracks.where('status').equals('grabando').toArray();
    const out: TrackRecord[] = [];
    for (const reg of abiertos) {
      if (this.registro?.id === reg.id) continue;
      out.push(await finalizarArchivo(reg, true));
    }
    return out;
  }
}

async function finalizarArchivo(reg: TrackRecord, recuperado: boolean): Promise<TrackRecord> {
  const puntos = (await existe(reg.jsonlPath)) ? leerJsonl(await leerTexto(reg.jsonlPath)) : [];
  const gpxPath = `${CARPETA_TRACKS}/${reg.id}.gpx`;
  if (puntos.length > 0) {
    const nombre = `Recorrido ${new Date(reg.startedAt).toLocaleString('es-ES')}`;
    await escribirTexto(gpxPath, aGpx(puntos, nombre));
  }
  const final: TrackRecord = {
    ...reg,
    status: 'finalizado',
    endedAt: puntos.at(-1)?.t ?? Date.now(),
    pointCount: puntos.length,
    lengthM: longitudM(puntos),
    ...(puntos.length > 0 ? { gpxPath } : {}),
    ...(recuperado ? { recuperado: true } : {}),
  };
  await db.tracks.put(final);
  return final;
}

/** Puntos de un track ya guardado (para dibujarlo). */
export async function puntosDe(reg: TrackRecord): Promise<TrackPoint[]> {
  return (await existe(reg.jsonlPath)) ? leerJsonl(await leerTexto(reg.jsonlPath)) : [];
}

import { CARPETA_TRACKS, GPS } from '@/config';
import { anexar, crearArchivo, escribirTexto, existe, leerTexto } from '@/data/files/trackFiles';
import { iniciarGps, type GpsError, type GpsSession } from '@/data/gps/backgroundGps';
import { db } from '@/data/local/db';
import type { TrackPoint, TrackRecord } from '@/domain/types';
import { distanciaM, longitudM } from './geo';
import { aGpx, leerJsonl } from './gpx';

export type EstadoGrabacion = 'inactivo' | 'grabando' | 'pausado';

/** Foto del estado actual: lo que la interfaz necesita para pintarse. */
export interface Instantanea {
  estado: EstadoGrabacion;
  registro: TrackRecord | null;
  ultimo: TrackPoint | null;
}

export interface RecorderEvents {
  punto?: (p: TrackPoint, estado: TrackRecord) => void;
  error?: (e: GpsError) => void;
}

/** Todo lo que el grabador necesita del exterior (así se puede probar sin móvil). */
export interface DepsRecorder {
  iniciarGps(alPunto: (p: TrackPoint) => void, alError: (e: GpsError) => void): Promise<GpsSession>;
  crearArchivo(path: string): Promise<void>;
  anexar(path: string, texto: string): Promise<void>;
  escribirTexto(path: string, texto: string): Promise<void>;
  leerTexto(path: string): Promise<string>;
  existe(path: string): Promise<boolean>;
  guardar(reg: TrackRecord): Promise<void>;
  borrar(id: string): Promise<void>;
  abiertos(): Promise<TrackRecord[]>;
}

const depsReales: DepsRecorder = {
  iniciarGps,
  crearArchivo,
  anexar,
  escribirTexto,
  leerTexto,
  existe,
  guardar: async (r) => void (await db.tracks.put(r)),
  borrar: (id) => db.tracks.delete(id),
  abiertos: () => db.tracks.where('status').equals('grabando').toArray(),
};

/**
 * Graba un track con pausa y reanudación:
 *  - Cada punto se anexa al archivo `.jsonl` según llega (se serializa la cola para no desordenar).
 *  - Pausar PARA el GPS (ahorra batería); Reanudar lo vuelve a arrancar y abre un TRAMO nuevo,
 *    así lo que te muevas durante la pausa no se une con una línea ni suma distancia.
 *  - Al finalizar se genera el `.gpx` completo (un <trkseg> por tramo) a partir del `.jsonl`.
 *  - Si la app muere en mitad de la grabación, `recuperarPendientes()` la finaliza al reabrir.
 *  - El grabador es independiente de cualquier pantalla: cerrar un panel NO detiene la grabación.
 */
export class TrackRecorder {
  private sesion: GpsSession | null = null;
  private registro: TrackRecord | null = null;
  private _estado: EstadoGrabacion = 'inactivo';
  private ultimo: TrackPoint | null = null;
  private ultimoGuardado: TrackPoint | null = null;
  private segmento = 0;
  private cola: Promise<void> = Promise.resolve();
  private oyentes = new Set<(i: Instantanea) => void>();

  constructor(
    private readonly eventos: RecorderEvents = {},
    private readonly deps: DepsRecorder = depsReales,
  ) {}

  get estado(): EstadoGrabacion {
    return this._estado;
  }

  get instantanea(): Instantanea {
    return {
      estado: this._estado,
      registro: this.registro ? { ...this.registro } : null,
      ultimo: this.ultimoGuardado,
    };
  }

  /** Avisa de cada cambio de estado y de cada punto nuevo. Devuelve la función para darse de baja. */
  suscribir(fn: (i: Instantanea) => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  private emitir(): void {
    const i = this.instantanea;
    this.oyentes.forEach((fn) => fn(i));
  }

  private abrirGps(): Promise<GpsSession> {
    return this.deps.iniciarGps(
      (p) => this.alPunto(p),
      (e) => this.eventos.error?.(e),
    );
  }

  async iniciar(): Promise<TrackRecord> {
    if (this._estado !== 'inactivo') throw new Error('Ya hay una grabación en curso');
    const id = crypto.randomUUID();
    const registro: TrackRecord = {
      id,
      status: 'grabando',
      startedAt: Date.now(),
      pointCount: 0,
      lengthM: 0,
      jsonlPath: `${CARPETA_TRACKS}/${id}.jsonl`,
    };
    await this.deps.crearArchivo(registro.jsonlPath);
    await this.deps.guardar(registro);
    this.registro = registro;
    this.ultimo = null;
    this.ultimoGuardado = null;
    this.segmento = 0;
    this._estado = 'grabando';

    try {
      this.sesion = await this.abrirGps();
    } catch (e) {
      // Sin GPS no hay grabación: se deshace el registro vacío.
      this.registro = null;
      this._estado = 'inactivo';
      await this.deps.borrar(id);
      throw e;
    }
    this.emitir();
    return registro;
  }

  async pausar(): Promise<void> {
    if (this._estado !== 'grabando' || !this.registro) throw new Error('No hay grabación en curso');
    this._estado = 'pausado';
    await this.sesion?.stop();
    this.sesion = null;
    await this.cola; // espera a que se escriba el último punto
    await this.deps.guardar({ ...this.registro });
    this.emitir();
  }

  async reanudar(): Promise<void> {
    if (this._estado !== 'pausado' || !this.registro) throw new Error('La grabación no está en pausa');
    this.segmento += 1;
    this.ultimo = null; // el primer punto del tramo nuevo no suma distancia desde el anterior
    this._estado = 'grabando';
    try {
      this.sesion = await this.abrirGps();
    } catch (e) {
      this.segmento -= 1;
      this._estado = 'pausado'; // se queda en pausa: no se pierde nada
      throw e;
    }
    this.emitir();
  }

  async parar(): Promise<TrackRecord> {
    const reg = this.registro;
    if (!reg) throw new Error('No hay grabación en curso');
    this._estado = 'inactivo';
    await this.sesion?.stop();
    this.sesion = null;
    this.registro = null;
    await this.cola;
    const final = await finalizarArchivo(reg, false, this.deps);
    this.ultimoGuardado = null;
    this.emitir();
    return final;
  }

  private alPunto(p: TrackPoint): void {
    const reg = this.registro;
    if (!reg || this._estado !== 'grabando') return;
    if (p.acc != null && p.acc > GPS.precisionMaximaM) return;

    const punto: TrackPoint = { ...p, seg: this.segmento };
    if (this.ultimo) reg.lengthM += distanciaM(this.ultimo, punto);
    this.ultimo = punto;
    this.ultimoGuardado = punto;
    reg.pointCount += 1;
    const guardarMeta = reg.pointCount % GPS.guardarMetadatosCadaN === 0;
    const instantanea = { ...reg };

    this.cola = this.cola
      .then(async () => {
        await this.deps.anexar(reg.jsonlPath, JSON.stringify(punto) + '\n');
        if (guardarMeta) await this.deps.guardar(instantanea);
      })
      .catch((err) => this.eventos.error?.({ code: 'ESCRITURA', message: String(err) }));

    this.eventos.punto?.(punto, instantanea);
    this.emitir();
  }

  /** Finaliza grabaciones que se quedaron abiertas (app cerrada/muerta). Devuelve las recuperadas. */
  async recuperarPendientes(): Promise<TrackRecord[]> {
    const abiertos = await this.deps.abiertos();
    const out: TrackRecord[] = [];
    for (const reg of abiertos) {
      if (this.registro?.id === reg.id) continue;
      out.push(await finalizarArchivo(reg, true, this.deps));
    }
    return out;
  }
}

async function finalizarArchivo(reg: TrackRecord, recuperado: boolean, deps: DepsRecorder): Promise<TrackRecord> {
  const puntos = (await deps.existe(reg.jsonlPath)) ? leerJsonl(await deps.leerTexto(reg.jsonlPath)) : [];
  const gpxPath = `${CARPETA_TRACKS}/${reg.id}.gpx`;
  if (puntos.length > 0) {
    const nombre = `Recorrido ${new Date(reg.startedAt).toLocaleString('es-ES')}`;
    await deps.escribirTexto(gpxPath, aGpx(puntos, nombre));
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
  await deps.guardar(final);
  return final;
}

/** Puntos de un track ya guardado (para dibujarlo). */
export async function puntosDe(reg: TrackRecord): Promise<TrackPoint[]> {
  return (await existe(reg.jsonlPath)) ? leerJsonl(await leerTexto(reg.jsonlPath)) : [];
}

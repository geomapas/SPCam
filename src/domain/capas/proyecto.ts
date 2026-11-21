import type { FeatureCollection } from 'geojson';
import { leerCapasDeArchivos } from '@/data/files/importarCapa';
import { puede } from '@/domain/permisos';

/** Capa del proyecto: un archivo cargado por el usuario (SHP, GeoJSON, KML), guardado en el dispositivo. */
export interface CapaProyecto {
  id: string;
  nombre: string;
  color: string;
  visible: boolean;
  creada: number;
  nElementos: number;
}

/** Los datos (geometrías) van aparte de la ficha: la lista arranca rápido y solo se leen los datos de lo que se ve. */
export interface AlmacenProyecto {
  listar(): Promise<CapaProyecto[]>;
  leerDatos(id: string): Promise<FeatureCollection | undefined>;
  guardarNueva(capa: CapaProyecto, datos: FeatureCollection): Promise<void>;
  actualizar(id: string, cambios: Partial<Pick<CapaProyecto, 'nombre' | 'color' | 'visible'>>): Promise<void>;
  borrar(id: string): Promise<void>;
}

/** La misma paleta que GEOmapas. */
export const PALETA = ['#e06c00', '#9b27c8', '#c8270e', '#0e8ec8', '#2f6fde', '#d4a017', '#b05a00', '#666666'];

const textoError = (e: unknown): string => {
  if (e instanceof Error && e.name === 'QuotaExceededError') return 'no hay espacio suficiente en el dispositivo';
  return e instanceof Error ? e.message : String(e);
};

export class GestorProyecto {
  private _capas: CapaProyecto[] = [];
  private oyentes = new Set<() => void>();

  constructor(private readonly almacen: AlmacenProyecto) {}

  async cargar(): Promise<void> {
    try {
      this._capas = (await this.almacen.listar()).sort((a, b) => a.creada - b.creada);
    } catch (e) {
      console.warn('No se pudieron leer las capas del proyecto', e);
    }
    this.avisar();
  }

  get capas(): readonly CapaProyecto[] {
    return this._capas;
  }

  datos(id: string): Promise<FeatureCollection | undefined> {
    return this.almacen.leerDatos(id);
  }

  suscribir(fn: () => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  private avisar(): void {
    this.oyentes.forEach((fn) => fn());
  }

  async anadir(nombre: string, datos: FeatureCollection): Promise<CapaProyecto> {
    if (!puede('anadir_capas_proyecto')) throw new Error('No tienes permiso para añadir capas');
    const capa: CapaProyecto = {
      id: crypto.randomUUID(),
      nombre: nombre.trim() || 'Capa',
      color: PALETA[this._capas.length % PALETA.length]!,
      visible: true,
      creada: Date.now(),
      nElementos: datos.features.length,
    };
    await this.almacen.guardarNueva(capa, datos); // si falla (p. ej. sin espacio), no se añade nada
    this._capas = [...this._capas, capa];
    this.avisar();
    return capa;
  }

  /** Lee los archivos y añade cada capa. Un archivo que falla no impide cargar los demás. */
  async anadirArchivos(archivos: File[]): Promise<{ anadidas: CapaProyecto[]; errores: string[] }> {
    const { capas, errores } = await leerCapasDeArchivos(archivos);
    const anadidas: CapaProyecto[] = [];
    for (const c of capas) {
      try {
        anadidas.push(await this.anadir(c.nombre, c.datos));
      } catch (e) {
        errores.push(`«${c.nombre}»: ${textoError(e)}`);
      }
    }
    return { anadidas, errores };
  }

  alternarVisible(id: string, visible?: boolean): void {
    if (!puede('ver_capas_proyecto')) return;
    const c = this._capas.find((x) => x.id === id);
    if (!c) return;
    const v = visible ?? !c.visible;
    if (v === c.visible) return;
    this.cambiar(id, { visible: v });
  }

  cambiarColor(id: string, color: string): void {
    if (!puede('ver_capas_proyecto')) return;
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    this.cambiar(id, { color });
  }

  private cambiar(id: string, cambios: Partial<Pick<CapaProyecto, 'nombre' | 'color' | 'visible'>>): void {
    this._capas = this._capas.map((c) => (c.id === id ? { ...c, ...cambios } : c));
    this.avisar();
    void this.almacen.actualizar(id, cambios).catch((e) => console.warn('No se pudo guardar el cambio de la capa', e));
  }

  /** Borra la capa del dispositivo. No se puede deshacer: la interfaz pide confirmación antes. */
  async eliminar(id: string): Promise<void> {
    if (!puede('eliminar_capas_proyecto')) throw new Error('No tienes permiso para eliminar capas');
    await this.almacen.borrar(id);
    this._capas = this._capas.filter((c) => c.id !== id);
    this.avisar();
  }
}

import type { FeatureCollection } from 'geojson';
import { leerCapasDeArchivos } from '@/data/files/importarCapa';
import { exportarCapa, type FormatoExport } from '@/data/files/exportarCapa';
import { entregarArchivo } from '@/data/files/compartir';
import { OPACIDAD_RELLENO } from '@/config';
import { puede } from '@/domain/permisos';
import { nubeNoConectada, NubeNoDisponible, type FichaNube, type Nube } from './nube';

/** Capa del proyecto: un archivo cargado por el usuario (SHP, GeoJSON, KML), guardado en el dispositivo. */
export interface CapaProyecto {
  id: string;
  nombre: string;
  /** Color del borde */
  color: string;
  /** Color del relleno; si no hay, es el mismo que el borde */
  relleno?: string;
  /** Opacidad del relleno (0 a 1); sin dato = la de GEOmapas */
  opacidad?: number;
  visible: boolean;
  creada: number;
  nElementos: number;
  /** false = quitada del panel pero guardada en el dispositivo (recuperable con «Añadir capa»). Sin dato = en el panel. */
  enPanel?: boolean;
  /** Cuándo se subió a la nube por última vez. Sin dato = solo local. */
  sincronizadaEn?: number;
}

export type CambiosCapa = Partial<Omit<CapaProyecto, 'id' | 'creada' | 'nElementos'>>;

/** Los datos (geometrías) van aparte de la ficha: la lista arranca rápido y solo se leen los datos de lo que se ve. */
export interface AlmacenProyecto {
  listar(): Promise<CapaProyecto[]>;
  leerDatos(id: string): Promise<FeatureCollection | undefined>;
  guardarNueva(capa: CapaProyecto, datos: FeatureCollection): Promise<void>;
  actualizar(id: string, cambios: CambiosCapa): Promise<void>;
  borrar(id: string): Promise<void>;
}

/** La misma paleta que GEOmapas. */
export const PALETA = ['#e06c00', '#9b27c8', '#c8270e', '#0e8ec8', '#2f6fde', '#d4a017', '#b05a00', '#666666'];

const COLOR = /^#[0-9a-f]{6}$/i;

const textoError = (e: unknown): string => {
  if (e instanceof Error && e.name === 'QuotaExceededError') return 'no hay espacio suficiente en el dispositivo';
  return e instanceof Error ? e.message : String(e);
};

export const colorRelleno = (c: Pick<CapaProyecto, 'color' | 'relleno'>): string => c.relleno ?? c.color;
export const opacidadRelleno = (c: Pick<CapaProyecto, 'opacidad'>): number => c.opacidad ?? OPACIDAD_RELLENO;

export class GestorProyecto {
  private _capas: CapaProyecto[] = [];
  private oyentes = new Set<() => void>();

  constructor(
    private readonly almacen: AlmacenProyecto,
    private readonly nube: Nube = nubeNoConectada,
  ) {}

  async cargar(): Promise<void> {
    try {
      this._capas = (await this.almacen.listar()).sort((a, b) => a.creada - b.creada);
    } catch (e) {
      console.warn('No se pudieron leer las capas del proyecto', e);
    }
    this.avisar();
  }

  /** Todas las capas guardadas en el dispositivo (en el panel o no). */
  get capas(): readonly CapaProyecto[] {
    return this._capas;
  }

  /** Las que se ven en el panel (y se pueden dibujar en el mapa). */
  get capasEnPanel(): readonly CapaProyecto[] {
    return this._capas.filter((c) => c.enPanel !== false);
  }

  /** Guardadas en el dispositivo pero quitadas del panel: se recuperan con «Añadir capa». */
  get guardadas(): readonly CapaProyecto[] {
    return this._capas.filter((c) => c.enPanel === false);
  }

  get nubeDisponible(): boolean {
    return this.nube.disponible;
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
      enPanel: true,
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

  /** Cambio rápido del color del borde (el punto de color de la lista). */
  cambiarColor(id: string, color: string): void {
    if (!puede('editar_capas_proyecto') || !COLOR.test(color)) return;
    this.cambiar(id, { color, relleno: color });
  }

  /** Edición completa: nombre, color (borde y relleno) y opacidad del relleno. Devuelve false si algo no es válido. */
  editar(id: string, cambios: { nombre?: string; color?: string; relleno?: string; opacidad?: number }): boolean {
    if (!puede('editar_capas_proyecto')) return false;
    if (!this._capas.some((c) => c.id === id)) return false;
    const nuevo: CambiosCapa = {};
    if (cambios.nombre !== undefined) {
      const n = cambios.nombre.trim();
      if (!n) return false;
      nuevo.nombre = n.slice(0, 80);
    }
    if (cambios.color !== undefined) {
      if (!COLOR.test(cambios.color)) return false;
      nuevo.color = cambios.color;
      nuevo.relleno = cambios.color; // un solo color por capa: el relleno sigue al borde (la opacidad se ajusta aparte)
    }
    if (cambios.relleno !== undefined) {
      if (!COLOR.test(cambios.relleno)) return false;
      nuevo.relleno = cambios.relleno;
    }
    if (cambios.opacidad !== undefined) {
      if (!Number.isFinite(cambios.opacidad)) return false;
      nuevo.opacidad = Math.min(1, Math.max(0, Math.round(cambios.opacidad * 100) / 100));
    }
    this.cambiar(id, nuevo);
    return true;
  }

  /** Quita la capa del panel y del mapa, pero la conserva en el dispositivo: se puede recuperar con «Añadir capa». */
  quitarDelPanel(id: string): void {
    if (!puede('eliminar_capas_proyecto')) return;
    this.cambiar(id, { enPanel: false });
  }

  /** Vuelve a poner en el panel una capa guardada (y la hace visible). */
  ponerEnPanel(id: string): void {
    if (!puede('anadir_capas_proyecto')) return;
    this.cambiar(id, { enPanel: true, visible: true });
  }

  private cambiar(id: string, cambios: CambiosCapa): void {
    this._capas = this._capas.map((c) => (c.id === id ? { ...c, ...cambios } : c));
    this.avisar();
    void this.almacen.actualizar(id, cambios).catch((e) => console.warn('No se pudo guardar el cambio de la capa', e));
  }

  /** Borra la capa del dispositivo para siempre. La interfaz pide confirmación antes. */
  async eliminar(id: string): Promise<void> {
    if (!puede('eliminar_capas_proyecto')) throw new Error('No tienes permiso para eliminar capas');
    await this.almacen.borrar(id);
    this._capas = this._capas.filter((c) => c.id !== id);
    this.avisar();
  }

  // ── descargar y compartir ──

  /** Exporta la capa (KML, SHP o XLSX). En el móvil abre «compartir»; en el navegador descarga el archivo. */
  async descargar(id: string, formato: FormatoExport): Promise<'compartido' | 'descargado'> {
    if (!puede('descargar_capas_proyecto')) throw new Error('No tienes permiso para descargar capas');
    const capa = this._capas.find((c) => c.id === id);
    if (!capa) throw new Error('La capa ya no existe');
    const datos = await this.almacen.leerDatos(id);
    if (!datos) throw new Error('No se encontraron los datos de la capa');
    const archivo = exportarCapa(formato, capa.nombre, datos);
    return entregarArchivo(archivo.nombre, archivo.bytes, archivo.mime, capa.nombre);
  }

  // ── nube ──

  /** Sube la capa a la nube para tenerla a salvo. Lanza NubeNoDisponible mientras no esté conectada. */
  async sincronizar(id: string): Promise<void> {
    if (!puede('sincronizar_capas_proyecto')) throw new Error('No tienes permiso para sincronizar capas');
    if (!this.nube.disponible) throw new NubeNoDisponible();
    const capa = this._capas.find((c) => c.id === id);
    const datos = capa ? await this.almacen.leerDatos(id) : undefined;
    if (!capa || !datos) throw new Error('No se encontraron los datos de la capa');
    await this.nube.subir(capa, datos);
    this.cambiar(id, { sincronizadaEn: Date.now() });
  }

  async compartirCon(id: string, correos: string[]): Promise<void> {
    if (!puede('compartir_capas_proyecto')) throw new Error('No tienes permiso para compartir capas');
    if (!this.nube.disponible) throw new NubeNoDisponible();
    const capa = this._capas.find((c) => c.id === id);
    if (!capa) throw new Error('La capa ya no existe');
    await this.nube.compartirCon(correos, capa);
  }

  /** Capas que están en la nube y no en este dispositivo. */
  async listarEnNube(): Promise<FichaNube[]> {
    if (!this.nube.disponible) return [];
    const locales = new Set(this._capas.map((c) => c.id));
    return (await this.nube.listar()).filter((f) => !locales.has(f.id));
  }

  /** Descarga una capa de la nube, la guarda en el dispositivo y la pone en el panel. */
  async recuperarDeNube(id: string): Promise<CapaProyecto> {
    if (!puede('anadir_capas_proyecto')) throw new Error('No tienes permiso para añadir capas');
    const { capa, datos } = await this.nube.descargar(id);
    const nueva: CapaProyecto = { ...capa, enPanel: true, visible: true, sincronizadaEn: Date.now() };
    await this.almacen.guardarNueva(nueva, datos);
    this._capas = [...this._capas, nueva];
    this.avisar();
    return nueva;
  }
}

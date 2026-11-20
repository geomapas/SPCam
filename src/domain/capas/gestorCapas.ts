import { puede } from '@/domain/permisos';
import { BASE_POR_DEFECTO, CAPAS_TEMATICAS, MAPAS_BASE } from './catalogo';

/** Dónde se guardan las preferencias (la implementación real vive en la capa de datos). */
export interface Almacen {
  leer(clave: string): Promise<unknown>;
  guardar(clave: string, valor: unknown): Promise<void>;
}

export interface EstadoCapas {
  base: string;
  activas: string[];
}

const CLAVE_BASE = 'mapa.base';
const CLAVE_ACTIVAS = 'mapa.capasActivas';

/** Estado de qué mapa base y qué capas temáticas están activos. No sabe nada de Leaflet. */
export class GestorCapas {
  private base = BASE_POR_DEFECTO;
  private activas = new Set<string>(
    CAPAS_TEMATICAS.filter((c) => c.visiblePorDefecto).map((c) => c.id),
  );
  private oyentes = new Set<(e: EstadoCapas) => void>();

  constructor(private readonly almacen: Almacen) {}

  /** Recupera lo guardado; ignora ids que ya no existan en el catálogo. */
  async cargar(): Promise<void> {
    try {
      const b = await this.almacen.leer(CLAVE_BASE);
      if (typeof b === 'string' && MAPAS_BASE.some((m) => m.id === b)) this.base = b;

      const a = await this.almacen.leer(CLAVE_ACTIVAS);
      if (Array.isArray(a)) {
        const validas = a.filter(
          (id): id is string => typeof id === 'string' && CAPAS_TEMATICAS.some((c) => c.id === id),
        );
        this.activas = new Set(validas);
      }
    } catch (e) {
      console.warn('No se pudieron leer las preferencias del mapa', e);
    }
  }

  get estado(): EstadoCapas {
    return { base: this.base, activas: [...this.activas] };
  }

  suscribir(fn: (e: EstadoCapas) => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  cambiarBase(id: string): boolean {
    if (!puede('cambiar_mapa_base')) return false;
    if (!MAPAS_BASE.some((m) => m.id === id) || id === this.base) return false;
    this.base = id;
    this.avisarYGuardar();
    return true;
  }

  alternarCapa(id: string, activa?: boolean): boolean {
    if (!puede('ver_capas_tematicas')) return false;
    if (!CAPAS_TEMATICAS.some((c) => c.id === id)) return false;
    const quiere = activa ?? !this.activas.has(id);
    if (quiere === this.activas.has(id)) return false;
    if (quiere) this.activas.add(id);
    else this.activas.delete(id);
    this.avisarYGuardar();
    return true;
  }

  private avisarYGuardar(): void {
    const e = this.estado;
    this.oyentes.forEach((fn) => fn(e));
    // Guardado "lo mejor posible": un fallo no debe romper el mapa.
    void Promise.all([
      this.almacen.guardar(CLAVE_BASE, e.base),
      this.almacen.guardar(CLAVE_ACTIVAS, e.activas),
    ]).catch((err) => console.warn('No se pudieron guardar las preferencias del mapa', err));
  }
}

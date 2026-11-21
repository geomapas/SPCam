/**
 * Catálogo de cartografía: mapas base y capas temáticas, definidos como DATOS.
 * Añadir o quitar una capa = tocar solo este archivo (y su permiso, si procede).
 *
 * OJO con el uso offline: antes de guardar teselas de cualquier fuente en el móvil hay que
 * comprobar sus condiciones de uso (las teselas de Google NO se pueden guardar).
 */
export interface FuenteWms {
  tipo: 'wms';
  url: string;
  capas: string;
  formato: 'image/png' | 'image/jpeg';
  transparente: boolean;
  version: '1.1.1' | '1.3.0';
  mayusculas: boolean;
  minZoom?: number;
  maxZoom: number;
  maxNativeZoom: number;
  /** clase CSS con el filtro de color (ver estilos.css) */
  claseCss?: string;
  atribucion: string;
}

export interface FuenteXyz {
  tipo: 'xyz';
  url: string;
  maxZoom: number;
  maxNativeZoom: number;
  atribucion: string;
}

export type Fuente = FuenteWms | FuenteXyz;

export type IconoBase = 'satelite' | 'mapa';

export interface MapaBase {
  id: string;
  nombre: string;
  icono: IconoBase;
  fuente: Fuente;
}

export interface CapaTematica {
  id: string;
  nombre: string;
  /** color de la muestra junto al nombre */
  color: string;
  visiblePorDefecto: boolean;
  fuente: FuenteWms;
}

export const MAPAS_BASE: readonly MapaBase[] = [
  {
    id: 'ortofoto',
    nombre: 'Ortofoto',
    icono: 'satelite',
    // Ortofoto 2024 de la Junta de CLM (misma fuente que GEOmapas). Selector de año: pendiente.
    fuente: {
      tipo: 'wms',
      url: 'https://geoservicios.castillalamancha.es/arcgis/services/Raster/ortofoto_2024/MapServer/WMSServer',
      capas: '0',
      formato: 'image/jpeg',
      transparente: false,
      version: '1.1.1',
      mayusculas: true,
      maxZoom: 21,
      maxNativeZoom: 19,
      atribucion: 'Ortofoto 2024 · Junta de Comunidades de Castilla-La Mancha',
    },
  },
  {
    id: 'topografico',
    nombre: 'Topográfico',
    icono: 'mapa',
    // PROVISIONAL: OpenStreetMap estándar. Sustituible por una fuente topográfica oficial.
    fuente: {
      tipo: 'xyz',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 21,
      maxNativeZoom: 19,
      atribucion: '© OpenStreetMap',
    },
  },
];

export const BASE_POR_DEFECTO = 'ortofoto';

/** Capas precargadas. Por ahora solo los recintos SIGPAC; para añadir otra, basta una entrada más aquí. */
export const CAPAS_TEMATICAS: readonly CapaTematica[] = [
  {
    id: 'recintos',
    nombre: 'Recintos SIGPAC',
    color: '#ff00ff',
    visiblePorDefecto: true,
    fuente: {
      tipo: 'wms',
      url: 'https://geoservicios.castillalamancha.es/arcgis/services/Vector/Recintos_sigpac/MapServer/WMSServer',
      capas: '0',
      formato: 'image/png',
      transparente: true,
      version: '1.1.1',
      mayusculas: true,
      minZoom: 14,
      maxZoom: 21,
      maxNativeZoom: 20,
      claseCss: 'capa-recintos',
      atribucion: 'SIGPAC · Junta de Comunidades de Castilla-La Mancha',
    },
  },
];

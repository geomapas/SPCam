// shpjs no trae tipos propios.
declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  type Entrada =
    | ArrayBuffer
    | ArrayBufferView
    | { shp: ArrayBuffer; dbf?: ArrayBuffer; cpg?: ArrayBuffer | string; prj?: ArrayBuffer | string };
  /** Un .zip con varias capas devuelve un array de colecciones. */
  export default function shp(entrada: Entrada): Promise<FeatureCollection | FeatureCollection[]>;
}

import type { Feature, FeatureCollection, Geometry } from 'geojson';

/** Capa leída de un archivo, lista para guardar. */
export interface CapaLeida {
  nombre: string;
  datos: FeatureCollection;
}

export interface ResultadoLectura {
  capas: CapaLeida[];
  /** Mensajes para el usuario: un archivo que falla no impide cargar los demás. */
  errores: string[];
}

const MAX_BYTES = 100 * 1024 * 1024;

const ext = (n: string) => n.toLowerCase().split('.').pop() ?? '';
const base = (n: string) => n.replace(/\.[^./\\]+$/, '');

/** Recorre hasta `limite` posiciones y comprueba que parezcan grados (lon ±180, lat ±90). */
function fueraDeRango(fc: FeatureCollection, limite = 5000): boolean {
  let n = 0;
  const visitar = (c: unknown): boolean => {
    if (!Array.isArray(c) || n > limite) return false;
    if (typeof c[0] === 'number') {
      n++;
      const [lon, lat] = c as number[];
      return Math.abs(lon!) > 180 || Math.abs(lat!) > 90;
    }
    return c.some(visitar);
  };
  for (const f of fc.features) {
    const g = f.geometry as { coordinates?: unknown } | null;
    if (g && 'coordinates' in g && visitar(g.coordinates)) return true;
    if (n > limite) break;
  }
  return false;
}

/** Deja una FeatureCollection limpia: solo geometrías válidas y un identificador estable por elemento. */
function normalizar(entrada: unknown): FeatureCollection {
  const o = entrada as { type?: string; features?: Feature[]; geometry?: Geometry };
  let feats: Feature[];
  if (o?.type === 'FeatureCollection' && Array.isArray(o.features)) feats = o.features;
  else if (o?.type === 'Feature') feats = [o as unknown as Feature];
  else if (typeof o?.type === 'string' && 'coordinates' in (o as object))
    feats = [{ type: 'Feature', geometry: o as unknown as Geometry, properties: {} }];
  else throw new Error('no contiene geometrías reconocibles');

  const validas = feats.filter((f) => f && f.geometry);
  if (validas.length === 0) throw new Error('no contiene ningún elemento con geometría');
  for (const f of validas) {
    f.properties = f.properties ?? {};
    // Identificador estable (no cambia aunque se reordene o se borre otro elemento). Lo usará el checklist.
    if (!f.properties.__gid) f.properties.__gid = 'g' + crypto.randomUUID().slice(0, 8);
  }
  const fc: FeatureCollection = { type: 'FeatureCollection', features: validas };
  if (fueraDeRango(fc))
    throw new Error('las coordenadas no están en grados. Si es un SHP, incluye también el archivo .prj');
  return fc;
}

async function deZip(buffer: ArrayBuffer, nombre: string): Promise<CapaLeida[]> {
  const { default: shp } = await import('shpjs');
  const r = await shp(buffer);
  const lista = Array.isArray(r) ? r : [r];
  return lista.map((fc) => {
    const interno = (fc as { fileName?: string }).fileName;
    return {
      nombre: lista.length > 1 && interno ? `${nombre} · ${interno}` : nombre,
      datos: normalizar(fc),
    };
  });
}

async function deKml(texto: string): Promise<FeatureCollection> {
  const { kml } = await import('@tmcw/togeojson');
  const doc = new DOMParser().parseFromString(texto, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('el KML no es válido');
  return normalizar(kml(doc));
}

/**
 * Lee archivos de capas: SHP (.zip, o .shp + .dbf + .prj sueltos), GeoJSON y KML.
 * Cada archivo se procesa por separado: si uno falla, el resto se carga igualmente.
 */
export async function leerCapasDeArchivos(archivos: File[]): Promise<ResultadoLectura> {
  const capas: CapaLeida[] = [];
  const errores: string[] = [];
  const intentar = async (nombre: string, fn: () => Promise<CapaLeida[]>) => {
    try {
      capas.push(...(await fn()));
    } catch (e) {
      errores.push(`«${nombre}»: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const sueltos = new Map<string, Record<string, File>>(); // SHP suelto agrupado por nombre base
  for (const f of archivos) {
    if (f.size > MAX_BYTES) {
      errores.push(`«${f.name}»: supera los 100 MB`);
      continue;
    }
    const e = ext(f.name);
    if (e === 'zip') {
      await intentar(f.name, async () => deZip(await f.arrayBuffer(), base(f.name)));
    } else if (e === 'geojson' || e === 'json') {
      await intentar(f.name, async () => [{ nombre: base(f.name), datos: normalizar(JSON.parse(await f.text())) }]);
    } else if (e === 'kml') {
      await intentar(f.name, async () => [{ nombre: base(f.name), datos: await deKml(await f.text()) }]);
    } else if (e === 'kmz') {
      errores.push(`«${f.name}»: el KMZ aún no está soportado; descomprímelo y carga el .kml`);
    } else if (['shp', 'dbf', 'shx', 'prj', 'cpg'].includes(e)) {
      const k = base(f.name);
      sueltos.set(k, { ...(sueltos.get(k) ?? {}), [e]: f });
    } else {
      errores.push(`«${f.name}»: formato no admitido`);
    }
  }

  for (const [nombre, partes] of sueltos) {
    if (!partes.shp) {
      errores.push(`«${nombre}»: falta el archivo .shp`);
      continue;
    }
    await intentar(nombre, async () => {
      const { default: shp } = await import('shpjs');
      const r = await shp({
        shp: await partes.shp!.arrayBuffer(),
        ...(partes.dbf ? { dbf: await partes.dbf.arrayBuffer() } : {}),
        ...(partes.cpg ? { cpg: await partes.cpg.text() } : {}),
        ...(partes.prj ? { prj: await partes.prj.text() } : {}),
      });
      const fc = Array.isArray(r) ? r[0]! : r;
      return [{ nombre, datos: normalizar(fc) }];
    });
  }
  return { capas, errores };
}

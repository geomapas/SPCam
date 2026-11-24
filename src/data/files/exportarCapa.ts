import { strToU8, zipSync } from 'fflate';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { toKML } from '@placemarkio/tokml';

export type FormatoExport = 'kml' | 'shp' | 'xlsx';

export interface ArchivoExportado {
  nombre: string;
  bytes: Uint8Array;
  mime: string;
}

const MIME_ZIP = 'application/zip';
const MIME_KML = 'application/vnd.google-earth.kml+xml';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const nombreSeguro = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 60) || 'capa';

/** Quita los campos internos (__gid…): no tienen sentido fuera de la app. */
function limpiar(fc: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: Object.fromEntries(Object.entries(f.properties ?? {}).filter(([k]) => !k.startsWith('__'))),
    })),
  };
}

/** Exporta una capa a KML, SHP (zip) o XLSX. */
export function exportarCapa(formato: FormatoExport, nombre: string, datos: FeatureCollection): ArchivoExportado {
  const base = nombreSeguro(nombre);
  const fc = limpiar(datos);
  if (formato === 'kml') return { nombre: `${base}.kml`, bytes: strToU8(toKML(fc)), mime: MIME_KML };
  if (formato === 'shp') return { nombre: `${base}.zip`, bytes: generarShpZip(base, fc), mime: MIME_ZIP };
  return { nombre: `${base}.xlsx`, bytes: generarXlsx(fc), mime: MIME_XLSX };
}

/* ════════════════════════════════════════════════════════════════
   SHAPEFILE (.shp .shx .dbf .prj .cpg), escrito a mano a partir del escritor de GEOmapas.
   Mejoras respecto al original: una capa con geometrías mezcladas se divide en un shapefile por tipo,
   los multipuntos se reparten en filas para que SHP y DBF coincidan, los anillos se orientan como
   exige el formato, los campos numéricos son numéricos y se añade .cpg para que los acentos se lean bien.
   ════════════════════════════════════════════════════════════════ */

const PRJ_WGS84 =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

type Familia = 'puntos' | 'lineas' | 'poligonos';
type Pos = number[];
interface Bbox { xMin: number; yMin: number; xMax: number; yMax: number }

const FAMILIA: Record<string, Familia> = {
  Point: 'puntos', MultiPoint: 'puntos',
  LineString: 'lineas', MultiLineString: 'lineas',
  Polygon: 'poligonos', MultiPolygon: 'poligonos',
};
const TIPO_SHP: Record<Familia, number> = { puntos: 1, lineas: 3, poligonos: 5 };

function generarShpZip(base: string, fc: FeatureCollection): Uint8Array {
  const grupos: Record<Familia, Feature[]> = { puntos: [], lineas: [], poligonos: [] };
  for (const f of fc.features) {
    const fam = f.geometry ? FAMILIA[f.geometry.type] : undefined;
    if (fam) grupos[fam].push(f);
  }
  const usadas = (Object.keys(grupos) as Familia[]).filter((k) => grupos[k].length > 0);
  if (usadas.length === 0) throw new Error('La capa no tiene geometrías que se puedan exportar a SHP');

  const archivos: Record<string, Uint8Array> = {};
  for (const fam of usadas) {
    const nombre = usadas.length > 1 ? `${base}_${fam}` : base;
    const feats = fam === 'puntos' ? repartirMultipuntos(grupos[fam]) : grupos[fam];
    const { shp, shx } = construirShpShx(feats, fam);
    archivos[`${nombre}.shp`] = shp;
    archivos[`${nombre}.shx`] = shx;
    archivos[`${nombre}.dbf`] = construirDbf(feats);
    archivos[`${nombre}.prj`] = strToU8(PRJ_WGS84);
    archivos[`${nombre}.cpg`] = strToU8('UTF-8');
  }
  return zipSync(archivos, { level: 6 });
}

/** Un registro SHP por punto: los MultiPoint se reparten en varios elementos con los mismos atributos. */
function repartirMultipuntos(feats: Feature[]): Feature[] {
  return feats.flatMap((f) => {
    const g = f.geometry as Geometry;
    if (g.type !== 'MultiPoint') return [f];
    return g.coordinates.map((c): Feature => ({ type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: c } }));
  });
}

const areaFirmada = (anillo: Pos[]): number => {
  let s = 0;
  for (let i = 0; i < anillo.length - 1; i++) s += anillo[i]![0]! * anillo[i + 1]![1]! - anillo[i + 1]![0]! * anillo[i]![1]!;
  return s / 2;
};

/** Shapefile: anillo exterior en sentido horario, huecos en antihorario. */
function anillosPoligono(g: Geometry): Pos[][] {
  const polis = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
  return polis.flatMap((p) =>
    p.map((anillo, i) => {
      const horario = areaFirmada(anillo as Pos[]) < 0;
      const quiereHorario = i === 0;
      return horario === quiereHorario ? (anillo as Pos[]) : [...(anillo as Pos[])].reverse();
    }),
  );
}

const partesLinea = (g: Geometry): Pos[][] =>
  g.type === 'MultiLineString' ? (g.coordinates as Pos[][]) : g.type === 'LineString' ? [g.coordinates as Pos[]] : [];

function bboxDe(puntos: Pos[]): Bbox {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const [x, y] of puntos) {
    if (x! < xMin) xMin = x!;
    if (x! > xMax) xMax = x!;
    if (y! < yMin) yMin = y!;
    if (y! > yMax) yMax = y!;
  }
  return { xMin, yMin, xMax, yMax };
}

const unir = (a: Bbox, b: Bbox): Bbox => ({
  xMin: Math.min(a.xMin, b.xMin), yMin: Math.min(a.yMin, b.yMin),
  xMax: Math.max(a.xMax, b.xMax), yMax: Math.max(a.yMax, b.yMax),
});

function cabeceraShp(dv: DataView, longitudPalabras: number, tipo: number, b: Bbox): void {
  dv.setInt32(0, 9994, false);
  dv.setInt32(24, longitudPalabras, false);
  dv.setInt32(28, 1000, true);
  dv.setInt32(32, tipo, true);
  dv.setFloat64(36, b.xMin, true);
  dv.setFloat64(44, b.yMin, true);
  dv.setFloat64(52, b.xMax, true);
  dv.setFloat64(60, b.yMax, true);
}

function construirShpShx(feats: Feature[], fam: Familia): { shp: Uint8Array; shx: Uint8Array } {
  const tipo = TIPO_SHP[fam];
  // Contenido de cada registro (sin su cabecera de 8 bytes) y su caja
  const regs: { contenido: Uint8Array; bbox: Bbox }[] = [];

  for (const f of feats) {
    const g = f.geometry as Geometry;
    if (fam === 'puntos') {
      const c = (g as { coordinates: Pos }).coordinates;
      const buf = new ArrayBuffer(20);
      const dv = new DataView(buf);
      dv.setInt32(0, 1, true);
      dv.setFloat64(4, c[0]!, true);
      dv.setFloat64(12, c[1]!, true);
      regs.push({ contenido: new Uint8Array(buf), bbox: { xMin: c[0]!, yMin: c[1]!, xMax: c[0]!, yMax: c[1]! } });
      continue;
    }
    const partes = fam === 'lineas' ? partesLinea(g) : anillosPoligono(g);
    const nPuntos = partes.reduce((s, p) => s + p.length, 0);
    const buf = new ArrayBuffer(4 + 32 + 4 + 4 + partes.length * 4 + nPuntos * 16);
    const dv = new DataView(buf);
    const bbox = partes.map(bboxDe).reduce(unir);
    dv.setInt32(0, tipo, true);
    dv.setFloat64(4, bbox.xMin, true);
    dv.setFloat64(12, bbox.yMin, true);
    dv.setFloat64(20, bbox.xMax, true);
    dv.setFloat64(28, bbox.yMax, true);
    dv.setInt32(36, partes.length, true);
    dv.setInt32(40, nPuntos, true);
    let off = 0;
    partes.forEach((p, i) => {
      dv.setInt32(44 + i * 4, off, true);
      off += p.length;
    });
    let pos = 44 + partes.length * 4;
    for (const p of partes) for (const [x, y] of p) {
      dv.setFloat64(pos, x!, true);
      dv.setFloat64(pos + 8, y!, true);
      pos += 16;
    }
    regs.push({ contenido: new Uint8Array(buf), bbox });
  }

  const bytesShp = 100 + regs.reduce((s, r) => s + 8 + r.contenido.length, 0);
  const bytesShx = 100 + regs.length * 8;
  const shp = new Uint8Array(bytesShp);
  const shx = new Uint8Array(bytesShx);
  const dvShp = new DataView(shp.buffer);
  const dvShx = new DataView(shx.buffer);
  const caja = regs.length ? regs.map((r) => r.bbox).reduce(unir) : { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  cabeceraShp(dvShp, bytesShp / 2, tipo, caja);
  cabeceraShp(dvShx, bytesShx / 2, tipo, caja);

  let offShp = 100;
  let offShx = 100;
  regs.forEach((r, i) => {
    const palabras = r.contenido.length / 2;
    dvShp.setInt32(offShp, i + 1, false);
    dvShp.setInt32(offShp + 4, palabras, false);
    shp.set(r.contenido, offShp + 8);
    dvShx.setInt32(offShx, offShp / 2, false);
    dvShx.setInt32(offShx + 4, palabras, false);
    offShp += 8 + r.contenido.length;
    offShx += 8;
  });
  return { shp, shx };
}

interface CampoDbf { clave: string; nombre: string; tipo: 'C' | 'N'; largo: number; decimales: number }

const claves = (feats: Feature[]): string[] => {
  const s = new Set<string>();
  for (const f of feats) for (const k of Object.keys(f.properties ?? {})) if (!k.startsWith('__')) s.add(k);
  return [...s];
};

const textoValor = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

function definirCampos(feats: Feature[]): CampoDbf[] {
  const usados = new Set<string>();
  return claves(feats).map((clave) => {
    // Nombre DBF: ASCII, mayúsculas, máximo 10 caracteres y sin repetir
    let nombre = clave.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase().slice(0, 10) || 'CAMPO';
    for (let n = 1; usados.has(nombre); n++) nombre = nombre.slice(0, 10 - String(n).length) + n;
    usados.add(nombre);

    const valores = feats.map((f) => (f.properties ?? {})[clave]).filter((v) => v !== null && v !== undefined && v !== '');
    const numerico = valores.length > 0 && valores.every((v) => typeof v === 'number' && Number.isFinite(v));
    if (numerico) {
      const dec = Math.min(8, Math.max(0, ...valores.map((v) => (String(v).split('.')[1] ?? '').length)));
      const largo = Math.max(...valores.map((v) => (v as number).toFixed(dec).length));
      if (largo <= 19) return { clave, nombre, tipo: 'N', largo: Math.max(largo, 1), decimales: dec };
    }
    const enc = new TextEncoder();
    const largo = Math.min(254, Math.max(1, ...feats.map((f) => enc.encode(textoValor((f.properties ?? {})[clave])).length)));
    return { clave, nombre, tipo: 'C', largo, decimales: 0 };
  });
}

function construirDbf(feats: Feature[]): Uint8Array {
  const campos = definirCampos(feats);
  const tamRegistro = 1 + campos.reduce((s, c) => s + c.largo, 0);
  const tamCabecera = 32 + campos.length * 32 + 1;
  const out = new Uint8Array(tamCabecera + feats.length * tamRegistro + 1);
  const dv = new DataView(out.buffer);
  const hoy = new Date();
  out[0] = 3;
  out[1] = hoy.getFullYear() - 1900;
  out[2] = hoy.getMonth() + 1;
  out[3] = hoy.getDate();
  dv.setUint32(4, feats.length, true);
  dv.setUint16(8, tamCabecera, true);
  dv.setUint16(10, tamRegistro, true);

  const enc = new TextEncoder();
  campos.forEach((c, i) => {
    const o = 32 + i * 32;
    out.set(enc.encode(c.nombre), o);
    out[o + 11] = c.tipo.charCodeAt(0);
    out[o + 16] = c.largo;
    out[o + 17] = c.decimales;
  });
  out[32 + campos.length * 32] = 0x0d;

  let p = tamCabecera;
  for (const f of feats) {
    out[p++] = 0x20;
    for (const c of campos) {
      const v = (f.properties ?? {})[c.clave];
      let texto: string;
      if (c.tipo === 'N') texto = typeof v === 'number' && Number.isFinite(v) ? v.toFixed(c.decimales).padStart(c.largo, ' ') : '';
      else texto = textoValor(v);
      let bytes = enc.encode(texto);
      if (bytes.length > c.largo) {
        // Recorta sin partir un carácter UTF-8 por la mitad
        let n = c.largo;
        while (n > 0 && (bytes[n]! & 0xc0) === 0x80) n--;
        bytes = bytes.subarray(0, n);
      }
      out.fill(0x20, p, p + c.largo);
      out.set(bytes, p);
      p += c.largo;
    }
  }
  out[p] = 0x1a;
  return out;
}

/* ════════════════════════════════════════════════════════════════
   XLSX mínimo (una hoja con los atributos). Se escribe a mano para no depender de una librería pesada.
   ════════════════════════════════════════════════════════════════ */

const xml = (t: string) =>
  t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function letraColumna(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function generarXlsx(fc: FeatureCollection): Uint8Array {
  const cols = claves(fc.features);
  const celdaTexto = (ref: string, t: string, estilo = 0) =>
    `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${xml(t.slice(0, 32000))}</t></is></c>`;

  const filas: string[] = [];
  filas.push(`<row r="1">${cols.map((c, i) => celdaTexto(`${letraColumna(i)}1`, c, 1)).join('')}</row>`);
  fc.features.forEach((f, r) => {
    const fila = r + 2;
    const celdas = cols.map((c, i) => {
      const v = (f.properties ?? {})[c];
      const ref = `${letraColumna(i)}${fila}`;
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return celdaTexto(ref, textoValor(v));
    });
    filas.push(`<row r="${fila}">${celdas.join('')}</row>`);
  });

  const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const hoja =
    `${cab}<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols><col min="1" max="${Math.max(cols.length, 1)}" width="18" customWidth="1"/></cols>` +
    `<sheetData>${filas.join('')}</sheetData></worksheet>`;

  return zipSync({
    '[Content_Types].xml': strToU8(
      `${cab}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${cab}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(
      `${cab}<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
        `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
        `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
        `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
        `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
        `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(hoja),
  });
}

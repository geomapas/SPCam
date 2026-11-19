import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const DIR = Directory.Data;

/** Crea (o vacía) un archivo, creando carpetas intermedias. */
export async function crearArchivo(path: string): Promise<void> {
  await Filesystem.writeFile({ path, data: '', directory: DIR, encoding: Encoding.UTF8, recursive: true });
}

/** Añade texto al final. Cada punto se escribe según llega: no se pierde si Android mata la app. */
export async function anexar(path: string, texto: string): Promise<void> {
  await Filesystem.appendFile({ path, data: texto, directory: DIR, encoding: Encoding.UTF8 });
}

export async function escribirTexto(path: string, texto: string): Promise<void> {
  await Filesystem.writeFile({ path, data: texto, directory: DIR, encoding: Encoding.UTF8, recursive: true });
}

export async function leerTexto(path: string): Promise<string> {
  const r = await Filesystem.readFile({ path, directory: DIR, encoding: Encoding.UTF8 });
  return typeof r.data === 'string' ? r.data : await r.data.text();
}

export async function existe(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: DIR });
    return true;
  } catch {
    return false;
  }
}

/** URI nativa (file://...) para compartir o mostrar al usuario. */
export async function uriDe(path: string): Promise<string> {
  const r = await Filesystem.getUri({ path, directory: DIR });
  return r.uri;
}

/**
 * Copia un archivo de Data a Cache y devuelve su URI. Se usa para compartir:
 * el FileProvider que genera Capacitor solo expone cache y almacenamiento externo,
 * no la carpeta interna de datos.
 */
export async function copiarACacheParaCompartir(path: string, nombre: string): Promise<string> {
  try {
    await Filesystem.deleteFile({ path: nombre, directory: Directory.Cache });
  } catch {
    /* no existía */
  }
  await Filesystem.copy({ from: path, directory: DIR, to: nombre, toDirectory: Directory.Cache });
  const r = await Filesystem.getUri({ path: nombre, directory: Directory.Cache });
  return r.uri;
}

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { copiarACacheParaCompartir } from './trackFiles';

/** Comparte un archivo con otras apps. Solo en el móvil; en el navegador devuelve false. */
export async function compartirArchivo(path: string, nombre: string, titulo: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await Share.share({ title: titulo, url: await copiarACacheParaCompartir(path, nombre) });
  return true;
}

function aBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Entrega un archivo generado por la app.
 * - En el móvil: lo guarda en la caché y abre «compartir» (Drive, WhatsApp, Archivos…). Desde ahí se guarda donde se quiera.
 * - En el navegador: descarga directa.
 */
export async function entregarArchivo(
  nombre: string,
  bytes: Uint8Array,
  mime: string,
  titulo: string,
): Promise<'compartido' | 'descargado'> {
  if (Capacitor.isNativePlatform()) {
    const ruta = `exportaciones/${nombre}`;
    await Filesystem.writeFile({ path: ruta, data: aBase64(bytes), directory: Directory.Cache, recursive: true });
    const { uri } = await Filesystem.getUri({ path: ruta, directory: Directory.Cache });
    try {
      await Share.share({ title: titulo, url: uri });
    } catch (e) {
      // Cerrar el diálogo sin elegir nada no es un error
      if (!/cancel/i.test(e instanceof Error ? e.message : String(e))) throw e;
    }
    return 'compartido';
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'descargado';
}

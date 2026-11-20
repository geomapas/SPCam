import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { copiarACacheParaCompartir } from './trackFiles';

/** Comparte un archivo con otras apps. Solo en el móvil; en el navegador devuelve false. */
export async function compartirArchivo(path: string, nombre: string, titulo: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await Share.share({ title: titulo, url: await copiarACacheParaCompartir(path, nombre) });
  return true;
}

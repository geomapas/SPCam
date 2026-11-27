import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));
const ruta = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Dos destinos de build desde el mismo repositorio:
 *   --mode tecnico  → app Android (Capacitor). Salida: dist/tecnico. Sin Service Worker:
 *                     los archivos viajan dentro del APK.
 *   --mode gestor   → web con conexión (GitHub Pages / Firebase Hosting). Salida: dist/gestor.
 *                     Con vite-plugin-pwa (Workbox genera la lista de caché con hashes).
 */
export default defineConfig(({ mode }) => {
  const destino = mode === 'gestor' ? 'gestor' : 'tecnico';

  return {
    root: ruta(`./src/ui/${destino}`),
    envDir: raiz,
    publicDir: ruta('./public'),
    // Capacitor necesita rutas relativas. El gestor admite subcarpeta (GitHub Pages):
    //   BASE_PATH=/mi-repo/ npm run build:gestor
    base: destino === 'gestor' ? (process.env.BASE_PATH ?? '/') : './',
    resolve: { alias: { '@': ruta('./src') } },
    define: { __DESTINO__: JSON.stringify(destino) },
    build: {
      outDir: ruta(`./dist/${destino}`),
      emptyOutDir: true,
      target: 'es2020',
      sourcemap: true,
    },
    plugins:
      destino === 'gestor'
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: 'auto',
              workbox: {
                // Evita el problema de GEOmapas (versiones viejas): precaché con hashes,
                // el SW nuevo toma el control y limpia cachés antiguas.
                clientsClaim: true,
                skipWaiting: true,
                cleanupOutdatedCaches: true,
                navigateFallback: 'index.html',
                // La vista previa del técnico vive en /tecnico/ dentro del mismo sitio (GitHub Pages).
                // Sin esto, el Service Worker del gestor serviría SU index.html también ahí.
                navigateFallbackDenylist: [/\/tecnico\//],
              },
              manifest: {
                name: 'SPCam · Gestor',
                short_name: 'SPCam',
                description: 'Consulta y gestión de datos de campo',
                theme_color: '#f4f4f5',
                background_color: '#f4f4f5',
                display: 'standalone',
                start_url: '.',
                icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
              },
            }),
          ]
        : [],
  };
});

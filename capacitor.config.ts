import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // TODO: cambia el id ANTES de ejecutar `npm run android:add` (después cuesta cambiarlo).
  appId: 'com.example.geocampo',
  appName: 'GeoCampo',
  webDir: 'dist/tecnico',
  android: {
    // Imprescindible para el seguimiento GPS en segundo plano: evita que las
    // actualizaciones se detengan a los 5 minutos (doc del plugin).
    useLegacyBridge: true,
  },
};

export default config;

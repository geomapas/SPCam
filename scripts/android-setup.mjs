// Ajustes de Android que `cap add android` no hace. Es IDEMPOTENTE: puedes ejecutarlo
// las veces que quieras (`npm run android:setup`). Si el proyecto android/ se regenera, vuelve a lanzarlo.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = 'android/app/src/main';
const manifestPath = join(base, 'AndroidManifest.xml');
if (!existsSync(manifestPath)) {
  console.error('No existe android/. Ejecuta primero: npm run android:add');
  process.exit(1);
}

// 1) Permisos en el manifiesto (el plugin ya los aporta al fusionar; se declaran
//    también aquí para que sean visibles y no dependan de la fusión).
let manifest = readFileSync(manifestPath, 'utf8');
const permisos = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
];
let anadidos = [];
for (const p of permisos) {
  if (!manifest.includes(`android:name="${p}"`)) {
    manifest = manifest.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
    anadidos.push(p);
  }
}
writeFileSync(manifestPath, manifest);

// 2) Notificación del servicio en primer plano: icono vectorial (un PNG sin fondo
//    transparente hace que la notificación se pueda descartar y se comporte raro).
const drawable = join(base, 'res/drawable');
mkdirSync(drawable, { recursive: true });
writeFileSync(
  join(drawable, 'ic_tracking.xml'),
  `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z"/>
</vector>
`,
);

// 3) strings.xml: nombre del canal, icono y color de la notificación.
const stringsPath = join(base, 'res/values/strings.xml');
let strings = readFileSync(stringsPath, 'utf8');
const entradas = {
  capacitor_background_geolocation_notification_channel_name: 'Grabación de recorrido',
  capacitor_background_geolocation_notification_icon: 'drawable/ic_tracking',
  capacitor_background_geolocation_notification_color: '#1B5E20',
};
for (const [clave, valor] of Object.entries(entradas)) {
  if (!strings.includes(`name="${clave}"`)) {
    strings = strings.replace('</resources>', `    <string name="${clave}">${valor}</string>\n</resources>`);
    anadidos.push(clave);
  }
}
writeFileSync(stringsPath, strings);

console.log(anadidos.length ? `Añadido: \n - ${anadidos.join('\n - ')}` : 'Android ya estaba configurado.');

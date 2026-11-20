# GeoCampo — esqueleto offline-first (paso 1 del plan)

Un repositorio, dos destinos de build:

| Destino | Quién | Comando | Salida |
|---|---|---|---|
| `tecnico` | App Android (Capacitor), sin cobertura | `npm run build:tecnico` | `dist/tecnico` → APK |
| `gestor` | Web con conexión (GitHub Pages / Firebase Hosting) | `npm run build:gestor` | `dist/gestor` (con PWA/Workbox) |

## Estructura (tres capas)

```
src/
  config.ts            ajustes del GPS (distancia, precisión, textos de notificación)
  data/                ← único sitio que habla con almacenamiento/plugins (luego, Firebase)
    local/db.ts          Dexie (IndexedDB), esquema versionado (v1 tracks, v2 preferencias)
    local/preferencias.ts  preferencias del mapa guardadas en el dispositivo
    files/               archivos del dispositivo (Filesystem) y compartir
    gps/backgroundGps.ts GPS en segundo plano (plugin) + alternativa de navegador para desarrollo
  domain/              ← reglas del negocio, sin DOM ni plugins
    permisos.ts          puertas de permisos: puede('...'); hoy todo abierto
    capas/               catálogo de mapas base y capas temáticas (DATOS) + estado activo
    tracks/              grabación incremental + recuperación, GPX, geo, repositorio
    types.ts
  ui/                  ← pantallas; solo importan de domain
    tecnico/             index.html + main.ts (app Android)
    gestor/              index.html + main.ts (web del gestor)
    shared/              tema (estilos.css), cabecera, mapa Leaflet, panel de capas
scripts/android-setup.mjs   permisos, icono y textos de la notificación (idempotente)
```

Regla: `ui → domain → data`. La interfaz nunca toca Firebase ni plugins directamente.
Cuando llegue Firebase, entra solo en `src/data/`.

## Aspecto y capas

- **Estética:** copiada de GEOmapas (cristal translúcido, azul `#2f6fde`, DM Sans, esquinas de 12 px).
  Todos los valores de diseño están al principio de `src/ui/shared/estilos.css`: cambia uno y cambia toda la app.
  La tipografía va empaquetada (funciona sin conexión).
- **Botón «Capas»** de la cabecera: abre el panel «Cartografía y capas» con el selector de **mapa base**
  (Ortofoto / Topográfico) y las **capas temáticas** (Recintos SIGPAC, Cultivo declarado).
- **Añadir o quitar una capa** = editar `src/domain/capas/catalogo.ts`. Lo elegido se guarda en el dispositivo.
- **Permisos:** `src/domain/permisos.ts` tiene la lista de permisos. Cada función nueva se añade ahí
  con «sí» para todos los perfiles; se ajusta al final.
- Todas estas capas **necesitan conexión**. El mapa sin cobertura llega con la descarga de zonas (paso 6).
  Antes de guardar teselas de cualquier fuente hay que comprobar sus condiciones de uso.

## Cómo funciona la grabación

1. Cada punto GPS se **anexa a un archivo** `tracks/<uuid>.jsonl` (un punto por línea) en cuanto llega.
2. Al pulsar **Parar**, se genera `tracks/<uuid>.gpx` a partir de ese archivo.
3. Si Android mata la app a mitad de grabación, al reabrir se **finaliza automáticamente** el recorrido
   con los puntos que había (aparece marcado como «recuperado»).
4. El botón **GPX** de cada recorrido lo comparte (correo, Drive, WhatsApp…) para que puedas abrirlo en el ordenador.

## Requisitos previos

- Node.js 22 o superior (`node -v`)
- Android Studio (incluye SDK y JDK). Compila con SDK 36.
- Un móvil Android con **depuración USB** activada (Ajustes → Opciones de desarrollador).

## Pasos exactos

```bash
# 0. Antes de nada: cambia el id del paquete en capacitor.config.ts (appId)
#    Después de crear android/ es incómodo cambiarlo.

npm install

# 1. Comprobar que todo compila
npm run build

# 2. (opcional) probar en el navegador, sin GPS en segundo plano
npm run dev:tecnico      # http://localhost:5173  (usa la ubicación del navegador)
npm run dev:gestor

# 3. Crear el proyecto Android (solo la primera vez) y aplicar los ajustes
npm run android:add

# 4. Compilar la web y copiarla al proyecto Android
npm run android:sync

# 5a. Abrir en Android Studio y pulsar «Run» con el móvil conectado
npm run android:open
# 5b. …o directamente desde la terminal
npm run android:run
```

Cada vez que cambies código: `npm run android:sync` y vuelve a ejecutar desde Android Studio.
Si el proyecto `android/` se regenera, ejecuta `npm run android:setup`.

### Generar un APK para repartir (más adelante)
Android Studio → Build → Generate Signed Bundle / APK → APK. **Guarda la keystore y su contraseña en
un sitio seguro y con copia**: sin ella no podrás actualizar las instalaciones existentes.

## Prueba de campo (la que decide si el plugin sirve)

1. Abre la app, concede **ubicación** («Mientras se usa la app» / «Permitir siempre» si lo ofrece)
   y **notificaciones**.
2. Pulsa **Iniciar recorrido**. Verás la notificación permanente «GeoCampo: grabando recorrido».
3. Ajustes del móvil → Batería → GeoCampo → **Sin restricciones** (o «No optimizar»).
   Xiaomi/Huawei/Samsung/Oppo tienen además un «inicio automático» o «apps protegidas»: actívalo.
4. **Bloquea la pantalla y camina 15-20 minutos** (mejor 30+ para pasar el corte de 5 minutos).
5. Desbloquea: el contador debe haber seguido subiendo y la traza no debe tener saltos largos.
6. Pulsa **Parar**, **Ver** y **GPX**; abre el GPX en el ordenador.
7. Prueba de muerte de la app: con grabación en curso, desliza la app fuera de recientes, espera
   un minuto y reábrela. Debe aparecer el aviso de recorrido recuperado.

Apunta por cada móvil: modelo, versión de Android, minutos grabados, puntos recibidos, si hubo huecos.

## Permisos y ajustes de Android (ya los aplica `npm run android:add`)

| Qué | Dónde | Para qué |
|---|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | AndroidManifest | Ubicación |
| `FOREGROUND_SERVICE` | AndroidManifest | Servicio en primer plano |
| `FOREGROUND_SERVICE_LOCATION` | AndroidManifest | Obligatorio en Android 14+ para servicios de tipo ubicación |
| `POST_NOTIFICATIONS` | AndroidManifest + petición en ejecución | Notificación permanente (Android 13+) |
| `INTERNET` | AndroidManifest | Teselas del mapa de prueba |
| `foregroundServiceType="location"` | Lo declara el plugin | Tipo del servicio |
| `android.useLegacyBridge: true` | `capacitor.config.ts` | Evita que se detengan las actualizaciones a los 5 minutos |
| Icono `drawable/ic_tracking` + textos | `res/` (lo crea el script) | Notificación correcta (un PNG sin fondo transparente la rompe) |

`ACCESS_BACKGROUND_LOCATION` **no** se declara: el servicio en primer plano se inicia con la app visible,
y el plugin no lo exige. Si en algún móvil se corta con la pantalla apagada, es lo primero que
habría que probar a añadir.

## Qué NO hace todavía (pasos siguientes del plan)

Autenticación, Firestore/Storage, cola de envío, formularios, fotos, mapas offline, reglas de seguridad,
y funciones del gestor. El mapa base «Topográfico» es OpenStreetMap, provisional.

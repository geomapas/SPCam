# SPCam — app de campo offline-first

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
    local/db.ts          Dexie (IndexedDB), esquema versionado (v1 tracks, v2 preferencias, v3 capas del proyecto)
    local/preferencias.ts  preferencias del mapa guardadas en el dispositivo
    local/capasProyecto.ts capas del proyecto guardadas en el dispositivo
    files/importarCapa.ts  lectura de SHP, GeoJSON y KML
    files/exportarCapa.ts  escritura de KML, SHP (zip) y XLSX
    files/               archivos del dispositivo (Filesystem) y compartir
    gps/backgroundGps.ts GPS en segundo plano (plugin) + alternativa de navegador para desarrollo
  domain/              ← reglas del negocio, sin DOM ni plugins
    permisos.ts          puertas de permisos: puede('...'); hoy todo abierto
    capas/               catálogo de mapas base y capas precargadas (DATOS), estado activo y capas del proyecto
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
- **Icono «Capas»** de la cabecera: abre el panel «Cartografía y capas», con tres secciones:
  1. **Mapa base** (Ortofoto / Topográfico).
  2. **Capas temáticas:** las precargadas (por ahora Recintos SIGPAC), con interruptor. La **rueda de ajustes**
     permite elegir cuáles de las precargadas se ofrecen en la lista; una capa quitada de la lista tampoco se ve en el mapa.
  3. **Capas del proyecto:** archivos que carga el usuario (**SHP** en .zip o .shp + .dbf + .prj, **GeoJSON** y **KML**).
     Cada capa tiene: interruptor de visibilidad, punto de color (cambio rápido del borde), «ir a la capa» (tocar el nombre),
     **editar** (nombre, color del borde y color del relleno), **descargar / compartir** y **quitar del panel**.
     Al tocar un elemento en el mapa salen sus atributos.
     - **De lejos se ven como pinpoints** (una chincheta por elemento) y **desde el zoom 14 como geometrías**, igual que GEOmapas
       (`UMBRAL_PINS_ZOOM` en `src/config.ts`). En capas de más de 3000 elementos los pines son puntos sueltos, más ligeros.
     - **Descargar / compartir:** KML, SHP (zip; una capa con geometrías mezcladas se divide en un shapefile por tipo) y XLSX (tabla de atributos).
       En el móvil abre «compartir» (Drive, WhatsApp, Archivos…); en el navegador descarga directamente.
       **Sync** sube la capa a la nube; **Enviar** la comparte con otro usuario por correo. Ambos necesitan Firebase y hoy avisan de que la nube no está conectada.
       No hay modo colaborativo ni enlace.
     - **Quitar del panel no borra:** la capa sigue guardada en el dispositivo. **Añadir capa** abre un buscador de capas guardadas
       (en el dispositivo y, cuando exista, en la nube) para volver a ponerlas; desde ahí también se puede eliminar para siempre
       (con confirmación) o **cargar un archivo nuevo**.
- Las capas del proyecto se **guardan en el dispositivo** (funcionan sin conexión). La interfaz de la nube (`src/domain/capas/nube.ts`)
  ya está definida; la implementación con Firebase llega con el inicio de sesión (pasos 3 y 5 del plan).
- Un SHP sin `.prj` solo se admite si ya está en grados (WGS84); si no, la carga avisa de que falta el `.prj`.
- **Añadir o quitar una capa precargada** = editar `src/domain/capas/catalogo.ts`. Lo elegido se guarda en el dispositivo.
- **Permisos:** `src/domain/permisos.ts` tiene la lista de permisos. Cada función nueva se añade ahí
  con «sí» para todos los perfiles; se ajusta al final.
- Las capas WMS **necesitan conexión**. El mapa sin cobertura llega con la descarga de zonas (paso 6).
  Antes de guardar teselas de cualquier fuente hay que comprobar sus condiciones de uso.

## Cómo funciona la grabación

El icono de **recorrido** (arriba a la derecha, junto al de capas) abre su panel: **Iniciar, Pausar, Reanudar y Finalizar**.

1. Cada punto GPS se **anexa a un archivo** `tracks/<uuid>.jsonl` (un punto por línea) en cuanto llega.
2. **Pausar** para el GPS (ahorra batería). **Reanudar** lo vuelve a arrancar y abre un **tramo nuevo**:
   lo que te muevas durante la pausa no se une con una línea ni suma distancia.
3. **Finalizar** (pide confirmación) genera `tracks/<uuid>.gpx` a partir de ese archivo, con un tramo por cada pausa.
4. Si Android mata la app a mitad de grabación, al reabrir se **finaliza automáticamente** el recorrido
   con los puntos que había (aparece marcado como «recuperado»).
5. **Cerrar el panel no detiene la grabación.** El icono se pone **rojo** (con un punto que parpadea) mientras graba
   y **ámbar** en pausa. Los errores del GPS salen como aviso sobre el mapa aunque el panel esté cerrado.
6. En el panel, la lista de recorridos guardados: **Ver** (línea azul en el mapa) y **GPX** (compartir).

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

1. Abre la app y concede **ubicación** y **notificaciones** cuando las pida.
2. Pulsa el **icono de recorrido** → **Iniciar recorrido**. El icono se pone rojo y aparece la notificación permanente «SPCam: grabando recorrido».
3. Ajustes del móvil → Batería → SPCam → **Sin restricciones** (o «No optimizar»).
   Xiaomi/Huawei/Samsung/Oppo tienen además un «inicio automático» o «apps protegidas»: actívalo.
4. Cierra el panel, **bloquea la pantalla y camina 15-20 minutos** (mejor 30+ para pasar el corte de 5 minutos).
   Prueba también una **pausa** en mitad del recorrido y reanuda.
5. Desbloquea: el icono debe seguir rojo y el contador de puntos debe haber subido.
6. **Finalizar** → **Ver** y **GPX**; abre el GPX en el ordenador.
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

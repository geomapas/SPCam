# SPCam · Guía de diseño

Referencia visual: `spcam_cartograf_a_y_control_de_campo.html`. Las reglas viven en **`src/ui/shared/estilos.css`** (tokens y componentes, comentados).
**Antes de añadir cualquier pantalla, lee este archivo y ese CSS.** Si un componente nuevo no encaja en lo que hay, se añade a `estilos.css` y se anota aquí.

## Principios
1. **Mapa a pantalla completa; la interfaz flota encima** como una columna centrada de 448 px (`--ancho-hud`).
2. **Móvil primero, con una mano:** todo lo pulsable mide al menos 44 px (`--tap`) o está dentro de una zona de ese tamaño.
3. **Sin conexión por defecto:** nada se carga de internet (ni fuentes, ni iconos, ni librerías por CDN). Todo va empaquetado.
4. **Nada suelto:** ningún color, medida o sombra se escribe a mano en el código; se usan los tokens (`var(--…)`) y las clases de `estilos.css`.
5. **Una sola superficie abierta a la vez** (popover u hoja). Se cierran tocando fuera, con Escape o con su X.
6. **Sin parpadeos ni animaciones llamativas.** El estado se comunica con color, no con puntos que laten.

## Tema
**Claro por defecto** (acento esmeralda `#059669`); oscuro opcional (acento lima `#D9F99D`). Se cambia en **Ajustes → Apariencia**; solo se recuerda lo que el usuario elige
y se aplica antes de pintar. Todos los colores son tokens que cambian con la clase `dark` de `<html>`: `--fondo --texto --suave --hoja --tarjeta --vidrio --acento …`.

## Tipografía e iconos
- **Inter** para el texto y **JetBrains Mono** (`.mono`, `.dato-mono`) para cifras, coordenadas y contadores. Empaquetadas (solo latin y latin-ext).
- Tamaños: 10 px etiquetas en mayúsculas · 11 px datos · **12 px texto base** · 14 px títulos.
- **Iconos Phosphor** incrustados como SVG en `src/ui/shared/iconos.ts`. Para uno nuevo: copiar su SVG de `@phosphor-icons/core` siguiendo el patrón del archivo.

## Formas
Radios: `--r-xl` 12 px (campos, botones) · `--r-2xl` 16 px (popovers) · `--r-3xl` 24 px (hojas, ventanas, dock) · círculo/cápsula para cabecera.
Sombras: `--sombra-lg` (elementos flotantes) · `--sombra-2xl` (hojas, popovers, ventanas). Superficies de cristal: clase `.vidrio`.

## Componentes (clases de `estilos.css`)
| Qué | Clases | Cuándo |
|---|---|---|
| Cabecera | `.hud-cabecera .capsula .btn-circulo .btn-usuario` | Siempre arriba: logo + usuario, y botones redondos de recorrido y «mi ubicación» |
| Dock | `.dock .dock-barra .dock-boton .dock-base` | Acciones permanentes abajo (mapa base, capas, ajustes) |
| Popover | `crearPopover()` · `.popover-cabecera/-dock` | Menús pequeños y rápidos |
| Hoja inferior | `crearHoja()` · `.hoja` | Listados y herramientas con varias secciones (capas) |
| Ventana | `abrirModal()` · `.modal-*` | Formularios cortos y confirmaciones (editar, compartir, añadir) |
| Aviso | `mostrarAviso()` · `.aviso-flot` | Mensajes breves; `error` en coral |
| Botones | `.btn` + `.btn-acento .btn-suave .btn-coral .btn-ambar` · `.btn-mini` · `.btn-icono` | Acción principal = acento; destructiva = coral; pausa = ámbar |
| Interruptor | `.interruptor` | Mostrar/ocultar |
| Campos | `.campo-texto .campo-etiqueta .rango .muestras` | Formularios |
| Listas | `.lista-div .fila .fila-izq .fila-der .punto` | Capas, recorridos… una línea por elemento |

## Estados con significado de color
- **Usuario:** verde (`--ok`) con conexión · coral sin conexión.
- **Recorrido:** botón coral al grabar · ámbar en pausa.
- **Acento** (lima/esmeralda): acción principal y elemento activo.
- **Coral:** peligro y errores. Acciones destructivas siempre con confirmación.
- El efecto `:hover` va **solo** dentro de `@media (hover: hover)` (en táctil se queda «pegado»).

## Cómo añadir una pantalla o función nueva
1. Elegir la superficie (popover / hoja / ventana) según la tabla.
2. Construirla con clases existentes; si falta algo, añadirlo a `estilos.css` con tokens.
3. Comprobar tema claro y oscuro, y que nada necesite internet.
   Si un panel se repinta al pulsar uno de sus botones, el cierre «al tocar fuera» ya lo tiene en cuenta (`superficies.ts`); no lo reimplementes.
4. Añadir su permiso a `src/domain/permisos.ts` (todos «sí» hasta el final).
5. Pasar `npm run typecheck` y `npm run build`.

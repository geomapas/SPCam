import {
  CAPAS_TEMATICAS,
  colorRelleno,
  type CapaProyecto,
  type EstadoCapas,
  type GestorCapas,
  type GestorProyecto,
} from '@/domain/capas';
import { puede } from '@/domain/permisos';
import { mostrarAviso } from './aviso';
import { iconoAjustes, iconoCompartir, iconoLapiz, iconoMas, iconoCerrar } from './iconos';
import { abrirAnadirCapa, abrirCompartirCapa, abrirEditorCapa } from './modalesCapa';
import { crearHoja } from './superficies';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function interruptor(marcado: boolean, aria: string, alCambiar: (v: boolean) => void): { caja: HTMLElement; input: HTMLInputElement } {
  const caja = el('label', 'interruptor');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = marcado;
  input.setAttribute('aria-label', aria);
  input.addEventListener('change', () => alCambiar(input.checked));
  caja.append(input, el('span', 'interruptor-pista'));
  return { caja, input };
}

function botonIcono(titulo: string, svg: string, alPulsar: () => void, clase = '', oculto = false): HTMLButtonElement {
  const b = el('button', `btn-icono ${clase}`.trim());
  b.type = 'button';
  b.title = titulo;
  b.setAttribute('aria-label', titulo);
  b.innerHTML = svg;
  b.hidden = oculto;
  b.addEventListener('click', alPulsar);
  return b;
}

/**
 * Hoja inferior «Capas»: capas temáticas (precargadas, con su rueda de ajustes) y capas del proyecto.
 * El mapa base se elige con la miniatura del dock (selectorBase.ts).
 */
export function montarPanelCapas(opts: {
  gestor: GestorCapas;
  proyecto: GestorProyecto;
  boton: HTMLButtonElement;
  /** Encuadra el mapa en una capa del proyecto */
  alZoom: (id: string) => void;
}): void {
  const { gestor, proyecto, boton, alZoom } = opts;
  const verCapas = puede('ver_capas_tematicas');
  const verProyecto = puede('ver_capas_proyecto');
  if (!verCapas && !verProyecto) {
    boton.hidden = true;
    return;
  }
  const hoja = crearHoja({ boton, titulo: 'Capas' });
  const { cuerpo } = hoja;

  // ── Capas temáticas (precargadas) ──
  const filasTematicas = new Map<string, { fila: HTMLElement; input: HTMLInputElement }>();
  const casillas = new Map<string, HTMLInputElement>();
  if (verCapas) {
    const sec = el('div', 'seccion');
    const cab = el('div', 'seccion-cab');
    cab.append(el('span', 'etiqueta-sec', 'Capas temáticas'));
    const caja = el('div', 'caja-config');
    caja.hidden = true;
    caja.append(el('div', 'etiqueta-sec', 'Capas temáticas visibles'));
    const ajustes = botonIcono('Elegir capas precargadas', iconoAjustes(16), () => (caja.hidden = !caja.hidden), '', !puede('configurar_capas_precargadas'));
    cab.append(ajustes);
    sec.append(cab, caja);

    const lista = el('div', 'lista-div');
    for (const c of CAPAS_TEMATICAS) {
      // opción en la caja de configuración
      const opcion = el('label');
      opcion.append(el('span', undefined, c.nombre));
      const casilla = el('input', 'casilla');
      casilla.type = 'checkbox';
      casilla.addEventListener('change', () => gestor.alternarEnPanel(c.id, casilla.checked));
      opcion.append(casilla);
      caja.append(opcion);
      casillas.set(c.id, casilla);

      // fila en la lista
      const fila = el('div', 'fila');
      const izq = el('div', 'fila-izq');
      const punto = el('span', 'punto punto-cuadrado');
      punto.style.background = c.color;
      izq.append(punto, el('span', 'fila-nombre', c.nombre));
      const sw = interruptor(false, c.nombre, (v) => gestor.alternarCapa(c.id, v));
      fila.append(izq, sw.caja);
      lista.append(fila);
      filasTematicas.set(c.id, { fila, input: sw.input });
    }
    sec.append(lista);
    cuerpo.append(sec);
  }

  // ── Capas del proyecto ──
  if (verProyecto) {
    const sec = el('div', 'seccion');
    const cab = el('div', 'seccion-cab');
    const contador = el('span', 'chip-mono');
    cab.append(el('span', 'etiqueta-sec', 'Capas del proyecto'), contador);
    const lista = el('div', 'lista-div');

    const anadir = el('button', 'btn btn-suave btn-bloque');
    anadir.type = 'button';
    anadir.style.marginTop = '12px';
    anadir.innerHTML = `<span class="icono-acento" style="display:inline-flex">${iconoMas(14)}</span>`;
    const textoAnadir = el('span', undefined, 'Añadir capa');
    anadir.append(textoAnadir);
    anadir.hidden = !puede('anadir_capas_proyecto');
    sec.append(cab, lista, anadir);
    cuerpo.append(sec);

    /** Carga archivos nuevos (SHP, GeoJSON, KML) y encuadra el mapa en la última capa añadida. */
    const cargarArchivos = async (archivos: File[]): Promise<void> => {
      anadir.disabled = true;
      textoAnadir.textContent = 'Procesando…';
      try {
        const { anadidas, errores } = await proyecto.anadirArchivos(archivos);
        errores.forEach((e) => mostrarAviso(e, 'error'));
        if (anadidas.length > 0) {
          const ultima = anadidas[anadidas.length - 1]!;
          mostrarAviso(
            anadidas.length === 1
              ? `Capa «${ultima.nombre}» añadida (${ultima.nElementos} elementos)`
              : `${anadidas.length} capas añadidas`,
          );
          hoja.cerrar();
          alZoom(ultima.id);
        }
      } catch (e) {
        mostrarAviso(`No se pudo cargar: ${e instanceof Error ? e.message : String(e)}`, 'error');
      } finally {
        anadir.disabled = false;
        textoAnadir.textContent = 'Añadir capa';
      }
    };

    // «Añadir capa» busca entre las capas guardadas (dispositivo y nube); desde ahí también se puede cargar un archivo.
    anadir.addEventListener('click', () =>
      abrirAnadirCapa(proyecto, {
        alElegir: (id) => {
          hoja.cerrar();
          alZoom(id);
        },
        alCargarArchivos: cargarArchivos,
      }),
    );

    const fila = (c: CapaProyecto): HTMLElement => {
      const f = el('div', 'fila');
      const izq = el('div', 'fila-izq');
      const punto = el('span', 'punto');
      punto.style.background = colorRelleno(c);
      punto.style.boxShadow = `0 0 0 2px ${c.color}`;
      const nombre = el('button', 'fila-nombre', c.nombre);
      nombre.type = 'button';
      nombre.title = 'Ir a la capa';
      nombre.addEventListener('click', () => {
        hoja.cerrar();
        alZoom(c.id);
      });
      izq.append(punto, nombre);

      const der = el('div', 'fila-der');
      der.append(
        botonIcono('Editar capa', iconoLapiz(16), () => abrirEditorCapa(c, proyecto), '', !puede('editar_capas_proyecto')),
        botonIcono(
          'Descargar / compartir',
          iconoCompartir(16),
          () => abrirCompartirCapa(c, proyecto),
          '',
          !puede('descargar_capas_proyecto') && !puede('compartir_capas_proyecto') && !puede('sincronizar_capas_proyecto'),
        ),
        botonIcono(
          'Quitar del panel',
          iconoCerrar(16),
          () => {
            proyecto.quitarDelPanel(c.id);
            mostrarAviso(`«${c.nombre}» quitada del panel. Sigue guardada: recupérala con «Añadir capa».`);
          },
          'peligro',
          !puede('eliminar_capas_proyecto'),
        ),
        interruptor(c.visible, `Mostrar ${c.nombre}`, (v) => proyecto.alternarVisible(c.id, v)).caja,
      );
      f.append(izq, der);
      return f;
    };

    const pintarProyecto = (): void => {
      const capas = proyecto.capasEnPanel;
      contador.textContent = String(capas.length);
      lista.replaceChildren();
      if (capas.length === 0) lista.append(el('div', 'vacio', 'No hay capas del proyecto.'));
      else for (const c of capas) lista.append(fila(c));
    };
    proyecto.suscribir(pintarProyecto);
    pintarProyecto();
  }

  const pintar = (e: EstadoCapas): void => {
    filasTematicas.forEach(({ fila, input }, id) => {
      input.checked = e.activas.includes(id);
      fila.hidden = !e.enPanel.includes(id);
    });
    casillas.forEach((c, id) => (c.checked = e.enPanel.includes(id)));
  };
  pintar(gestor.estado);
  gestor.suscribir(pintar);
}

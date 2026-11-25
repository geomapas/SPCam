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
import {
  iconoAjustes,
  iconoCapas,
  iconoCerrar,
  iconoCompartir,
  iconoLapiz,
  iconoMas,
  iconoNube,
  iconoNubeOff,
} from './iconos';
import { abrirModal } from './modal';
import { abrirAnadirCapa, abrirCompartirCapa, abrirEditorCapa } from './modalesCapa';
import { crearPanelFlotante } from './panelFlotante';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Cabecera de sección: etiqueta a la izquierda y, a la derecha, lo que se pase (ajustes, contador…). */
function cabeceraSeccion(texto: string, ...derecha: HTMLElement[]): HTMLElement {
  const fila = document.createElement('div');
  fila.className = 'pc-label-fila';
  const l = document.createElement('div');
  l.className = 'pc-label';
  l.textContent = texto;
  fila.append(l, ...derecha);
  return fila;
}

/**
 * Panel "Cartografía y capas": capas temáticas (precargadas) y capas del proyecto.
 * El mapa base se elige con el selector flotante (selectorBase.ts).
 */
export function montarPanelCapas(opts: {
  gestor: GestorCapas;
  proyecto: GestorProyecto;
  boton: HTMLButtonElement;
  contenedor: HTMLElement;
  /** Encuadra el mapa en una capa del proyecto */
  alZoom: (id: string) => void;
}): void {
  const { gestor, proyecto, boton, contenedor, alZoom } = opts;
  const verCapas = puede('ver_capas_tematicas');
  const verProyecto = puede('ver_capas_proyecto');
  if (!verCapas && !verProyecto) return;

  const panel = crearPanelFlotante({
    titulo: 'Cartografía y capas',
    icono: iconoCapas(14),
    boton,
    contenedor,
  });
  const { cuerpo } = panel;

  // ── Capas temáticas (precargadas) ──
  const filasTematicas = new Map<string, { fila: HTMLElement; input: HTMLInputElement }>();
  if (verCapas) {
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    const ajustes = document.createElement('button');
    ajustes.type = 'button';
    ajustes.className = 'btn-ajustes';
    ajustes.setAttribute('aria-label', 'Elegir capas precargadas');
    ajustes.title = 'Elegir capas precargadas';
    ajustes.innerHTML = iconoAjustes(16);
    ajustes.hidden = !puede('configurar_capas_precargadas');
    ajustes.addEventListener('click', () => abrirSelectorPrecargadas(gestor));
    sec.append(cabeceraSeccion('Capas temáticas', ajustes));

    for (const c of CAPAS_TEMATICAS) {
      const fila = document.createElement('label');
      fila.className = 'capa-row';
      const color = document.createElement('span');
      color.className = 'capa-color';
      color.style.background = c.color;
      const nombre = document.createElement('span');
      nombre.className = 'capa-nombre';
      nombre.textContent = c.nombre;
      const sw = document.createElement('span');
      sw.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('aria-label', c.nombre);
      input.addEventListener('change', () => gestor.alternarCapa(c.id, input.checked));
      const pista = document.createElement('span');
      pista.className = 'switch-pista';
      sw.append(input, pista);
      fila.append(color, nombre, sw);
      filasTematicas.set(c.id, { fila, input });
      sec.append(fila);
    }
    cuerpo.append(sec);
  }

  // ── Capas del proyecto ──
  let pintarProyecto = (): void => {};
  if (verProyecto) {
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    const contador = document.createElement('span');
    contador.className = 'pc-contador';
    sec.append(cabeceraSeccion('Capas del proyecto', contador));

    const lista = document.createElement('div');
    lista.className = 'proy-lista';
    sec.append(lista);

    const anadir = document.createElement('button');
    anadir.type = 'button';
    anadir.className = 'btn-anadir';
    anadir.innerHTML = `${iconoMas(16)}<span>Añadir capa</span>`;
    anadir.hidden = !puede('anadir_capas_proyecto');
    sec.append(anadir);
    cuerpo.append(sec);

    /** Carga archivos nuevos (SHP, GeoJSON, KML) y encuadra el mapa en la última capa añadida. */
    const cargarArchivos = async (archivos: File[]): Promise<void> => {
      anadir.disabled = true;
      anadir.classList.add('cargando');
      anadir.lastElementChild!.textContent = 'Procesando…';
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
          panel.cerrar();
          alZoom(ultima.id);
        }
      } catch (e) {
        mostrarAviso(`No se pudo cargar: ${e instanceof Error ? e.message : String(e)}`, 'error');
      } finally {
        anadir.disabled = false;
        anadir.classList.remove('cargando');
        anadir.lastElementChild!.textContent = 'Añadir capa';
      }
    };

    // «Añadir capa» busca entre las capas guardadas (dispositivo y nube); desde ahí también se puede cargar un archivo.
    anadir.addEventListener('click', () =>
      abrirAnadirCapa(proyecto, {
        alElegir: (id) => {
          panel.cerrar();
          alZoom(id);
        },
        alCargarArchivos: cargarArchivos,
      }),
    );

    const icono = (clase: string, titulo: string, svg: string, alPulsar: () => void, oculto = false): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = clase;
      b.title = titulo;
      b.setAttribute('aria-label', titulo);
      b.innerHTML = svg;
      b.hidden = oculto;
      b.addEventListener('click', alPulsar);
      return b;
    };

    // Todo en una sola línea: visibilidad · muestra de color · nombre · editar · descargar/compartir · quitar.
    // El color solo se cambia desde «Editar» (no hay un segundo selector en la lista).
    const fila = (c: CapaProyecto): HTMLElement => {
      const f = document.createElement('div');
      f.className = 'proy-row';

      const sw = document.createElement('label');
      sw.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = c.visible;
      input.setAttribute('aria-label', `Mostrar ${c.nombre}`);
      input.addEventListener('change', () => proyecto.alternarVisible(c.id, input.checked));
      const pista = document.createElement('span');
      pista.className = 'switch-pista';
      sw.append(input, pista);

      // Muestra (no es un selector): relleno por dentro y borde por fuera
      const muestra = document.createElement('span');
      muestra.className = 'capa-color capa-muestra';
      muestra.style.background = colorRelleno(c);
      muestra.style.boxShadow = `0 0 0 2px ${c.color}`;

      const nombre = document.createElement('button');
      nombre.type = 'button';
      nombre.className = 'proy-nombre';
      nombre.title = 'Ir a la capa';
      const n = document.createElement('span');
      n.className = 'capa-nombre';
      n.textContent = c.nombre;
      const sub = document.createElement('span');
      sub.className = 'capa-sub';
      sub.append(`${c.nElementos} elementos`);
      const sincronizada = c.sincronizadaEn !== undefined;
      const nube = document.createElement('span');
      nube.className = `proy-nube${sincronizada ? ' ok' : ''}`;
      nube.title = sincronizada ? 'Guardada en la nube' : 'Solo en este dispositivo';
      nube.innerHTML = sincronizada ? iconoNube(12) : iconoNubeOff(12);
      sub.append(nube);
      nombre.append(n, sub);
      nombre.addEventListener('click', () => {
        panel.cerrar();
        alZoom(c.id);
      });

      f.append(
        sw,
        muestra,
        nombre,
        icono('proy-btn', 'Editar capa', iconoLapiz(16), () => abrirEditorCapa(c, proyecto), !puede('editar_capas_proyecto')),
        icono(
          'proy-btn',
          'Descargar / compartir',
          iconoCompartir(16),
          () => abrirCompartirCapa(c, proyecto),
          !puede('descargar_capas_proyecto') && !puede('compartir_capas_proyecto') && !puede('sincronizar_capas_proyecto'),
        ),
        icono(
          'proy-btn proy-quitar',
          'Quitar del panel',
          iconoCerrar(16),
          () => {
            proyecto.quitarDelPanel(c.id);
            mostrarAviso(`«${c.nombre}» quitada del panel. Sigue guardada: recupérala con «Añadir capa».`);
          },
          !puede('eliminar_capas_proyecto'),
        ),
      );
      return f;
    };

    pintarProyecto = () => {
      const capas = proyecto.capasEnPanel;
      contador.textContent = String(capas.length);
      lista.replaceChildren();
      if (capas.length === 0) {
        const vacio = document.createElement('div');
        vacio.className = 'proy-vacio';
        vacio.textContent = 'No hay capas del proyecto.';
        lista.append(vacio);
        return;
      }
      for (const c of capas) lista.append(fila(c));
    };
    proyecto.suscribir(pintarProyecto);
    pintarProyecto();
  }

  const pintar = (e: EstadoCapas): void => {
    filasTematicas.forEach(({ fila, input }, id) => {
      input.checked = e.activas.includes(id);
      fila.hidden = !e.enPanel.includes(id);
    });
  };
  pintar(gestor.estado);
  gestor.suscribir(pintar);
}

/** La «rueda»: elegir cuáles de las capas precargadas se ofrecen en la lista. */
function abrirSelectorPrecargadas(gestor: GestorCapas): void {
  const contenido = document.createElement('div');
  const buscar = document.createElement('input');
  buscar.type = 'search';
  buscar.className = 'modal-input';
  buscar.placeholder = 'Buscar capa…';
  buscar.autocomplete = 'off';
  const lista = document.createElement('div');
  lista.className = 'ilm-lista';

  const filas: { fila: HTMLElement; nombre: string }[] = [];
  for (const c of CAPAS_TEMATICAS) {
    const fila = document.createElement('label');
    fila.className = 'ilm-row';
    const n = document.createElement('span');
    n.textContent = c.nombre;
    const sw = document.createElement('span');
    sw.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = gestor.estado.enPanel.includes(c.id);
    input.setAttribute('aria-label', c.nombre);
    input.addEventListener('change', () => gestor.alternarEnPanel(c.id, input.checked));
    const pista = document.createElement('span');
    pista.className = 'switch-pista';
    sw.append(input, pista);
    fila.append(n, sw);
    lista.append(fila);
    filas.push({ fila, nombre: sinAcentos(c.nombre) });
  }
  const vacio = document.createElement('div');
  vacio.className = 'proy-vacio';
  vacio.textContent = 'Sin resultados';
  vacio.hidden = true;
  lista.append(vacio);

  buscar.addEventListener('input', () => {
    const q = sinAcentos(buscar.value.trim());
    let alguna = false;
    for (const f of filas) {
      const coincide = f.nombre.includes(q);
      f.fila.hidden = !coincide;
      alguna ||= coincide;
    }
    vacio.hidden = alguna;
  });

  contenido.append(buscar, lista);
  void abrirModal({ titulo: 'Capas precargadas', contenido });
  buscar.focus();
}

import {
  NubeNoDisponible,
  opacidadRelleno,
  PALETA,
  type CapaProyecto,
  type FichaNube,
  type FormatoExport,
  type GestorProyecto,
} from '@/domain/capas';
import { puede } from '@/domain/permisos';
import { mostrarAviso } from './aviso';
import { iconoArchivoKml, iconoArchivoXls, iconoArchivoZip, iconoCerrar, iconoMas, iconoNube, iconoSync } from './iconos';
import { abrirModal } from './modal';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function bloque(etiqueta: string, ...contenido: HTMLElement[]): HTMLElement {
  const b = el('div', 'bloque-modal');
  b.append(el('div', 'campo-etiqueta', etiqueta), ...contenido);
  return b;
}

/** Fila de muestras de color: la paleta de capas más una muestra libre (selector de color del sistema). */
function muestras(inicial: string, aria: string): { caja: HTMLElement; valor: () => string } {
  let actual = inicial.toLowerCase();
  const caja = el('div', 'muestras');
  caja.setAttribute('role', 'group');
  caja.setAttribute('aria-label', aria);
  const botones = PALETA.map((c) => {
    const b = el('button', 'muestra');
    b.type = 'button';
    b.style.background = c;
    b.setAttribute('aria-label', c);
    b.addEventListener('click', () => {
      actual = c.toLowerCase();
      pintar();
    });
    caja.append(b);
    return { b, c: c.toLowerCase() };
  });
  const libre = el('label', 'muestra muestra-libre');
  libre.title = 'Otro color';
  const input = el('input');
  input.type = 'color';
  input.setAttribute('aria-label', 'Otro color');
  input.addEventListener('input', () => {
    actual = input.value.toLowerCase();
    pintar();
  });
  libre.append(input);
  caja.append(libre);

  function pintar(): void {
    const enPaleta = botones.some((x) => x.c === actual);
    botones.forEach(({ b, c }) => b.setAttribute('aria-pressed', String(c === actual)));
    libre.setAttribute('aria-pressed', String(!enPaleta));
    libre.style.background = enPaleta ? '' : actual;
    input.value = actual;
  }
  pintar();
  return { caja, valor: () => actual };
}

/* ═════════ Editar: nombre, color (borde y relleno) y opacidad del relleno ═════════ */
export function abrirEditorCapa(capa: CapaProyecto, proyecto: GestorProyecto): void {
  const cont = el('div');
  cont.style.display = 'flex';
  cont.style.flexDirection = 'column';
  cont.style.gap = '16px';

  const nombre = el('input', 'campo-texto');
  nombre.type = 'text';
  nombre.maxLength = 80;
  nombre.value = capa.nombre;
  nombre.autocomplete = 'off';

  const color = muestras(capa.color, 'Color de la capa');

  const rango = el('input', 'rango');
  rango.type = 'range';
  rango.min = '0';
  rango.max = '100';
  rango.step = '5';
  rango.value = String(Math.round(opacidadRelleno(capa) * 100));
  rango.setAttribute('aria-label', 'Opacidad del relleno');
  const valorRango = el('span', 'dato-mono', `${rango.value}%`);
  rango.addEventListener('input', () => (valorRango.textContent = `${rango.value}%`));
  const cabRango = el('div', 'cab-etiqueta');
  cabRango.append(el('span', 'campo-etiqueta', 'Opacidad del relleno'), valorRango);
  const bloqueRango = el('div', 'bloque-modal');
  bloqueRango.append(cabRango, rango);

  cont.append(bloque('Nombre', nombre), bloque('Color', color.caja), bloqueRango);

  abrirModal({
    etiqueta: 'Editar capa',
    titulo: capa.nombre,
    contenido: cont,
    botones: [
      { texto: 'Cancelar', clase: 'suave' },
      {
        texto: 'Guardar',
        clase: 'acento',
        alPulsar: (cerrar) => {
          const ok = proyecto.editar(capa.id, {
            nombre: nombre.value,
            color: color.valor(),
            opacidad: Number(rango.value) / 100,
          });
          if (!ok) return mostrarAviso('Escribe un nombre para la capa.', 'error');
          cerrar();
        },
      },
    ],
  });
  nombre.focus();
  nombre.select();
}

/* ═════════ Descargar / compartir (sin modo colaborativo ni enlace; con Sync) ═════════ */
export function abrirCompartirCapa(capa: CapaProyecto, proyecto: GestorProyecto): void {
  const cont = el('div');
  cont.style.display = 'flex';
  cont.style.flexDirection = 'column';
  cont.style.gap = '16px';

  const avisoNube = (e: unknown) =>
    mostrarAviso(e instanceof NubeNoDisponible ? e.message : `No se pudo completar: ${msg(e)}`, 'error');

  // Compartir con usuario
  const correos = el('input', 'campo-texto');
  correos.type = 'text';
  correos.placeholder = 'correo@ejemplo.com, otro@ejemplo.com';
  correos.autocomplete = 'off';
  correos.disabled = !proyecto.nubeDisponible;
  const enviar = el('button', 'btn btn-acento', 'Enviar');
  enviar.type = 'button';
  enviar.disabled = !puede('compartir_capas_proyecto');
  enviar.addEventListener('click', async () => {
    const lista = correos.value.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@'));
    if (!proyecto.nubeDisponible) return avisoNube(new NubeNoDisponible());
    if (lista.length === 0) return mostrarAviso('Introduce al menos un correo válido.', 'error');
    enviar.disabled = true;
    try {
      await proyecto.compartirCon(capa.id, lista);
      mostrarAviso('Capa compartida.');
      m.cerrar();
    } catch (e) {
      avisoNube(e);
    } finally {
      enviar.disabled = !puede('compartir_capas_proyecto');
    }
  });
  const filaCorreo = el('div', 'fila-campo');
  filaCorreo.append(correos, enviar);
  const bCompartir = bloque('Compartir con usuario', filaCorreo);
  if (!proyecto.nubeDisponible) bCompartir.append(el('p', 'nota', 'Disponible al conectar con Firebase.'));

  // Descargar archivo
  const rejilla = el('div', 'rejilla-3');
  const formatos: [FormatoExport, string, string][] = [
    ['kml', 'KML', iconoArchivoKml(22)],
    ['shp', 'SHP', iconoArchivoZip(22)],
    ['xlsx', 'XLSX', iconoArchivoXls(22)],
  ];
  const puedeDescargar = puede('descargar_capas_proyecto');
  for (const [f, texto, icono] of formatos) {
    const b = el('button', 'btn btn-suave');
    b.type = 'button';
    b.style.flexDirection = 'column';
    b.style.gap = '4px';
    b.style.minHeight = '60px';
    b.innerHTML = `<span class="icono-acento" style="display:inline-flex">${icono}</span>`;
    b.append(el('span', undefined, texto));
    b.disabled = !puedeDescargar;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await proyecto.descargar(capa.id, f);
        if (r === 'descargado') mostrarAviso(`${texto} descargado.`);
      } catch (e) {
        mostrarAviso(`No se pudo exportar: ${msg(e)}`, 'error');
      } finally {
        b.disabled = !puedeDescargar;
      }
    });
    rejilla.append(b);
  }

  // Sync
  const sync = el('button', 'btn btn-suave btn-bloque');
  sync.type = 'button';
  sync.innerHTML = `<span class="icono-acento" style="display:inline-flex">${capa.sincronizadaEn ? iconoNube(16) : iconoSync(16)}</span>`;
  sync.append(el('span', undefined, 'Sync'));
  sync.disabled = !puede('sincronizar_capas_proyecto');
  sync.addEventListener('click', async () => {
    sync.disabled = true;
    try {
      await proyecto.sincronizar(capa.id);
      mostrarAviso(`«${capa.nombre}» sincronizada: copia guardada en la nube.`);
    } catch (e) {
      avisoNube(e);
    } finally {
      sync.disabled = !puede('sincronizar_capas_proyecto');
    }
  });
  const bSync = el('div', 'separador');
  bSync.append(sync);

  cont.append(bCompartir, bloque('Descargar archivo', rejilla), bSync);
  const m = abrirModal({ etiqueta: 'Descargar / Compartir', titulo: capa.nombre, contenido: cont });
}

/* ═════════ Añadir capa: busca entre las guardadas (dispositivo y nube) ═════════ */
export function abrirAnadirCapa(
  proyecto: GestorProyecto,
  opts: {
    /** Se llama cuando se pone una capa en el panel (para encuadrar el mapa en ella) */
    alElegir: (id: string) => void;
    /** Cargar archivos nuevos desde el dispositivo (SHP, GeoJSON, KML) */
    alCargarArchivos: (archivos: File[]) => Promise<void>;
  },
): void {
  const cont = el('div');
  cont.style.display = 'flex';
  cont.style.flexDirection = 'column';
  cont.style.gap = '16px';
  let confirmando: string | null = null;

  const secLocal = el('div');
  const secNube = el('div');

  const fila = (titulo: string, sub: string, ...acciones: HTMLElement[]) => {
    const f = el('div', 'fila');
    const izq = el('div', 'fila-izq');
    izq.style.flexDirection = 'column';
    izq.style.alignItems = 'flex-start';
    izq.style.gap = '0';
    izq.append(el('span', 'fila-nombre', titulo), el('span', 'fila-sub', sub));
    const der = el('div', 'fila-der');
    der.append(...acciones);
    f.append(izq, der);
    return f;
  };
  const mini = (texto: string, clase: string, alPulsar: () => void): HTMLButtonElement => {
    const b = el('button', `btn btn-mini ${clase}`, texto);
    b.type = 'button';
    b.addEventListener('click', alPulsar);
    return b;
  };

  const pintarLocal = () => {
    secLocal.replaceChildren(el('div', 'etiqueta-sec', 'Guardadas en este dispositivo'));
    const lista = el('div', 'lista-div');
    secLocal.append(lista);
    if (proyecto.guardadas.length === 0) {
      lista.append(el('div', 'vacio', 'No hay capas guardadas.'));
      return;
    }
    for (const c of proyecto.guardadas) {
      if (c.id === confirmando) {
        const f = el('div', 'fila');
        f.style.flexDirection = 'column';
        f.style.alignItems = 'stretch';
        f.append(el('p', 'nota', `¿Eliminar «${c.nombre}» para siempre? No se puede deshacer.`));
        const botones = el('div', 'tk-botones');
        const no = mini('Cancelar', 'btn-suave', () => {
          confirmando = null;
          pintarLocal();
        });
        const si = mini('Eliminar', 'btn-coral', async () => {
          si.disabled = no.disabled = true;
          try {
            await proyecto.eliminar(c.id);
          } catch (e) {
            mostrarAviso(`No se pudo eliminar: ${msg(e)}`, 'error');
          }
          confirmando = null;
          pintarLocal();
        });
        botones.append(no, si);
        f.append(botones);
        lista.append(f);
        continue;
      }
      const anadir = mini('Añadir', 'btn-acento', () => {
        proyecto.ponerEnPanel(c.id);
        m.cerrar();
        opts.alElegir(c.id);
      });
      anadir.disabled = !puede('anadir_capas_proyecto');
      const borrar = el('button', 'btn-icono peligro');
      borrar.type = 'button';
      borrar.innerHTML = iconoCerrar(16);
      borrar.title = 'Eliminar para siempre';
      borrar.setAttribute('aria-label', `Eliminar ${c.nombre} para siempre`);
      borrar.hidden = !puede('eliminar_capas_proyecto');
      borrar.addEventListener('click', () => {
        confirmando = c.id;
        pintarLocal();
      });
      lista.append(fila(c.nombre, `${c.nElementos} elementos`, anadir, borrar));
    }
  };

  const pintarNube = async () => {
    secNube.replaceChildren(el('div', 'etiqueta-sec', 'En la nube'));
    if (!proyecto.nubeDisponible) {
      secNube.append(el('div', 'vacio', 'Nube no conectada todavía.'));
      return;
    }
    secNube.append(el('div', 'vacio', 'Buscando…'));
    let fichas: FichaNube[] = [];
    try {
      fichas = await proyecto.listarEnNube();
    } catch (e) {
      mostrarAviso(`No se pudo consultar la nube: ${msg(e)}`, 'error');
    }
    secNube.replaceChildren(el('div', 'etiqueta-sec', 'En la nube'));
    const lista = el('div', 'lista-div');
    secNube.append(lista);
    if (fichas.length === 0) {
      lista.append(el('div', 'vacio', 'No hay más capas en la nube.'));
      return;
    }
    for (const f of fichas) {
      const bajar = mini('Descargar', 'btn-suave', async () => {
        bajar.disabled = true;
        try {
          const c = await proyecto.recuperarDeNube(f.id);
          m.cerrar();
          opts.alElegir(c.id);
        } catch (e) {
          mostrarAviso(`No se pudo descargar: ${msg(e)}`, 'error');
          bajar.disabled = false;
        }
      });
      lista.append(fila(f.nombre, `${f.nElementos} elementos`, bajar));
    }
  };

  // Cargar un archivo nuevo desde el dispositivo
  const selector = el('input');
  selector.type = 'file';
  selector.multiple = true;
  selector.hidden = true; // sin "accept": en Android los .shp/.dbf/.kml saldrían en gris
  const cargar = el('button', 'btn btn-suave btn-bloque');
  cargar.type = 'button';
  cargar.innerHTML = `<span class="icono-acento" style="display:inline-flex">${iconoMas(14)}</span>`;
  cargar.append(el('span', undefined, 'Cargar archivo…'));
  cargar.hidden = !puede('anadir_capas_proyecto');
  cargar.addEventListener('click', () => selector.click());
  selector.addEventListener('change', async () => {
    const archivos = [...(selector.files ?? [])];
    selector.value = '';
    if (archivos.length === 0) return;
    m.cerrar();
    await opts.alCargarArchivos(archivos);
  });

  cont.append(secLocal, secNube, cargar, selector);
  const unsub = proyecto.suscribir(pintarLocal);
  const m = abrirModal({ etiqueta: 'Capas del proyecto', titulo: 'Añadir capa', contenido: cont, alCerrar: unsub });
  pintarLocal();
  void pintarNube();
}

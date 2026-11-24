import {
  colorRelleno,
  NubeNoDisponible,
  type CapaProyecto,
  type FichaNube,
  type FormatoExport,
  type GestorProyecto,
} from '@/domain/capas';
import { OPACIDAD_RELLENO } from '@/config';
import { puede } from '@/domain/permisos';
import { mostrarAviso } from './aviso';
import { iconoDescargar, iconoEnviar, iconoMas, iconoPapelera, iconoSync } from './iconos';
import { abrirModal } from './modal';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function campo(etiqueta: string, control: HTMLElement): HTMLElement {
  const d = document.createElement('div');
  d.className = 'campo';
  const l = document.createElement('div');
  l.className = 'modal-label';
  l.textContent = etiqueta;
  d.append(l, control);
  return d;
}

const hexARgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ═════════ Editar: nombre, color del borde y color del relleno ═════════ */
export function abrirEditorCapa(capa: CapaProyecto, proyecto: GestorProyecto): void {
  const cont = document.createElement('div');

  const nombre = document.createElement('input');
  nombre.type = 'text';
  nombre.className = 'modal-input';
  nombre.maxLength = 80;
  nombre.value = capa.nombre;
  nombre.autocomplete = 'off';

  const borde = document.createElement('input');
  borde.type = 'color';
  borde.className = 'color-input';
  borde.value = capa.color;
  borde.setAttribute('aria-label', 'Color del borde');

  const relleno = document.createElement('input');
  relleno.type = 'color';
  relleno.className = 'color-input';
  relleno.value = colorRelleno(capa);
  relleno.setAttribute('aria-label', 'Color del relleno');

  const vista = document.createElement('div');
  vista.className = 'vista-capa';
  const pintar = () => {
    vista.style.borderColor = borde.value;
    vista.style.background = hexARgba(relleno.value, OPACIDAD_RELLENO);
  };
  borde.addEventListener('input', pintar);
  relleno.addEventListener('input', pintar);
  pintar();

  const colores = document.createElement('div');
  colores.className = 'colores-fila';
  const colBorde = document.createElement('div');
  colBorde.className = 'color-col';
  colBorde.append(Object.assign(document.createElement('div'), { className: 'modal-label', textContent: 'Color del borde' }), borde);
  const colRelleno = document.createElement('div');
  colRelleno.className = 'color-col';
  colRelleno.append(Object.assign(document.createElement('div'), { className: 'modal-label', textContent: 'Color del relleno' }), relleno);
  colores.append(colBorde, colRelleno, vista);

  cont.append(campo('Nombre', nombre), colores);

  abrirModal({
    titulo: 'Editar capa',
    contenido: cont,
    botones: [
      { texto: 'Cancelar', clase: 'gris' },
      {
        texto: 'Guardar',
        clase: 'azul',
        alPulsar: (cerrar) => {
          if (!proyecto.editar(capa.id, { nombre: nombre.value, color: borde.value, relleno: relleno.value })) {
            mostrarAviso('Escribe un nombre para la capa.', 'error');
            return;
          }
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
  const cont = document.createElement('div');
  const sub = document.createElement('div');
  sub.className = 'modal-sub';
  sub.textContent = capa.nombre;

  // Descargar como
  const etDl = document.createElement('div');
  etDl.className = 'modal-label';
  etDl.textContent = 'Descargar como';
  const fila = document.createElement('div');
  fila.className = 'dl-fila';
  const formatos: [FormatoExport, string][] = [['kml', 'KML'], ['shp', 'SHP'], ['xlsx', 'XLSX']];
  const puedeDescargar = puede('descargar_capas_proyecto');
  for (const [f, texto] of formatos) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-dl';
    b.innerHTML = iconoDescargar(14);
    b.append(Object.assign(document.createElement('span'), { textContent: texto }));
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
    fila.append(b);
  }

  // Compartir con usuario
  const sep = document.createElement('div');
  sep.className = 'modal-sep';
  const etCo = document.createElement('div');
  etCo.className = 'modal-label';
  etCo.textContent = 'Compartir con usuario';
  const correos = document.createElement('input');
  correos.type = 'text';
  correos.className = 'modal-input';
  correos.placeholder = 'usuario@correo.com, otro@correo.com';
  correos.autocomplete = 'off';
  correos.disabled = !proyecto.nubeDisponible;
  const nota = document.createElement('div');
  nota.className = 'modal-nota';
  nota.textContent = proyecto.nubeDisponible ? '' : 'Disponible al conectar con Firebase.';
  nota.hidden = proyecto.nubeDisponible;

  cont.append(sub, etDl, fila, sep, etCo, correos, nota);

  const avisoNube = (e: unknown) =>
    mostrarAviso(e instanceof NubeNoDisponible ? e.message : `No se pudo completar: ${msg(e)}`, 'error');

  const m = abrirModal({
    titulo: 'Descargar / Compartir',
    contenido: cont,
    botones: [
      { texto: 'Cancelar', clase: 'gris' },
      {
        texto: 'Sync',
        clase: 'gris',
        alPulsar: async (_c, b) => {
          b.disabled = true;
          try {
            await proyecto.sincronizar(capa.id);
            mostrarAviso(`«${capa.nombre}» sincronizada: copia guardada en la nube.`);
          } catch (e) {
            avisoNube(e);
          } finally {
            b.disabled = false;
          }
        },
      },
      {
        texto: 'Enviar',
        clase: 'azul',
        alPulsar: async (cerrar, b) => {
          const lista = correos.value.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@'));
          if (!proyecto.nubeDisponible) return avisoNube(new NubeNoDisponible());
          if (lista.length === 0) return mostrarAviso('Introduce al menos un correo válido.', 'error');
          b.disabled = true;
          try {
            await proyecto.compartirCon(capa.id, lista);
            mostrarAviso('Capa compartida.');
            cerrar();
          } catch (e) {
            avisoNube(e);
          } finally {
            b.disabled = false;
          }
        },
      },
    ],
  });
  // Iconos en Sync y Enviar, como los botones de GEOmapas
  m.botones[1]!.insertAdjacentHTML('afterbegin', iconoSync(14));
  m.botones[2]!.insertAdjacentHTML('afterbegin', iconoEnviar(14));
  m.botones[1]!.classList.add('con-icono');
  m.botones[2]!.classList.add('con-icono');
  m.botones[1]!.disabled = !puede('sincronizar_capas_proyecto');
  m.botones[2]!.disabled = !puede('compartir_capas_proyecto');
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
  const cont = document.createElement('div');
  let confirmando: string | null = null;

  const secLocal = document.createElement('div');
  const secNube = document.createElement('div');

  const etiqueta = (t: string) => Object.assign(document.createElement('div'), { className: 'modal-label', textContent: t });

  const fila = (titulo: string, subtexto: string, ...acciones: HTMLElement[]) => {
    const f = document.createElement('div');
    f.className = 'guardada-row';
    const t = document.createElement('div');
    t.className = 'guardada-txt';
    t.append(
      Object.assign(document.createElement('span'), { className: 'capa-nombre', textContent: titulo }),
      Object.assign(document.createElement('span'), { className: 'capa-sub', textContent: subtexto }),
    );
    const a = document.createElement('div');
    a.className = 'guardada-acc';
    a.append(...acciones);
    f.append(t, a);
    return f;
  };

  const pintarLocal = () => {
    secLocal.replaceChildren(etiqueta('Guardadas en este dispositivo'));
    const lista = proyecto.guardadas;
    if (lista.length === 0) {
      secLocal.append(Object.assign(document.createElement('div'), { className: 'proy-vacio', textContent: 'No hay capas guardadas.' }));
      return;
    }
    for (const c of lista) {
      if (c.id === confirmando) {
        const f = document.createElement('div');
        f.className = 'guardada-row confirmar';
        f.append(Object.assign(document.createElement('div'), { className: 'proy-confirmar-txt', textContent: `¿Eliminar «${c.nombre}» para siempre? No se puede deshacer.` }));
        const botones = document.createElement('div');
        botones.className = 'tk-botones';
        const no = Object.assign(document.createElement('button'), { type: 'button', className: 'btn-grande gris', textContent: 'Cancelar' });
        no.addEventListener('click', () => {
          confirmando = null;
          pintarLocal();
        });
        const si = Object.assign(document.createElement('button'), { type: 'button', className: 'btn-grande rojo', textContent: 'Eliminar' });
        si.addEventListener('click', async () => {
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
        secLocal.append(f);
        continue;
      }
      const anadir = Object.assign(document.createElement('button'), { type: 'button', className: 'sec', textContent: 'Añadir' });
      anadir.disabled = !puede('anadir_capas_proyecto');
      anadir.addEventListener('click', () => {
        proyecto.ponerEnPanel(c.id);
        m.cerrar();
        opts.alElegir(c.id);
      });
      const borrar = Object.assign(document.createElement('button'), { type: 'button', className: 'proy-borrar' });
      borrar.innerHTML = iconoPapelera(16);
      borrar.title = 'Eliminar para siempre';
      borrar.setAttribute('aria-label', `Eliminar ${c.nombre} para siempre`);
      borrar.hidden = !puede('eliminar_capas_proyecto');
      borrar.addEventListener('click', () => {
        confirmando = c.id;
        pintarLocal();
      });
      secLocal.append(fila(c.nombre, `${c.nElementos} elementos`, anadir, borrar));
    }
  };

  const pintarNube = async () => {
    secNube.replaceChildren(etiqueta('En la nube'));
    if (!proyecto.nubeDisponible) {
      secNube.append(Object.assign(document.createElement('div'), { className: 'proy-vacio', textContent: 'Nube no conectada todavía.' }));
      return;
    }
    secNube.append(Object.assign(document.createElement('div'), { className: 'proy-vacio', textContent: 'Buscando…' }));
    let fichas: FichaNube[] = [];
    try {
      fichas = await proyecto.listarEnNube();
    } catch (e) {
      mostrarAviso(`No se pudo consultar la nube: ${msg(e)}`, 'error');
    }
    secNube.replaceChildren(etiqueta('En la nube'));
    if (fichas.length === 0) {
      secNube.append(Object.assign(document.createElement('div'), { className: 'proy-vacio', textContent: 'No hay más capas en la nube.' }));
      return;
    }
    for (const f of fichas) {
      const bajar = Object.assign(document.createElement('button'), { type: 'button', className: 'sec', textContent: 'Descargar' });
      bajar.addEventListener('click', async () => {
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
      secNube.append(fila(f.nombre, `${f.nElementos} elementos`, bajar));
    }
  };

  // Cargar un archivo nuevo desde el dispositivo
  const selector = Object.assign(document.createElement('input'), { type: 'file', multiple: true, hidden: true }); // sin "accept": en Android los .shp/.dbf/.kml saldrían en gris
  const cargar = document.createElement('button');
  cargar.type = 'button';
  cargar.className = 'btn-anadir';
  cargar.innerHTML = `${iconoMas(16)}<span>Cargar archivo…</span>`;
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
  const m = abrirModal({ titulo: 'Añadir capa', contenido: cont, alCerrar: unsub });
  pintarLocal();
  void pintarNube();
}

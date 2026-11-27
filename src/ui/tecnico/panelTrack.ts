import { puede } from '@/domain/permisos';
import { compartirGpx, listarTracksFinalizados } from '@/domain/tracks/repositorio';
import { puntosDe, type Instantanea, type TrackRecorder } from '@/domain/tracks/trackRecorder';
import type { TrackRecord } from '@/domain/types';
import { mostrarAviso } from '@/ui/shared/aviso';
import { iconoDescargar, iconoPause, iconoPlay, iconoStop } from '@/ui/shared/iconos';
import type { Traza } from '@/ui/shared/mapa';
import { crearPopover } from '@/ui/shared/superficies';

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const hora = (t: number) => new Date(t).toLocaleTimeString('es-ES');
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/**
 * Panel del recorrido (popover bajo la cabecera): iniciar, pausar, continuar y finalizar, más la lista de recorridos guardados.
 * Este panel solo manda órdenes al grabador y pinta su estado: cerrarlo NO detiene la grabación.
 * El botón de la cabecera se pone coral al grabar y ámbar en pausa (sin puntos que parpadeen).
 */
export function montarPanelTrack(opts: {
  boton: HTMLButtonElement;
  grabador: TrackRecorder;
  /** Línea del recorrido en curso */
  trazaEnCurso: Traza;
  /** Línea de un recorrido guardado que se está consultando */
  trazaGuardada: Traza;
}): void {
  const { boton, grabador, trazaEnCurso, trazaGuardada } = opts;
  const verGrabar = puede('grabar_recorridos');
  const verLista = puede('ver_recorridos_guardados');
  if (!verGrabar && !verLista) return;

  const cont = el('div');
  const cab = el('div', 'popover-cab');
  const stats = el('span', 'dato-mono');
  cab.append(el('span', 'etiqueta-sec', 'Registro de track'), stats);
  const botones = el('div', 'tk-botones');
  const datos = el('div', 'tk-datos');
  if (verGrabar) cont.append(cab, botones, datos);

  const lista = el('div', 'lista-div');
  if (verLista) {
    const sec = el('div', 'tk-lista');
    sec.append(el('div', 'etiqueta-sec', 'Recorridos guardados'), lista);
    cont.append(sec);
  }

  const pop = crearPopover({
    boton,
    zona: 'cabecera',
    alinear: 'fin',
    etiqueta: 'Recorrido (track)',
    contenido: cont,
    ancho: 'tk-ancho',
    alAbrir: () => void pintarLista(),
  });

  let confirmando = false;
  let ocupado = false;

  function btn(texto: string, clase: string, icono: string, accion: () => Promise<void> | void): HTMLButtonElement {
    const b = el('button', `btn ${clase}`);
    b.type = 'button';
    b.innerHTML = icono;
    b.append(document.createTextNode(texto));
    b.disabled = ocupado;
    b.addEventListener('click', () => void ejecutar(accion));
    return b;
  }

  async function ejecutar(accion: () => Promise<void> | void): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    pintar(grabador.instantanea);
    try {
      await accion();
    } catch (e) {
      mostrarAviso(msg(e), 'error');
    } finally {
      ocupado = false;
      pintar(grabador.instantanea);
    }
  }

  function pintar(i: Instantanea): void {
    if (!verGrabar) return;
    const reg = i.registro;
    stats.textContent = reg ? `${reg.pointCount} pts · ${km(reg.lengthM)}` : '';
    if (reg) {
      let t = '';
      if (i.ultimo) t = `último ${hora(i.ultimo.t)} · ±${Math.round(i.ultimo.acc ?? 0)} m`;
      else if (i.estado === 'grabando') t = 'esperando el primer punto GPS…';
      if (i.estado === 'pausado') t = `en pausa${t ? ' · ' + t : ''}`;
      datos.textContent = t;
      datos.hidden = !t;
    } else {
      datos.hidden = true;
    }

    botones.replaceChildren();
    if (i.estado === 'inactivo') {
      confirmando = false;
      botones.className = 'tk-botones uno';
      botones.append(
        btn('Iniciar track', 'btn-acento', iconoPlay(14), async () => {
          trazaEnCurso.limpiar();
          await grabador.iniciar();
        }),
      );
      return;
    }
    botones.className = 'tk-botones';
    if (confirmando) {
      botones.append(
        btn('Cancelar', 'btn-suave', '', () => void (confirmando = false)),
        btn('Sí, finalizar', 'btn-coral', iconoStop(14), async () => {
          confirmando = false;
          const fin = await grabador.parar();
          mostrarAviso(`Recorrido guardado: ${fin.pointCount} puntos, ${km(fin.lengthM)}.`);
          await pintarLista();
        }),
      );
      return;
    }
    botones.append(
      i.estado === 'grabando'
        ? btn('Pausar', 'btn-ambar', iconoPause(14), () => grabador.pausar())
        : btn('Continuar', 'btn-acento', iconoPlay(14), () => grabador.reanudar()),
      btn('Finalizar', 'btn-coral', iconoStop(14), () => void (confirmando = true)),
    );
  }

  async function compartir(reg: TrackRecord): Promise<void> {
    try {
      const abierto = await compartirGpx(reg);
      if (!abierto) mostrarAviso('En el navegador no hay «compartir»; usa el móvil.', 'error');
    } catch (e) {
      mostrarAviso(`No se pudo compartir: ${msg(e)}`, 'error');
    }
  }

  async function pintarLista(): Promise<void> {
    if (!verLista) return;
    const todos = await listarTracksFinalizados();
    lista.replaceChildren();
    if (todos.length === 0) {
      lista.append(el('div', 'vacio', 'Aún no hay recorridos.'));
      return;
    }
    for (const reg of todos) {
      const f = el('div', 'fila');
      const info = el(
        'span',
        'fila-nombre',
        `${new Date(reg.startedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${reg.pointCount} pts · ${km(reg.lengthM)}${reg.recuperado ? ' · recuperado' : ''}`,
      );
      const der = el('div', 'fila-der');
      const ver = el('button', 'btn btn-mini btn-suave', 'Ver');
      ver.type = 'button';
      ver.addEventListener('click', async () => {
        trazaGuardada.dibujar(await puntosDe(reg));
        pop.cerrar();
      });
      const gpx = el('button', 'btn-icono');
      gpx.type = 'button';
      gpx.title = 'Compartir GPX';
      gpx.setAttribute('aria-label', 'Compartir GPX');
      gpx.innerHTML = iconoDescargar(16);
      gpx.addEventListener('click', () => void compartir(reg));
      der.append(ver, gpx);
      f.append(info, der);
      lista.append(f);
    }
  }

  // El botón de la cabecera refleja el estado aunque el panel esté cerrado: coral = grabando, ámbar = en pausa.
  const pintarBoton = (i: Instantanea): void => {
    boton.classList.toggle('grabando', i.estado === 'grabando');
    boton.classList.toggle('pausado', i.estado === 'pausado');
    boton.setAttribute(
      'aria-label',
      i.estado === 'grabando' ? 'Recorrido (track): grabando' : i.estado === 'pausado' ? 'Recorrido (track): en pausa' : 'Recorrido (track)',
    );
  };

  grabador.suscribir((i) => {
    pintarBoton(i);
    pintar(i);
  });
  pintarBoton(grabador.instantanea);
  pintar(grabador.instantanea);
  void pintarLista();
}

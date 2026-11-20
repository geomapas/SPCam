import { puede } from '@/domain/permisos';
import { compartirGpx, listarTracksFinalizados } from '@/domain/tracks/repositorio';
import { puntosDe, type Instantanea, type TrackRecorder } from '@/domain/tracks/trackRecorder';
import type { TrackRecord } from '@/domain/types';
import { mostrarAviso } from '@/ui/shared/aviso';
import { iconoTrack } from '@/ui/shared/iconos';
import type { Traza } from '@/ui/shared/mapa';
import { crearPanelFlotante } from '@/ui/shared/panelFlotante';

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const hora = (t: number) => new Date(t).toLocaleTimeString('es-ES');
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Clase = 'azul' | 'rojo' | 'ambar' | 'gris';

/**
 * Panel del recorrido: iniciar, pausar, reanudar y finalizar, más la lista de recorridos guardados.
 * Este panel solo manda órdenes al grabador y pinta su estado: cerrarlo NO detiene la grabación.
 */
export function montarPanelTrack(opts: {
  boton: HTMLButtonElement;
  contenedor: HTMLElement;
  grabador: TrackRecorder;
  /** Línea roja del recorrido en curso */
  trazaEnCurso: Traza;
  /** Línea azul de un recorrido guardado que se está consultando */
  trazaGuardada: Traza;
}): void {
  const { boton, contenedor, grabador, trazaEnCurso, trazaGuardada } = opts;
  const verGrabar = puede('grabar_recorridos');
  const verLista = puede('ver_recorridos_guardados');
  if (!verGrabar && !verLista) return;

  const panel = crearPanelFlotante({
    titulo: 'Recorrido (track)',
    icono: iconoTrack(14),
    boton,
    contenedor,
    alAbrir: () => void pintarLista(),
  });

  let confirmando = false;
  let ocupado = false;

  // ── Estado y botones de grabación ──
  const etiqueta = document.createElement('div');
  const datos = document.createElement('div');
  const botones = document.createElement('div');
  if (verGrabar) {
    etiqueta.className = 'tk-estado';
    datos.className = 'tk-datos';
    botones.className = 'tk-botones';
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    sec.append(etiqueta, datos, botones);
    panel.cuerpo.append(sec);
  }

  function btn(texto: string, clase: Clase, accion: () => Promise<void> | void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn-grande ${clase}`;
    b.textContent = texto;
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
    etiqueta.className = `tk-estado ${i.estado}`;
    etiqueta.textContent =
      i.estado === 'grabando' ? 'Grabando' : i.estado === 'pausado' ? 'En pausa' : 'Sin grabar';

    if (reg) {
      let t = `${reg.pointCount} puntos · ${km(reg.lengthM)}`;
      if (i.ultimo) t += ` · último ${hora(i.ultimo.t)} · ±${Math.round(i.ultimo.acc ?? 0)} m`;
      else if (i.estado === 'grabando') t += ' · esperando el primer punto GPS…';
      datos.textContent = t;
    } else {
      datos.textContent = 'Pulsa «Iniciar recorrido» para empezar.';
    }

    botones.replaceChildren();
    if (i.estado === 'inactivo') {
      confirmando = false;
      botones.className = 'tk-botones uno';
      botones.append(
        btn('Iniciar recorrido', 'azul', async () => {
          trazaEnCurso.limpiar();
          await grabador.iniciar();
        }),
      );
      return;
    }
    botones.className = 'tk-botones';
    if (confirmando) {
      botones.append(
        btn('Cancelar', 'gris', () => void (confirmando = false)),
        btn('Sí, finalizar', 'rojo', async () => {
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
        ? btn('Pausar', 'ambar', () => grabador.pausar())
        : btn('Reanudar', 'azul', () => grabador.reanudar()),
      btn('Finalizar', 'rojo', () => void (confirmando = true)),
    );
  }

  // ── Recorridos guardados ──
  const lista = document.createElement('ul');
  lista.className = 'lista';
  if (verLista) {
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    sec.innerHTML = `<div class="pc-label">Recorridos guardados</div>`;
    sec.append(lista);
    panel.cuerpo.append(sec);
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
      const li = document.createElement('li');
      li.textContent = 'Aún no hay recorridos.';
      lista.append(li);
      return;
    }
    for (const reg of todos) {
      const li = document.createElement('li');
      const info = document.createElement('span');
      info.textContent = `${new Date(reg.startedAt).toLocaleString('es-ES')} · ${reg.pointCount} pts · ${km(reg.lengthM)}${reg.recuperado ? ' · recuperado' : ''}`;
      const ver = document.createElement('button');
      ver.type = 'button';
      ver.className = 'sec';
      ver.textContent = 'Ver';
      ver.addEventListener('click', async () => {
        trazaGuardada.dibujar(await puntosDe(reg));
        panel.cerrar();
      });
      const comp = document.createElement('button');
      comp.type = 'button';
      comp.className = 'sec';
      comp.textContent = 'GPX';
      comp.addEventListener('click', () => void compartir(reg));
      const acciones = document.createElement('span');
      acciones.className = 'fila';
      acciones.append(ver, comp);
      li.append(info, acciones);
      lista.append(li);
    }
  }

  // El icono de la cabecera refleja el estado aunque el panel esté cerrado:
  // rojo = grabando, ámbar = en pausa.
  const pintarIcono = (i: Instantanea): void => {
    boton.classList.toggle('grabando', i.estado === 'grabando');
    boton.classList.toggle('pausado', i.estado === 'pausado');
    boton.setAttribute(
      'aria-label',
      i.estado === 'grabando'
        ? 'Recorrido (track): grabando'
        : i.estado === 'pausado'
          ? 'Recorrido (track): en pausa'
          : 'Recorrido (track)',
    );
  };

  grabador.suscribir((i) => {
    pintarIcono(i);
    pintar(i);
  });
  pintarIcono(grabador.instantanea);
  pintar(grabador.instantanea);
  void pintarLista();
}

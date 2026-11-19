import '@/ui/shared/estilos.css';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { db, pedirPersistencia } from '@/data/local/db';
import { copiarACacheParaCompartir } from '@/data/files/trackFiles';
import { puntosDe, TrackRecorder } from '@/domain/tracks/trackRecorder';
import type { TrackPoint, TrackRecord } from '@/domain/types';
import { crearMapa, Traza } from '@/ui/shared/mapa';

const panel = document.getElementById('panel')!;
panel.innerHTML = `
  <div class="fila">
    <button id="btn-inicio">Iniciar recorrido</button>
    <button id="btn-parar" class="parar" disabled>Parar</button>
  </div>
  <div class="estado" id="estado">Listo.</div>
  <div id="avisos"></div>
  <strong>Recorridos guardados</strong>
  <ul class="lista" id="lista"></ul>
`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const btnInicio = $<HTMLButtonElement>('btn-inicio');
const btnParar = $<HTMLButtonElement>('btn-parar');
const estado = $('estado');
const avisos = $('avisos');
const lista = $('lista');

const mapa = crearMapa($('mapa'));
const traza = new Traza(mapa);
let primerPunto = true;

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const hora = (t: number) => new Date(t).toLocaleTimeString('es-ES');

function aviso(texto: string, tipo: 'info' | 'error' = 'info'): void {
  const d = document.createElement('div');
  d.className = tipo === 'error' ? 'aviso error' : 'aviso';
  d.textContent = texto;
  avisos.prepend(d);
}

const grabador = new TrackRecorder({
  punto: (p: TrackPoint, reg: TrackRecord) => {
    if (primerPunto) {
      mapa.setView([p.lat, p.lon], 17);
      primerPunto = false;
    }
    traza.anadir(p);
    estado.textContent = `Grabando · ${reg.pointCount} puntos · ${km(reg.lengthM)} · último ${hora(p.t)} · ±${Math.round(p.acc ?? 0)} m`;
  },
  error: (e) => aviso(`Error GPS (${e.code}): ${e.message}`, 'error'),
});

btnInicio.onclick = async () => {
  btnInicio.disabled = true;
  try {
    traza.limpiar();
    primerPunto = true;
    await grabador.iniciar();
    btnParar.disabled = false;
    estado.textContent = 'Grabando… esperando el primer punto GPS.';
  } catch (e) {
    btnInicio.disabled = false;
    aviso(`No se pudo iniciar: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
};

btnParar.onclick = async () => {
  btnParar.disabled = true;
  try {
    const reg = await grabador.parar();
    estado.textContent = `Recorrido guardado: ${reg.pointCount} puntos, ${km(reg.lengthM)}.`;
  } catch (e) {
    aviso(`Error al parar: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    btnInicio.disabled = false;
    await pintarLista();
  }
};

async function compartir(reg: TrackRecord): Promise<void> {
  if (!reg.gpxPath) return aviso('Este recorrido no tiene puntos.', 'error');
  try {
    if (Capacitor.isNativePlatform()) {
      const nombre = `recorrido-${reg.id}.gpx`;
      await Share.share({ title: 'Recorrido GPX', url: await copiarACacheParaCompartir(reg.gpxPath, nombre) });
    } else {
      aviso('En el navegador no hay "compartir"; usa el móvil.', 'error');
    }
  } catch (e) {
    aviso(`No se pudo compartir: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

async function pintarLista(): Promise<void> {
  const todos = (await db.tracks.orderBy('startedAt').reverse().toArray()).filter((t) => t.status === 'finalizado');
  lista.innerHTML = '';
  if (todos.length === 0) {
    lista.innerHTML = '<li>Aún no hay recorridos.</li>';
    return;
  }
  for (const reg of todos) {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.textContent = `${new Date(reg.startedAt).toLocaleString('es-ES')} · ${reg.pointCount} pts · ${km(reg.lengthM)}${reg.recuperado ? ' · recuperado' : ''}`;
    const ver = document.createElement('button');
    ver.className = 'sec';
    ver.textContent = 'Ver';
    ver.onclick = async () => traza.dibujar(await puntosDe(reg));
    const comp = document.createElement('button');
    comp.className = 'sec';
    comp.textContent = 'GPX';
    comp.onclick = () => void compartir(reg);
    const acciones = document.createElement('span');
    acciones.className = 'fila';
    acciones.append(ver, comp);
    li.append(info, acciones);
    lista.append(li);
  }
}

async function arrancar(): Promise<void> {
  await pedirPersistencia();
  const recuperados = await grabador.recuperarPendientes();
  if (recuperados.length > 0) {
    aviso(`Se recuperaron ${recuperados.length} recorrido(s) que quedaron abiertos al cerrarse la app.`);
  }
  await pintarLista();
}
void arrancar();

import '@/ui/shared/tema';
import { crearGestorCapas, crearGestorProyecto } from '@/domain/capas';
import { pedirPersistencia } from '@/domain/tracks/repositorio';
import { TrackRecorder } from '@/domain/tracks/trackRecorder';
import { montarCabecera } from '@/ui/shared/cabecera';
import { mostrarAviso } from '@/ui/shared/aviso';
import { crearMapa, Traza } from '@/ui/shared/mapa';
import { montarPanelCapas } from '@/ui/shared/panelCapas';
import { montarPanelTrack } from './panelTrack';

const { botonCapas, botonTrack } = montarCabecera({ conTrack: true });
const contenedor = document.querySelector<HTMLElement>('.mapa-wrap')!;

const app = crearMapa(document.getElementById('mapa')!);
const mapa = app.map;
const trazaEnCurso = new Traza(mapa); // roja: el recorrido que se está grabando
const trazaGuardada = new Traza(mapa, '#2f6fde'); // azul: un recorrido guardado que se consulta

let centrado = false;
const grabador = new TrackRecorder({
  punto: (p) => {
    if (!centrado) {
      mapa.setView([p.lat, p.lon], 17);
      centrado = true;
    }
    trazaEnCurso.anadir(p);
  },
  error: (e) => mostrarAviso(`Error GPS (${e.code}): ${e.message}`, 'error'),
});

grabador.suscribir((i) => {
  if (i.estado === 'inactivo') centrado = false;
});

if (botonTrack) montarPanelTrack({ boton: botonTrack, contenedor, grabador, trazaEnCurso, trazaGuardada });

async function arrancar(): Promise<void> {
  // Mapa base y capas temáticas (preferencias guardadas en el dispositivo)
  const [gestor, proyecto] = await Promise.all([crearGestorCapas(), crearGestorProyecto()]);
  app.conectar(gestor);
  app.conectarProyecto(proyecto);
  montarPanelCapas({
    gestor,
    proyecto,
    boton: botonCapas,
    contenedor,
    alZoom: (id) => void app.zoomACapa(id),
  });

  await pedirPersistencia();
  const recuperados = await grabador.recuperarPendientes();
  if (recuperados.length > 0) {
    mostrarAviso(`Se recuperaron ${recuperados.length} recorrido(s) que quedaron abiertos al cerrarse la app.`);
  }
}
void arrancar();

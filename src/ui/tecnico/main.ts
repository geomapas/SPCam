import '@/ui/shared/tema';
import { crearGestorCapas, crearGestorProyecto } from '@/domain/capas';
import { pedirPersistencia } from '@/domain/tracks/repositorio';
import { TrackRecorder } from '@/domain/tracks/trackRecorder';
import { mostrarAviso } from '@/ui/shared/aviso';
import { montarBotonUbicacion } from '@/ui/shared/botonUbicacion';
import { montarCabecera } from '@/ui/shared/cabecera';
import { montarDock } from '@/ui/shared/dock';
import { crearMapa, Traza } from '@/ui/shared/mapa';
import { montarPanelAjustes } from '@/ui/shared/panelAjustes';
import { montarPanelCapas } from '@/ui/shared/panelCapas';
import { montarPanelUsuario } from '@/ui/shared/panelUsuario';
import { montarSelectorBase } from '@/ui/shared/selectorBase';
import { montarPanelTrack } from './panelTrack';

const { botonUsuario, botonUbicacion, botonTrack } = montarCabecera({ conTrack: true });
const dock = montarDock();
montarPanelAjustes({ boton: dock.botonAjustes });
montarPanelUsuario({
  boton: botonUsuario,
  motivoBloqueo: () =>
    grabador.estado !== 'inactivo' ? 'Hay un recorrido en curso. Finalízalo antes de cerrar sesión.' : null,
});

const app = crearMapa(document.getElementById('mapa')!);
if (botonUbicacion) montarBotonUbicacion({ boton: botonUbicacion, app });
const mapa = app.map;
const trazaEnCurso = new Traza(mapa); // coral: el recorrido que se está grabando
const trazaGuardada = new Traza(mapa, '#38bdf8'); // azul: un recorrido guardado que se consulta

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

if (botonTrack) montarPanelTrack({ boton: botonTrack, grabador, trazaEnCurso, trazaGuardada });

async function arrancar(): Promise<void> {
  // Mapa base y capas (preferencias y capas guardadas en el dispositivo)
  const [gestor, proyecto] = await Promise.all([crearGestorCapas(), crearGestorProyecto()]);
  app.conectar(gestor);
  app.conectarProyecto(proyecto);
  montarSelectorBase({ gestor, boton: dock.botonBase, pintarBoton: dock.pintarBase });
  montarPanelCapas({ gestor, proyecto, boton: dock.botonCapas, alZoom: (id) => void app.zoomACapa(id) });

  await pedirPersistencia();
  const recuperados = await grabador.recuperarPendientes();
  if (recuperados.length > 0) {
    mostrarAviso(`Se recuperaron ${recuperados.length} recorrido(s) que quedaron abiertos al cerrarse la app.`);
  }
}
void arrancar();

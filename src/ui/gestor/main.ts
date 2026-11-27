import '@/ui/shared/tema';
import { crearGestorCapas, crearGestorProyecto } from '@/domain/capas';
import { longitudM } from '@/domain/tracks/geo';
import { leerGpx } from '@/domain/tracks/gpx';
import { montarBotonUbicacion } from '@/ui/shared/botonUbicacion';
import { montarCabecera } from '@/ui/shared/cabecera';
import { montarDock } from '@/ui/shared/dock';
import { crearMapa, Traza } from '@/ui/shared/mapa';
import { montarPanelAjustes } from '@/ui/shared/panelAjustes';
import { montarPanelCapas } from '@/ui/shared/panelCapas';
import { montarPanelUsuario } from '@/ui/shared/panelUsuario';
import { montarSelectorBase } from '@/ui/shared/selectorBase';

const { botonUsuario, botonUbicacion } = montarCabecera({ subtitulo: 'Gestor' });
const dock = montarDock();
montarPanelAjustes({ boton: dock.botonAjustes });
montarPanelUsuario({ boton: botonUsuario });

const app = crearMapa(document.getElementById('mapa')!);
if (botonUbicacion) montarBotonUbicacion({ boton: botonUbicacion, app });
const traza = new Traza(app.map);

// Comprobación provisional de la capa compartida: cargar un GPX y verlo en el mapa
const pill = document.createElement('div');
pill.className = 'gpx-pill';
pill.innerHTML = `<div class="vidrio">
  <label>Cargar un GPX para comprobar la capa compartida: <input id="archivo" type="file" accept=".gpx,application/gpx+xml,text/xml" /></label>
  <div id="estado" class="nota" style="margin-top:6px">Esqueleto del gestor. Aquí irán datos, zonas y exportaciones.</div>
</div>`;
document.body.append(pill);
const estado = pill.querySelector<HTMLElement>('#estado')!;
pill.querySelector('#archivo')!.addEventListener('change', async (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const puntos = leerGpx(await f.text());
    traza.dibujar(puntos);
    estado.textContent = `${f.name}: ${puntos.length} puntos, ${(longitudM(puntos) / 1000).toFixed(2)} km`;
  } catch (e) {
    estado.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
});

void Promise.all([crearGestorCapas(), crearGestorProyecto()]).then(([gestor, proyecto]) => {
  app.conectar(gestor);
  app.conectarProyecto(proyecto);
  montarSelectorBase({ gestor, boton: dock.botonBase, pintarBoton: dock.pintarBase });
  montarPanelCapas({ gestor, proyecto, boton: dock.botonCapas, alZoom: (id) => void app.zoomACapa(id) });
});

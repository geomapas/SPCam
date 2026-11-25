import '@/ui/shared/tema';
import { crearGestorCapas, crearGestorProyecto } from '@/domain/capas';
import { longitudM } from '@/domain/tracks/geo';
import { leerGpx } from '@/domain/tracks/gpx';
import { montarCabecera } from '@/ui/shared/cabecera';
import { crearMapa, Traza } from '@/ui/shared/mapa';
import { montarPanelCapas } from '@/ui/shared/panelCapas';
import { montarSelectorBase } from '@/ui/shared/selectorBase';

const { botonCapas } = montarCabecera({ subtitulo: 'Gestor' });
const contenedor = document.querySelector<HTMLElement>('.mapa-wrap')!;
const app = crearMapa(document.getElementById('mapa')!);
const traza = new Traza(app.map);
const estado = document.getElementById('estado')!;

void Promise.all([crearGestorCapas(), crearGestorProyecto()]).then(([gestor, proyecto]) => {
  app.conectar(gestor);
  app.conectarProyecto(proyecto);
  montarSelectorBase({ gestor, contenedor });
  montarPanelCapas({
    gestor,
    proyecto,
    boton: botonCapas,
    contenedor,
    alZoom: (id) => void app.zoomACapa(id),
  });
});

document.getElementById('archivo')!.addEventListener('change', async (ev) => {
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

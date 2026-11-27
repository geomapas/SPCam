import { fijarTema, temaActual, type Tema } from './tema';
import { iconoLuna, iconoSol } from './iconos';
import { crearPopover } from './superficies';

/** Ajustes: por ahora, la apariencia (claro u oscuro). */
export function montarPanelAjustes(opts: { boton: HTMLButtonElement }): void {
  const cont = document.createElement('div');
  const fila = document.createElement('div');
  fila.className = 'aj-fila';
  const titulo = document.createElement('span');
  titulo.className = 'aj-titulo';
  titulo.textContent = 'Apariencia';
  const grupo = document.createElement('div');
  grupo.className = 'segmentado';
  const botones = new Map<Tema, HTMLButtonElement>();
  const def: [Tema, string, string][] = [['claro', 'Claro', iconoSol(14)], ['oscuro', 'Oscuro', iconoLuna(14)]];
  for (const [tema, texto, icono] of def) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-opcion';
    b.innerHTML = icono;
    b.append(document.createTextNode(texto));
    b.addEventListener('click', () => {
      fijarTema(tema);
      pintar();
    });
    botones.set(tema, b);
    grupo.append(b);
  }
  fila.append(titulo, grupo);
  cont.append(fila);

  const pintar = () => botones.forEach((b, t) => b.setAttribute('aria-pressed', String(t === temaActual())));
  pintar();
  crearPopover({ boton: opts.boton, zona: 'dock', alinear: 'fin', etiqueta: 'Ajustes', contenido: cont, ancho: 'ancho-64', alAbrir: pintar });
}

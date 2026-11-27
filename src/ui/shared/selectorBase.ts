import { MAPAS_BASE, type GestorCapas } from '@/domain/capas';
import { puede } from '@/domain/permisos';
import { miniaturaDe } from './miniaturas';
import { crearPopover } from './superficies';

/**
 * Selector de mapa base: la miniatura del dock muestra el actual y, al tocarla, un popover ofrece las opciones
 * como tarjetas con miniatura. Al elegir una se cierra.
 */
export function montarSelectorBase(opts: {
  gestor: GestorCapas;
  boton: HTMLButtonElement;
  pintarBoton: (svg: string, rotulo: string) => void;
}): void {
  const { gestor, boton, pintarBoton } = opts;
  if (!puede('cambiar_mapa_base')) {
    boton.hidden = true;
    return;
  }

  const lista = document.createElement('div');
  lista.className = 'base-opciones';
  lista.setAttribute('role', 'radiogroup');
  lista.setAttribute('aria-label', 'Mapa base');
  const tarjetas = new Map<string, HTMLButtonElement>();
  for (const m of MAPAS_BASE) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'base-opcion';
    b.setAttribute('role', 'radio');
    const mini = document.createElement('div');
    mini.className = 'base-mini';
    mini.innerHTML = miniaturaDe(m.icono);
    const t = document.createElement('span');
    t.textContent = m.nombre;
    b.append(mini, t);
    b.addEventListener('click', () => {
      gestor.cambiarBase(m.id);
      pop.cerrar();
    });
    tarjetas.set(m.id, b);
    lista.append(b);
  }
  const pop = crearPopover({ boton, zona: 'dock', alinear: 'inicio', etiqueta: 'Mapa base', contenido: lista });

  const pintar = (base: string): void => {
    const def = MAPAS_BASE.find((m) => m.id === base);
    if (def) pintarBoton(miniaturaDe(def.icono), def.etiqueta);
    tarjetas.forEach((b, id) => b.setAttribute('aria-checked', String(id === base)));
  };
  pintar(gestor.estado.base);
  gestor.suscribir((e) => pintar(e.base));
}

import { iconoAjustes, iconoCapas } from './iconos';

export interface Dock {
  /** Miniatura del mapa base actual: abre el selector */
  botonBase: HTMLButtonElement;
  /** Abre la hoja de capas */
  botonCapas: HTMLButtonElement;
  /** Abre los ajustes (apariencia) */
  botonAjustes: HTMLButtonElement;
  /** Pone la miniatura y el rótulo del mapa base elegido */
  pintarBase(svg: string, rotulo: string): void;
}

/** Dock inferior flotante: mapa base, capas y ajustes. Los botones se conectan a sus paneles desde fuera. */
export function montarDock(): Dock {
  const nav = document.createElement('nav');
  nav.className = 'dock';
  nav.innerHTML = `
    <div class="dock-barra vidrio">
      <button class="dock-base" id="dk-base" type="button" aria-label="Cambiar mapa base">
        <span class="dock-base-miniatura"></span><span class="dock-base-texto"></span>
      </button>
      <button class="dock-boton" id="dk-capas" type="button" aria-label="Capas" title="Capas">${iconoCapas(26)}</button>
      <button class="dock-boton" id="dk-ajustes" type="button" aria-label="Ajustes" title="Ajustes">${iconoAjustes(26)}</button>
    </div>`;
  document.body.append(nav);
  const botonBase = nav.querySelector<HTMLButtonElement>('#dk-base')!;
  const mini = nav.querySelector<HTMLElement>('.dock-base-miniatura')!;
  const texto = nav.querySelector<HTMLElement>('.dock-base-texto')!;
  return {
    botonBase,
    botonCapas: nav.querySelector<HTMLButtonElement>('#dk-capas')!,
    botonAjustes: nav.querySelector<HTMLButtonElement>('#dk-ajustes')!,
    pintarBase(svg, rotulo) {
      mini.innerHTML = svg;
      texto.textContent = rotulo;
    },
  };
}

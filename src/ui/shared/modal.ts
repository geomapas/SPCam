import { iconoCerrar } from './iconos';

export interface BotonModal {
  texto: string;
  clase?: 'acento' | 'suave' | 'coral' | 'ambar';
  /** Qué hacer al pulsar. Si no se indica, el botón solo cierra la ventana. */
  alPulsar?: (cerrar: () => void, boton: HTMLButtonElement) => void | Promise<void>;
}

export interface ModalAbierto {
  cerrar: () => void;
  botones: HTMLButtonElement[];
}

/**
 * Ventana centrada (tarjeta redondeada sobre fondo oscurecido): etiqueta pequeña + título, X para cerrar,
 * contenido y, opcionalmente, botones de acción. Se cierra con la X, tocando fuera o con Escape.
 */
export function abrirModal(opts: {
  etiqueta?: string;
  titulo: string;
  contenido: HTMLElement;
  botones?: BotonModal[];
  alCerrar?: () => void;
}): ModalAbierto {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  const tarjeta = document.createElement('div');
  tarjeta.className = 'modal-tarjeta';
  tarjeta.setAttribute('role', 'dialog');
  tarjeta.setAttribute('aria-modal', 'true');
  tarjeta.setAttribute('aria-label', opts.titulo);

  const cab = document.createElement('div');
  cab.className = 'modal-cab';
  const textos = document.createElement('div');
  if (opts.etiqueta) {
    const e = document.createElement('p');
    e.className = 'modal-etiqueta';
    e.textContent = opts.etiqueta;
    textos.append(e);
  }
  const t = document.createElement('h3');
  t.className = 'modal-titulo';
  t.textContent = opts.titulo;
  textos.append(t);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'btn-cerrar';
  x.setAttribute('aria-label', 'Cerrar');
  x.innerHTML = iconoCerrar(14);
  cab.append(textos, x);

  tarjeta.append(cab, opts.contenido);

  let abierto = true;
  const alTeclado = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') cerrar();
  };
  function cerrar(): void {
    if (!abierto) return;
    abierto = false;
    document.removeEventListener('keydown', alTeclado);
    fondo.remove();
    opts.alCerrar?.();
  }

  const botones: HTMLButtonElement[] = [];
  if (opts.botones?.length) {
    const acciones = document.createElement('div');
    acciones.className = 'modal-acciones';
    for (const def of opts.botones) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn-${def.clase ?? 'suave'}`;
      b.textContent = def.texto;
      b.addEventListener('click', async () => {
        if (!def.alPulsar) return cerrar();
        await def.alPulsar(cerrar, b);
      });
      acciones.append(b);
      botones.push(b);
    }
    tarjeta.append(acciones);
  }

  x.addEventListener('click', cerrar);
  fondo.addEventListener('click', (ev) => {
    if (ev.target === fondo) cerrar();
  });
  fondo.append(tarjeta);
  document.addEventListener('keydown', alTeclado);
  document.body.append(fondo);
  return { cerrar, botones };
}

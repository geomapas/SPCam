export interface BotonModal {
  texto: string;
  clase?: 'azul' | 'rojo' | 'gris' | 'ambar';
  /** Qué hacer al pulsar. Si no se indica, el botón solo cierra la ventana. */
  alPulsar?: (cerrar: () => void, boton: HTMLButtonElement) => void | Promise<void>;
  /** Con alPulsar: false = la ventana sigue abierta salvo que alPulsar la cierre. Por defecto false. */
  cierra?: boolean;
}

export interface ModalAbierto {
  cerrar: () => void;
  botones: HTMLButtonElement[];
}

/**
 * Ventana modal sencilla (fondo oscurecido + tarjeta), con el aspecto de las de GEOmapas.
 * Se cierra con Escape, tocando fuera o con un botón. Por defecto lleva un único botón «Cerrar».
 */
export function abrirModal(opts: {
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

  const titulo = document.createElement('div');
  titulo.className = 'modal-titulo';
  titulo.textContent = opts.titulo;

  const acciones = document.createElement('div');
  acciones.className = 'modal-acciones';

  tarjeta.append(titulo, opts.contenido, acciones);
  fondo.append(tarjeta);

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

  const botones = (opts.botones ?? [{ texto: 'Cerrar', clase: 'gris' }]).map((def) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn-grande ${def.clase ?? 'gris'}`;
    b.textContent = def.texto;
    b.addEventListener('click', async () => {
      if (!def.alPulsar) return cerrar();
      await def.alPulsar(cerrar, b);
      if (def.cierra) cerrar();
    });
    acciones.append(b);
    return b;
  });

  fondo.addEventListener('click', (ev) => {
    if (ev.target === fondo) cerrar();
  });
  document.addEventListener('keydown', alTeclado);
  document.body.append(fondo);
  return { cerrar, botones };
}

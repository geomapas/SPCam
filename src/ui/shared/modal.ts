/**
 * Ventana modal sencilla (fondo oscurecido + tarjeta), con el aspecto de las de GEOmapas.
 * Se cierra con el botón, con Escape o tocando fuera. Devuelve la función para cerrarla desde fuera.
 */
export function abrirModal(opts: { titulo: string; contenido: HTMLElement; textoCerrar?: string }): () => void {
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
  const cerrarBtn = document.createElement('button');
  cerrarBtn.type = 'button';
  cerrarBtn.className = 'btn-grande gris';
  cerrarBtn.textContent = opts.textoCerrar ?? 'Cerrar';
  acciones.append(cerrarBtn);

  tarjeta.append(titulo, opts.contenido, acciones);
  fondo.append(tarjeta);

  const alTeclado = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') cerrar();
  };
  function cerrar(): void {
    document.removeEventListener('keydown', alTeclado);
    fondo.remove();
  }
  cerrarBtn.addEventListener('click', cerrar);
  fondo.addEventListener('click', (ev) => {
    if (ev.target === fondo) cerrar();
  });
  document.addEventListener('keydown', alTeclado);
  document.body.append(fondo);
  return cerrar;
}

/**
 * Avisos breves sobre el mapa (errores del GPS, recorridos recuperados…).
 * Se muestran aunque ningún panel esté abierto. Tocar un aviso lo cierra.
 */
export function mostrarAviso(texto: string, tipo: 'info' | 'error' = 'info'): void {
  let zona = document.getElementById('avisos-flotantes');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'avisos-flotantes';
    document.body.append(zona);
  }
  const d = document.createElement('div');
  d.className = tipo === 'error' ? 'aviso-flot error' : 'aviso-flot';
  d.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  d.textContent = texto;
  const quitar = () => d.remove();
  d.addEventListener('click', quitar);
  zona.append(d);
  setTimeout(quitar, tipo === 'error' ? 10000 : 6000);
}

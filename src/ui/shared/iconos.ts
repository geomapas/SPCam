const svg = (cuerpo: string, size = 16, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${cuerpo}</svg>`;

export const iconoCapas = (s = 16) =>
  svg('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>', s);

export const iconoTrack = (s = 16) =>
  svg('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>', s);

export const iconoCerrar = (s = 16) =>
  svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s);

export const iconoSatelite = (s = 16) =>
  svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', s);

export const iconoMapa = (s = 16) =>
  svg('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>', s);

/** Pin del logotipo (el mismo de GEOmapas). Trazo blanco sobre el cuadrado azul. */
export const iconoLogo = (s = 18) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2 C6.5 2 4 5 4 8 C4 13 10 19 10 19 C10 19 16 13 16 8 C16 5 13.5 2 10 2 Z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="8" r="2.5" stroke="white" stroke-width="1.8"/></svg>`;

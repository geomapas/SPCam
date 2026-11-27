/** Miniaturas ilustradas de los mapas base (las del diseño de referencia). El mapa cambia de color con el tema. */
const f = (v: string) => `style="fill:var(${v})"`;
const s = (v: string) => `style="stroke:var(${v})"`;

export const miniaturaOrto = (): string =>
  `<svg viewBox="0 0 80 44" preserveAspectRatio="none" aria-hidden="true">
    <rect width="80" height="44" fill="#3a4a2c"/><polygon points="0,0 38,0 30,22 0,18" fill="#526338"/>
    <polygon points="38,0 80,0 80,26 30,22" fill="#2b3821"/><polygon points="0,18 30,22 24,44 0,44" fill="#687344"/>
    <polygon points="30,22 80,26 80,44 24,44" fill="#3f4f2f"/>
    <path d="M 0,18 L 80,26 M 38,0 L 24,44" stroke="#a39778" stroke-width="1.5" opacity="0.85" fill="none"/>
    <circle cx="54" cy="12" r="4" fill="#1e2916" opacity="0.7"/><circle cx="62" cy="14" r="5" fill="#1e2916" opacity="0.7"/>
    <circle cx="15" cy="32" r="4.5" fill="#1e2916" opacity="0.65"/></svg>`;

export const miniaturaMapa = (): string =>
  `<svg viewBox="0 0 80 44" preserveAspectRatio="none" aria-hidden="true">
    <rect width="80" height="44" ${f('--mini-mapa-fondo')}/><polygon points="52,0 80,0 80,18 58,15" ${f('--mini-mapa-verde')}/>
    <path d="M 0,34 Q 35,30 80,38" fill="none" stroke="#38bdf8" stroke-width="3.5" opacity="0.75"/>
    <path d="M 0,12 L 80,20 M 26,0 L 20,44 M 55,0 L 48,44" fill="none" ${s('--mini-mapa-calle')} stroke-width="3"/>
    <path d="M 0,12 L 80,20" fill="none" stroke="#fbbf24" stroke-width="1.2"/></svg>`;

export const miniaturaDe = (icono: 'satelite' | 'mapa'): string => (icono === 'satelite' ? miniaturaOrto() : miniaturaMapa());

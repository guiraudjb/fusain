// Formats de page (millimètres)
export const FORMATS = { A4: [210, 297], A3: [297, 420] };
export const ORIENTATIONS = ['portrait', 'paysage'];
export const MODES_AJUSTEMENT = ['page', 'largeur', 'hauteur', 'manuel'];
export const ALIGNEMENTS = ['haut', 'centre', 'bas'];
export const MM_PAR_PX = 25.4 / 96;

export function dimensions(page) {
    const [court, long] = FORMATS[page.format] || FORMATS.A4;
    return page.orientation === 'paysage' ? { l: long, h: court } : { l: court, h: long };
}

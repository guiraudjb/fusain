// Icônes illustrées (images) pour les schémas d'architecture : celles de SimpleCarto et celles de FUSAIN, générées
// localement (outils/illustrations). Un fichier par thème, lu à la demande. Dans le code Mermaid : « illus:nom ».
import { s } from './dom.js';

export const PREFIXE_ILLUS = 'illus';
const DOSSIER = './icones/illustrees/';
const IMAGE = /^[A-Za-z0-9+/]+=*$/;
const ID = /^[a-z0-9-]+$/;

async function lire(adresse, integrite) {
    const reponse = await fetch(adresse, { integrity: integrite || undefined });
    if (!reponse.ok) throw new Error('Les icônes illustrées n\'ont pas pu être chargées.');
    return reponse.json();
}

let index = null;
// Liste des thèmes et des icônes (identifiant et nom français), sans les images
export function chargerIndex() {
    index ||= (async () => {
        const source = document.getElementById('fusain-illustrations');
        const { themes } = await lire(source.getAttribute('href'), source.getAttribute('integrity'));
        const parIcone = new Map();
        for (const t of themes) for (const [id, nom] of t.icones) if (ID.test(id)) parIcone.set(id, { id, nom, theme: t.id, nomTheme: t.nom });
        return { themes, parIcone };
    })().catch((e) => { index = null; throw e; });
    return index;
}

const themes = new Map();
// Images d'un thème ; l'empreinte du fichier vient de l'index, lui-même contrôlé par index.html
export async function chargerTheme(id) {
    const { themes: liste } = await chargerIndex();
    const theme = liste.find((t) => t.id === id);
    if (!theme) throw new Error('Thème d\'icônes inconnu.');
    if (!themes.has(id)) themes.set(id, lire(DOSSIER + theme.fichier, theme.integrite).then((d) => d.icones).catch((e) => { themes.delete(id); throw e; }));
    return themes.get(id);
}

export async function adresseImage(id) {
    const { parIcone } = await chargerIndex();
    const icone = parIcone.get(id);
    const donnees = icone && (await chargerTheme(icone.theme))[id];
    return donnees && IMAGE.test(donnees) ? `data:image/png;base64,${donnees}` : null;
}

// Pour Mermaid, chaque icône illustrée est un emplacement vide de 80 px qui porte son nom. Mermaid ne reçoit
// jamais l'image : elle est posée par FUSAIN après l'assainissement du schéma (incorporerImages).
export async function jeuPourMermaid() {
    const { parIcone } = await chargerIndex();
    const icons = {};
    for (const id of parIcone.keys()) icons[id] = { body: `<rect width="80" height="80" fill="#ffffff" fill-opacity="0" data-fusain-image="${id}"/>` };
    return { prefix: PREFIXE_ILLUS, width: 80, height: 80, icons };
}

export async function incorporerImages(svg) {
    for (const place of [...svg.querySelectorAll('[data-fusain-image]')]) {
        const adresse = await adresseImage(place.getAttribute('data-fusain-image')).catch(() => null);
        if (adresse) place.replaceWith(s('image', { x: 0, y: 0, width: 80, height: 80, href: adresse, preserveAspectRatio: 'xMidYMid meet' }));
        else place.removeAttribute('data-fusain-image');
    }
}

// Mise en forme des documents Markdown joints à FUSAIN (guide, cahier des charges, nomenclature), pour la fenêtre « À propos ».
// Le texte est découpé puis reconstruit nœud par nœud : aucune chaîne n'est interprétée comme du HTML (cahier des charges §7.3),
// si bien qu'une balise écrite dans un document s'affiche telle quelle. Sous-ensemble traité : titres, paragraphes, listes,
// tableaux, blocs de code, citations, filets, gras, italique, code, liens.

import { h } from './dom.js';

const TITRE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FILET = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ELEMENT = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const CLOTURE = /^\s*(```|~~~)/;
const SEPARATEUR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const EN_LIGNE = /(`+)(.+?)\1|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\(([^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g;

// Ancre d'un titre, calculée comme le fait GitHub, pour que les sommaires écrits à la main fonctionnent
function ancre(texte, dejaVues) {
    const base = texte.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const rang = dejaVues.get(base) || 0;
    dejaVues.set(base, rang + 1);
    return rang ? `${base}-${rang}` : base;
}

function lien(adresse, enfants, prefixe) {
    // Seules les ancres du document et les adresses web sont suivies ; toute autre cible reste du texte
    if (adresse.startsWith('#')) {
        return h('a', { href: adresse, onclick: (e) => {
            e.preventDefault();
            const cible = document.getElementById(prefixe + decodeURIComponent(adresse.slice(1)));
            cible?.scrollIntoView({ block: 'start' });
            cible?.focus({ preventScroll: true });
        } }, enfants);
    }
    if (/^https?:\/\//i.test(adresse)) return h('a', { href: adresse, target: '_blank', rel: 'noopener noreferrer' }, enfants);
    return enfants;
}

function enLigne(texte, prefixe) {
    const noeuds = [];
    let fin = 0;
    for (const m of texte.matchAll(EN_LIGNE)) {
        if (m.index > fin) noeuds.push(texte.slice(fin, m.index));
        if (m[1]) noeuds.push(h('code', {}, m[2].trim()));
        else if (m[3]) noeuds.push(h('strong', {}, enLigne(m[3], prefixe)));
        else if (m[4]) noeuds.push(h('em', {}, enLigne(m[4], prefixe)));
        else if (m[5]) noeuds.push(lien(m[6], enLigne(m[5], prefixe), prefixe));
        else noeuds.push(lien(m[7], [m[7]], prefixe));
        fin = m.index + m[0].length;
    }
    if (fin < texte.length) noeuds.push(texte.slice(fin));
    return noeuds;
}

// Une barre verticale dans un passage de code ou précédée d'une barre oblique ne sépare pas deux cellules
function cellules(ligne) {
    const resultat = [];
    let courante = '';
    let code = false;
    const texte = ligne.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let i = 0; i < texte.length; i += 1) {
        const c = texte[i];
        if (c === '\\' && texte[i + 1] === '|') { courante += '|'; i += 1; }
        else if (c === '|' && !code) { resultat.push(courante.trim()); courante = ''; }
        else { if (c === '`') code = !code; courante += c; }
    }
    resultat.push(courante.trim());
    return resultat;
}

// Rend le document dans un conteneur. « decalage » abaisse le niveau des titres : la modale porte déjà le titre de niveau 1.
export function rendreMarkdown(source, { prefixe = 'doc-', decalage = 1 } = {}) {
    const lignes = source.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
    const racine = h('div', { class: 'fusain-document' });
    const ancres = new Map();
    const debutDeBloc = (l) => !l.trim() || TITRE.test(l) || FILET.test(l) || ELEMENT.test(l) || CLOTURE.test(l) || /^\s*[|>]/.test(l);
    let i = 0;
    while (i < lignes.length) {
        const ligne = lignes[i];
        let m;
        if (!ligne.trim()) { i += 1; continue; }
        if ((m = CLOTURE.exec(ligne))) {
            const contenu = [];
            for (i += 1; i < lignes.length && !lignes[i].trim().startsWith(m[1]); i += 1) contenu.push(lignes[i]);
            i += 1;
            racine.append(h('pre', { tabindex: '0' }, h('code', {}, contenu.join('\n'))));
        } else if ((m = TITRE.exec(ligne))) {
            const contenu = enLigne(m[2], prefixe);
            const titre = h(`h${Math.min(6, m[1].length + decalage)}`, { tabindex: '-1' }, contenu);
            titre.id = prefixe + ancre(titre.textContent, ancres);
            racine.append(titre);
            i += 1;
        } else if (FILET.test(ligne)) {
            racine.append(h('hr', {}));
            i += 1;
        } else if (/^\s*\|/.test(ligne) && SEPARATEUR.test(lignes[i + 1] || '')) {
            const entetes = cellules(ligne);
            const corps = [];
            for (i += 2; i < lignes.length && /^\s*\|/.test(lignes[i]); i += 1) corps.push(cellules(lignes[i]));
            racine.append(h('div', { class: 'fr-table fr-table--sm' }, h('table', {},
                h('thead', {}, h('tr', {}, entetes.map((c) => h('th', { scope: 'col' }, enLigne(c, prefixe))))),
                h('tbody', {}, corps.map((rangee) => h('tr', {}, entetes.map((_, n) => h('td', {}, enLigne(rangee[n] || '', prefixe)))))))));
        } else if ((m = ELEMENT.exec(ligne))) {
            const ordonnee = /\d/.test(m[2]);
            const elements = [];
            while (i < lignes.length && (m = ELEMENT.exec(lignes[i])) && /\d/.test(m[2]) === ordonnee) {
                let texte = m[3];
                // Les lignes en retrait qui suivent prolongent l'élément
                for (i += 1; i < lignes.length && /^\s+\S/.test(lignes[i]) && !ELEMENT.test(lignes[i]); i += 1) texte += ` ${lignes[i].trim()}`;
                elements.push(h('li', {}, enLigne(texte, prefixe)));
            }
            const debut = ordonnee ? parseInt(ELEMENT.exec(ligne)[2], 10) : 1;
            racine.append(h(ordonnee ? 'ol' : 'ul', { start: debut > 1 ? debut : null }, elements));
        } else if (/^\s*>/.test(ligne)) {
            const contenu = [];
            for (; i < lignes.length && /^\s*>/.test(lignes[i]); i += 1) contenu.push(lignes[i].replace(/^\s*>\s?/, ''));
            racine.append(h('blockquote', {}, h('p', {}, enLigne(contenu.join(' '), prefixe))));
        } else {
            const contenu = [ligne.trim()];
            for (i += 1; i < lignes.length && !debutDeBloc(lignes[i]); i += 1) contenu.push(lignes[i].trim());
            racine.append(h('p', {}, enLigne(contenu.join(' '), prefixe)));
        }
    }
    return racine;
}

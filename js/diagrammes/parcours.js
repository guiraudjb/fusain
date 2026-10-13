// Parcours usager : sections, étapes notées de 1 à 5 et acteurs
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, Inconnu, parLigne } from './commun.js';

// Deux-points, point-virgule et dièse structurent la syntaxe : ils sont retirés des textes
const propre = (t) => String(t).replace(/[:;#\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const propreActeur = (t) => propre(String(t).replace(/,/g, ' '));
const MOT_CLE = /^(title|section|journey|accTitle|accDescr)(\s|$)/i;
const nomSur = (t, repli) => { const n = propre(t) || repli; return MOT_CLE.test(n) ? `« ${n} »` : n; };
const NOTES = [[5, '5 — très satisfait'], [4, '4 — satisfait'], [3, '3 — neutre'], [2, '2 — insatisfait'], [1, '1 — très insatisfait']];

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'journey') throw new Error('La première ligne doit être « journey ».');
    const modele = { preambule, titre: '', items: [], brut: [] };
    parLigne(corps.slice(1), preambule, (ligne) => {
        const mot = ligne.match(/^([A-Za-z]+)(?=\s|$)/)?.[1] || '';
        const reste = ligne.slice(mot.length).trim();
        if (mot === 'title') { modele.titre = reste; return; }
        if (mot === 'section') { modele.items.push({ t: 'section', nom: reste }); return; }
        if (mot === 'accTitle' || mot === 'accDescr') { modele.brut.push(ligne); return; }
        const m = ligne.match(/^([^:]+):\s*([^:]+?)\s*(?::(.*))?$/);
        if (!m || !Number.isFinite(Number(m[2]))) throw new Inconnu('une étape s\'écrit « nom: note: acteurs »');
        modele.items.push({ t: 'etape', nom: m[1].trim(), note: Number(m[2]), acteurs: (m[3] || '').split(',').map((a) => a.trim()).filter(Boolean) });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'journey'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    for (const item of modele.items) {
        if (item.t === 'section') { lignes.push(`    section ${propre(item.nom) || 'Section'}`); continue; }
        const acteurs = item.acteurs.map(propreActeur).filter(Boolean);
        lignes.push(`      ${nomSur(item.nom, 'Étape')}: ${item.note}${acteurs.length ? `: ${acteurs.join(', ')}` : ''}`);
    }
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => modele.items.map((item, i) => ({ cle: `i:${i}`, nom: item.t === 'section' ? `Section : ${item.nom}` : `${item.nom} (${item.note})` }));

export function reperer(svg, modele) {
    const etapes = [];
    const sections = [];
    let section = -1;
    let dernierNom = '';
    modele.items.forEach((item, i) => {
        if (item.t === 'section') { section = i; return; }
        etapes.push(i);
        // Mermaid ne dessine le bandeau d'une section qu'à sa première étape, et fusionne deux sections voisines de même nom
        const nom = section >= 0 ? propre(modele.items[section].nom) : '';
        if (nom !== dernierNom) { if (section >= 0) sections.push(section); dernierNom = nom; }
    });
    const gEtapes = [...svg.querySelectorAll('line.task-line')].map((l) => l.parentNode);
    if (gEtapes.length === etapes.length) gEtapes.forEach((g, n) => marquer(g, `i:${etapes[n]}`));
    const gSections = [...svg.querySelectorAll('rect.journey-section')].map((r) => r.parentNode);
    if (gSections.length === sections.length) gSections.forEach((g, n) => marquer(g, `i:${sections[n]}`));
}

const viser = (modele, cle) => { const i = Number(cle.slice(2)); return { i, item: modele.items[i] }; };
export const texte = (modele, cle) => viser(modele, cle).item?.nom ?? null;
export function renommer(modele, cle, valeur) { const { item } = viser(modele, cle); if (item && propre(valeur)) item.nom = propre(valeur); }
export function supprimer(modele, cle) { const { i, item } = viser(modele, cle); if (item) modele.items.splice(i, 1); }

export const peutRelier = (cle) => cle.startsWith('i:');

// La poignée ajoute une étape à la suite
export function relier(modele, de, vers) {
    const { i, item } = viser(modele, de);
    if (vers || !item) return null;
    modele.items.splice(i + 1, 0, { t: 'etape', nom: 'Nouvelle étape', note: 3, acteurs: item.t === 'etape' ? [...item.acteurs] : [] });
    return `i:${i + 1}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : null;
    const position = v?.item ? v.i + 1 : modele.items.length;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Parcours usager'),
        champTexte('Titre', modele.titre, (val) => appliquer((m) => { m.titre = propre(val); })),
        h('div', { class: 'fusain-actions' },
            bouton('Étape', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.items.splice(position, 0, { t: 'etape', nom: 'Nouvelle étape', note: 3, acteurs: [] }); }, () => `i:${position}`) }),
            bouton('Section', { icone: 'add-line', onclick: () => appliquer((m) => { m.items.splice(position, 0, { t: 'section', nom: 'Nouvelle section' }); }, () => `i:${position}`) })),
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent après l\'élément sélectionné. Une section regroupe les étapes qui la suivent.'))];

    if (v?.item) {
        const etape = v.item.t === 'etape';
        const notes = NOTES.some(([n]) => n === v.item.note) ? NOTES : [[v.item.note, String(v.item.note)], ...NOTES];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, etape ? 'Étape sélectionnée' : 'Section sélectionnée'),
            champTexte('Nom', v.item.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            etape ? champSelect('Satisfaction', notes.map(([n, nom]) => [String(n), nom]), String(v.item.note), (val) => appliquer((m) => { m.items[v.i].note = Number(val); })) : null,
            etape ? champTexte('Acteurs (séparés par des virgules)', v.item.acteurs.join(', '), (val) => appliquer((m) => { m.items[v.i].acteurs = val.split(',').map(propreActeur).filter(Boolean); })) : null,
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `i:${deplacer(m.items, v.i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `i:${deplacer(m.items, v.i, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Déroulé'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'journey', nom: 'Parcours usager', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

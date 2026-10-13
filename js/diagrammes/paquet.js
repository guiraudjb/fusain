// Structure de paquet : une suite de champs, chacun d'une taille en bits
import { h, bouton, champTexte } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, Inconnu, parLigne } from './commun.js';

const BITS_MAX = 512;
const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const borne = (n) => Math.max(1, Math.min(BITS_MAX, Math.round(Number(n)) || 1));

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^packet(-beta)?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « packet-beta ».');
    const modele = { preambule, entete: corps[0].trim(), titre: '', champs: [], brut: [] };
    let suivant = 0;
    parLigne(corps.slice(1), preambule, (ligne) => {
        let m = ligne.match(/^title\s+(.*)$/);
        if (m) { modele.titre = m[1].trim(); return; }
        if (/^(accTitle|accDescr)\b/.test(ligne)) { modele.brut.push(ligne); return; }
        m = ligne.match(/^\+(\d+)\s*:\s*"([^"]*)"$/);
        if (m) { modele.champs.push({ nom: m[2], bits: Number(m[1]) }); suivant += Number(m[1]); return; }
        m = ligne.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*"([^"]*)"$/);
        if (!m) throw new Inconnu('un champ s\'écrit « début-fin: "nom" »');
        const debut = Number(m[1]);
        const fin = m[2] === undefined ? debut : Number(m[2]);
        if (debut !== suivant || fin < debut) throw new Inconnu('les champs doivent se suivre sans trou');
        modele.champs.push({ nom: m[3], bits: fin - debut + 1 });
        suivant = fin + 1;
    });
    return modele;
}

function plages(modele) {
    let debut = 0;
    return modele.champs.map((c) => { const p = [debut, debut + c.bits - 1]; debut += c.bits; return p; });
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete || 'packet-beta'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    const p = plages(modele);
    modele.champs.forEach((c, i) => lignes.push(`    ${p[i][0] === p[i][1] ? p[i][0] : `${p[i][0]}-${p[i][1]}`}: "${propre(c.nom)}"`));
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => { const p = plages(modele); return modele.champs.map((c, i) => ({ cle: `p:${i}`, nom: `${c.nom} (bits ${p[i][0]} à ${p[i][1]})` })); };

export function reperer(svg, modele) {
    const p = plages(modele);
    let attente = [];
    // Un champ long est dessiné en plusieurs blocs, un par rangée : chacun est rattaché par son premier bit
    for (const el of svg.querySelectorAll('rect.packetBlock, text.packetLabel, text.packetByte.start')) {
        if (!el.classList.contains('packetByte')) { attente.push(el); continue; }
        const bit = Number(el.textContent.trim());
        const i = p.findIndex(([a, z]) => bit >= a && bit <= z);
        if (i >= 0) for (const a of attente) marquer(a, `p:${i}`);
        attente = [];
    }
}

export const texte = (modele, cle) => modele.champs[Number(cle.slice(2))]?.nom ?? null;
export function renommer(modele, cle, valeur) { const c = modele.champs[Number(cle.slice(2))]; if (c && propre(valeur)) c.nom = propre(valeur); }
export function supprimer(modele, cle) { const i = Number(cle.slice(2)); if (modele.champs[i]) modele.champs.splice(i, 1); }

export const peutRelier = (cle) => cle.startsWith('p:');

// La poignée ajoute un champ à la suite
export function relier(modele, de, vers) {
    const i = Number(de.slice(2));
    if (vers || !modele.champs[i]) return null;
    modele.champs.splice(i + 1, 0, { nom: 'Nouveau champ', bits: 8 });
    return `p:${i + 1}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection?.startsWith('p:') ? Number(selection.slice(2)) : -1;
    const champ = modele.champs[i];
    const position = champ ? i + 1 : modele.champs.length;
    const total = modele.champs.reduce((s, c) => s + c.bits, 0);
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Structure de paquet'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = propre(v); })),
        h('p', { class: 'fusain-aide' }, `${modele.champs.length} champs, ${total} bits (${total / 8} octets). Les positions sont recalculées à chaque modification.`),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter un champ', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.champs.splice(position, 0, { nom: 'Nouveau champ', bits: 8 }); }, () => `p:${position}`) })))];
    if (champ) {
        const [a, z] = plages(modele)[i];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Champ sélectionné'),
            champTexte('Nom', champ.nom, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            champTexte('Taille (bits)', champ.bits, (v) => appliquer((m) => { m.champs[i].bits = borne(v); }), { type: 'number', min: 1, max: BITS_MAX, step: 1 }),
            h('p', { class: 'fusain-aide' }, a === z ? `Bit ${a}` : `Bits ${a} à ${z}`),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `p:${deplacer(m.champs, i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `p:${deplacer(m.champs, i, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Champs'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'packet', nom: 'Structure de paquet', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

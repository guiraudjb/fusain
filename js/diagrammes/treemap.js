// Carte proportionnelle (treemap) : des rubriques emboîtées, et des cases dont la surface suit la valeur
import { h, bouton, champTexte } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, Inconnu, parLigne } from './commun.js';

const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
// Mermaid n'accepte que des valeurs positives ou nulles
const nombre = (v) => { const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null; };

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^treemap(-beta)?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « treemap-beta ».');
    const modele = { preambule, entete: corps[0].trim(), enfants: [], brut: [] };
    // La hiérarchie se lit dans le retrait de chaque ligne
    const pile = [{ retrait: -1, noeud: modele }];
    const retraits = corps.slice(1).filter((l) => l.trim() && !l.trim().startsWith('%%')).map((l) => l.match(/^[ \t]*/)[0]);
    let rang = 0;
    parLigne(corps.slice(1), preambule, (ligne) => {
        const retrait = retraits[rang];
        rang += 1;
        if (/^classDef\s/.test(ligne)) { modele.brut.push(ligne); return; }
        const m = ligne.match(/^(?:"([^"]*)"|'([^']*)')\s*(?::\s*(\d[\d,]*(?:\.\d+)?|\.\d+))?$/);
        if (!m || retrait.includes('\t')) throw new Inconnu('une case s\'écrit « "nom": valeur »');
        while (pile[pile.length - 1].retrait >= retrait.length) pile.pop();
        const parent = pile[pile.length - 1].noeud;
        if (parent.valeur !== null && parent.valeur !== undefined) throw new Inconnu('une case chiffrée ne peut pas en contenir d\'autres');
        const noeud = { nom: m[1] ?? m[2], valeur: m[3] === undefined ? null : Number(m[3].replace(/,/g, '')), enfants: [] };
        parent.enfants.push(noeud);
        pile.push({ retrait: retrait.length, noeud });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete || 'treemap-beta'];
    const niveau = (noeuds, retrait) => {
        for (const n of noeuds) {
            lignes.push(`${retrait}"${propre(n.nom) || 'Sans nom'}"${!n.enfants.length && n.valeur !== null ? `: ${n.valeur}` : ''}`);
            niveau(n.enfants, `${retrait}    `);
        }
    };
    niveau(modele.enfants, '');
    for (const b of modele.brut) lignes.push(b);
    return lignes.join('\n') + '\n';
}

// Parcours en profondeur : chaque nœud avec son chemin (« 0.2.1 »), son parent et son rang
function tous(modele) {
    const liste = [];
    const visiter = (parent, chemin) => parent.enfants.forEach((noeud, i) => {
        const c = [...chemin, i];
        liste.push({ noeud, parent, i, cle: `t:${c.join('.')}`, profondeur: c.length });
        visiter(noeud, c);
    });
    visiter(modele, []);
    return liste;
}

const total = (n) => (n.enfants.length ? n.enfants.reduce((s, e) => s + total(e), 0) : n.valeur || 0);

export function elements(modele) {
    return tous(modele).map(({ noeud, cle, profondeur }) => ({ cle, nom: `${'· '.repeat(profondeur - 1)}${noeud.nom} (${total(noeud)})` }));
}

export function reperer(svg, modele) {
    const liste = tous(modele);
    // Mermaid dessine les cases dans l'ordre du code, et les rubriques niveau par niveau, après une rubrique racine sans nom
    const cases = [...svg.querySelectorAll('g.treemapLeafGroup')];
    const feuilles = liste.filter((e) => !e.noeud.enfants.length);
    if (cases.length === feuilles.length) cases.forEach((g, n) => marquer(g, feuilles[n].cle));
    const rubriques = liste.filter((e) => e.noeud.enfants.length).sort((a, b) => a.profondeur - b.profondeur);
    const sections = [...svg.querySelectorAll('g.treemapSection')];
    if (sections.length === rubriques.length + 1) sections.slice(1).forEach((g, n) => marquer(g, rubriques[n].cle));
}

const viser = (modele, cle) => tous(modele).find((e) => e.cle === cle) || {};

export const texte = (modele, cle) => viser(modele, cle).noeud?.nom ?? null;
export function renommer(modele, cle, valeur) { const v = viser(modele, cle); if (v.noeud && propre(valeur)) v.noeud.nom = propre(valeur); }

// Le schéma garde toujours au moins une case
export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (!v.noeud || (v.parent === modele && modele.enfants.length <= 1)) return;
    v.parent.enfants.splice(v.i, 1);
}

const cleDe = (modele, noeud) => tous(modele).find((e) => e.noeud === noeud)?.cle ?? null;
const descend = (ancetre, noeud) => ancetre === noeud || ancetre.enfants.some((e) => descend(e, noeud));

export const peutRelier = (cle) => cle.startsWith('t:');

// La poignée ajoute une case dans la rubrique ; glissée sur une autre case, elle y range la première
export function relier(modele, de, vers) {
    const source = viser(modele, de);
    if (!source.noeud) return null;
    if (!vers) {
        // Une case qui en reçoit d'autres devient une rubrique : sa surface est alors la somme de son contenu
        const nouvelle = { nom: 'Nouvelle case', valeur: source.noeud.enfants.length ? 10 : source.noeud.valeur ?? 10, enfants: [] };
        source.noeud.valeur = null;
        source.noeud.enfants.push(nouvelle);
        return cleDe(modele, nouvelle);
    }
    const cible = viser(modele, vers);
    if (!cible.noeud || descend(source.noeud, cible.noeud) || cible.noeud === source.parent || (source.parent === modele && modele.enfants.length <= 1)) return null;
    source.parent.enfants.splice(source.i, 1);
    cible.noeud.valeur = null;
    cible.noeud.enfants.push(source.noeud);
    return cleDe(modele, source.noeud);
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const ajouter = (fonction) => () => { let noeud; appliquer((m) => { noeud = fonction(m); }, (m) => cleDe(m, noeud)); };
    const inserer = (m, noeud) => { const w = selection ? viser(m, selection) : {}; if (w.parent) w.parent.enfants.splice(w.i + 1, 0, noeud); else m.enfants.push(noeud); return noeud; };
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Carte proportionnelle'),
        h('p', { class: 'fusain-aide' }, `Total : ${modele.enfants.reduce((s, n) => s + total(n), 0)}. La surface de chaque case est proportionnelle à sa valeur ; une rubrique vaut la somme de ce qu'elle contient.`),
        h('div', { class: 'fusain-actions' },
            bouton('Case', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => inserer(m, { nom: 'Nouvelle case', valeur: 10, enfants: [] })) }),
            bouton('Rubrique', { icone: 'add-line', onclick: ajouter((m) => inserer(m, { nom: 'Nouvelle rubrique', valeur: null, enfants: [{ nom: 'Nouvelle case', valeur: 10, enfants: [] }] })) })))];

    if (v.noeud) {
        const rubrique = v.noeud.enfants.length > 0;
        const dernier = v.parent === modele && modele.enfants.length <= 1;
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, rubrique ? 'Rubrique sélectionnée' : 'Case sélectionnée'),
            champTexte('Nom', v.noeud.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            rubrique
                ? h('p', { class: 'fusain-aide' }, `Valeur : ${total(v.noeud)} (somme de son contenu)`)
                : champTexte('Valeur', v.noeud.valeur ?? '', (val) => appliquer((m) => { viser(m, selection).noeud.valeur = nombre(val); }), { type: 'number', min: 0, step: 'any' }),
            h('div', { class: 'fusain-actions' },
                bouton(rubrique ? 'Ajouter une case dedans' : 'Diviser en sous-cases', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = relier(m, selection, null); }, () => cle); } }),
                v.parent !== modele ? bouton('Sortir de la rubrique', { icone: 'arrow-left-line', onclick: () => appliquer((m) => {
                    const w = viser(m, selection);
                    const grandParent = tous(m).find((e) => e.noeud === w.parent);
                    w.parent.enfants.splice(w.i, 1);
                    (grandParent ? grandParent.parent : m).enfants.splice((grandParent ? grandParent.i : m.enfants.length - 1) + 1, 0, w.noeud);
                }, (m) => cleDe(m, v.noeud)) }) : null),
            actionsListe({
                monter: () => appliquer((m) => { const w = viser(m, selection); deplacer(w.parent.enfants, w.i, -1); }, (m) => cleDe(m, v.noeud)),
                descendre: () => appliquer((m) => { const w = viser(m, selection); deplacer(w.parent.enfants, w.i, 1); }, (m) => cleDe(m, v.noeud)),
                supprimer: dernier ? null : () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Rubriques et cases'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'treemap', nom: 'Carte proportionnelle', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

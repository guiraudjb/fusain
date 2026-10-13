// Diagramme d'exigences : exigences, éléments qui y répondent, relations typées
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, sansGuillemets, plan, marquer, marquerLien, Inconnu, parLigne, nomLibre } from './commun.js';

const SENS = [['', 'Automatique'], ['TB', 'De haut en bas'], ['LR', 'De gauche à droite'], ['BT', 'De bas en haut'], ['RL', 'De droite à gauche']];
const GENRES = [['requirement', 'Exigence'], ['functionalRequirement', 'Exigence fonctionnelle'], ['interfaceRequirement', 'Exigence d\'interface'], ['performanceRequirement', 'Exigence de performance'], ['physicalRequirement', 'Exigence physique'], ['designConstraint', 'Contrainte de conception']];
const RISQUES = [['', 'Non précisé'], ['low', 'Faible'], ['medium', 'Moyen'], ['high', 'Élevé']];
const VERIFICATIONS = [['', 'Non précisée'], ['analysis', 'Analyse'], ['inspection', 'Inspection'], ['test', 'Essai'], ['demonstration', 'Démonstration']];
const RELATIONS = [['contains', 'contient'], ['satisfies', 'satisfait'], ['verifies', 'vérifie'], ['derives', 'dérive de'], ['refines', 'précise'], ['traces', 'est lié à'], ['copies', 'copie']];
const NOM = '(?:"([^"]+)"|([\\p{L}\\p{N}_]+))';
const RE_BLOC = new RegExp(`^(${GENRES.map(([g]) => g).join('|')}|element)\\s+${NOM}\\s*\\{$`, 'u');
const RE_RELATION = new RegExp(`^${NOM}\\s+(-|<-)\\s*(${RELATIONS.map(([r]) => r).join('|')})\\s*(->|-)\\s+${NOM}$`, 'u');

const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
// Un nom qui est aussi un mot du langage s'écrit entre guillemets
const RESERVES = /^(title|direction|element|requirement|\w+Requirement|designConstraint|id|text|risk|type|docref|verifymethod|low|medium|high|analysis|inspection|test|demonstration|contains|copies|derives|satisfies|verifies|refines|traces|style|class|classDef|accTitle|accDescr|TB|BT|LR|RL)$/i;
const ecrireNom = (n) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !RESERVES.test(n) ? n : `"${propre(n)}"`);

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'requirementDiagram') throw new Error('La première ligne doit être « requirementDiagram ».');
    const modele = { preambule, sens: '', exigences: [], elements: [], relations: [], brut: [] };
    let ouvert = null;
    parLigne(corps.slice(1), preambule, (ligne) => {
        if (ouvert) {
            if (ligne === '}') { ouvert = null; return; }
            const a = ligne.match(/^(id|text|risk|verifymethod|type|docref)\s*:\s*(.*)$/i);
            if (!a) throw new Inconnu('propriété inconnue');
            const cle = a[1].toLowerCase();
            const valeur = sansGuillemets(a[2]);
            const champs = ouvert.genre ? { id: 'id', text: 'texte', risk: 'risque', verifymethod: 'verification' } : { type: 'type', docref: 'ref' };
            if (!champs[cle]) throw new Inconnu('propriété mal placée');
            if (cle === 'risk' || cle === 'verifymethod') {
                if (!(cle === 'risk' ? RISQUES : VERIFICATIONS).some(([v]) => v === valeur.toLowerCase())) throw new Inconnu('valeur inconnue');
                ouvert[champs[cle]] = valeur.toLowerCase();
            } else ouvert[champs[cle]] = valeur;
            return;
        }
        let m = ligne.match(/^direction\s+(TB|TD|BT|LR|RL)$/);
        if (m) { modele.sens = m[1] === 'TD' ? 'TB' : m[1]; return; }
        if (/^(classDef|class|style|accTitle|accDescr)\s/.test(ligne)) { modele.brut.push(ligne); return; }
        m = ligne.match(RE_BLOC);
        if (m) {
            const nom = m[2] ?? m[3];
            if (m[1] === 'element') { ouvert = { nom, type: '', ref: '' }; modele.elements.push(ouvert); } else { ouvert = { genre: m[1], nom, id: '', texte: '', risque: '', verification: '' }; modele.exigences.push(ouvert); }
            return;
        }
        m = ligne.match(RE_RELATION);
        if (!m || (m[3] === '-') === (m[5] === '-')) throw new Inconnu('exigence, élément ou relation');
        const [gauche, droite] = [m[1] ?? m[2], m[6] ?? m[7]];
        // « a - type -> b » et « b <- type - a » disent la même chose
        modele.relations.push(m[5] === '->' ? { de: gauche, vers: droite, type: m[4] } : { de: droite, vers: gauche, type: m[4] });
    });
    if (ouvert) throw new Error('Un bloc n\'est pas refermé par « } ».');
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'requirementDiagram'];
    if (modele.sens) lignes.push(`    direction ${modele.sens}`);
    const bloc = (tete, champs) => {
        lignes.push(`    ${tete} {`);
        for (const [cle, valeur, nu] of champs) if (propre(valeur)) lignes.push(`        ${cle}: ${nu ? valeur : `"${propre(valeur)}"`}`);
        lignes.push('    }');
    };
    for (const e of modele.exigences) bloc(`${e.genre} ${ecrireNom(e.nom)}`, [['id', e.id], ['text', e.texte], ['risk', e.risque, true], ['verifymethod', e.verification, true]]);
    for (const e of modele.elements) bloc(`element ${ecrireNom(e.nom)}`, [['type', e.type], ['docref', e.ref]]);
    for (const r of modele.relations) lignes.push(`    ${ecrireNom(r.de)} - ${r.type} -> ${ecrireNom(r.vers)}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const libelleRelation = (type) => RELATIONS.find(([r]) => r === type)?.[1] ?? type;

export function elements(modele) {
    return [
        ...modele.exigences.map((e, i) => ({ cle: `n:${i}`, nom: `${e.nom}${e.id ? ` (${e.id})` : ''}` })),
        ...modele.elements.map((e, i) => ({ cle: `e:${i}`, nom: `Élément : ${e.nom}` })),
        ...modele.relations.map((r, i) => ({ cle: `l:${i}`, nom: `${r.de} ${libelleRelation(r.type)} ${r.vers}` })),
    ];
}

export function reperer(svg, modele) {
    // Mermaid dessine les exigences puis les éléments, dans l'ordre du code
    const noeuds = [...svg.querySelectorAll('g.nodes > g.node')];
    const cles = [...modele.exigences.map((_, i) => `n:${i}`), ...modele.elements.map((_, i) => `e:${i}`)];
    if (noeuds.length === cles.length) noeuds.forEach((g, i) => marquer(g, cles[i]));
    const chemins = [...svg.querySelectorAll('g.edgePaths > path')];
    if (chemins.length !== modele.relations.length) return;
    chemins.forEach((chemin, i) => {
        marquerLien(chemin, `l:${i}`);
        const idLien = chemin.getAttribute('data-id');
        marquer(idLien && svg.querySelector(`g.edgeLabel g.label[data-id="${CSS.escape(idLien)}"]`), `l:${i}`);
    });
}

function viser(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('l:')) return { i, relation: modele.relations[i] };
    return { i, bloc: (cle.startsWith('n:') ? modele.exigences : modele.elements)[i] };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    return cle.startsWith('l:') ? null : v.bloc?.nom ?? null;
}

const noms = (modele) => [...modele.exigences, ...modele.elements].map((x) => x.nom);

// Le nom sert d'identifiant : il reste unique, et les relations le suivent
export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    const nom = propre(valeur);
    if (!v.bloc || !nom || noms(modele).includes(nom)) return;
    for (const r of modele.relations) { if (r.de === v.bloc.nom) r.de = nom; if (r.vers === v.bloc.nom) r.vers = nom; }
    v.bloc.nom = nom;
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) modele.relations.splice(v.i, 1); return; }
    if (!v.bloc) return;
    (cle.startsWith('n:') ? modele.exigences : modele.elements).splice(v.i, 1);
    modele.relations = modele.relations.filter((r) => r.de !== v.bloc.nom && r.vers !== v.bloc.nom);
}

function nouvelleExigence(modele) {
    const e = { genre: 'requirement', nom: nomLibre('exigence_', (n) => noms(modele).includes(n)), id: String(modele.exigences.length + 1), texte: 'Énoncé de l\'exigence', risque: '', verification: '' };
    modele.exigences.push(e);
    return `n:${modele.exigences.length - 1}`;
}

function nouvelElement(modele) {
    modele.elements.push({ nom: nomLibre('element_', (n) => noms(modele).includes(n)), type: 'composant', ref: '' });
    return `e:${modele.elements.length - 1}`;
}

export const peutRelier = (cle) => cle.startsWith('n:') || cle.startsWith('e:');

// Une exigence contient une sous-exigence ; un élément satisfait une exigence
export function relier(modele, de, vers) {
    const source = viser(modele, de).bloc;
    if (!source || de.startsWith('l:')) return null;
    if (!vers) {
        const cle = nouvelleExigence(modele);
        const nouvelle = modele.exigences[modele.exigences.length - 1];
        modele.relations.push(de.startsWith('n:') ? { de: source.nom, vers: nouvelle.nom, type: 'contains' } : { de: source.nom, vers: nouvelle.nom, type: 'satisfies' });
        return cle;
    }
    const cible = vers.startsWith('l:') ? null : viser(modele, vers).bloc;
    if (!cible || cible === source) return null;
    modele.relations.push({ de: source.nom, vers: cible.nom, type: de.startsWith('e:') && vers.startsWith('n:') ? 'satisfies' : de.startsWith('n:') && vers.startsWith('n:') ? 'derives' : 'traces' });
    return `l:${modele.relations.length - 1}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const ajouter = (fonction) => () => { let cle; appliquer((m) => { cle = fonction(m); }, () => cle); };
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme d\'exigences'),
        champSelect('Sens de lecture', SENS, modele.sens, (val) => appliquer((m) => { m.sens = val; })),
        h('div', { class: 'fusain-actions' },
            bouton('Exigence', { icone: 'add-line', variante: 'secondary', onclick: ajouter(nouvelleExigence) }),
            bouton('Élément', { icone: 'add-line', onclick: ajouter(nouvelElement) })),
        h('p', { class: 'fusain-aide' }, 'Un élément (composant, document, essai…) répond à une exigence ou la vérifie.'))];

    if (v.bloc) {
        const exigence = selection.startsWith('n:');
        const modifier = (fonction) => appliquer((m) => fonction(viser(m, selection).bloc));
        const champLibre = (libelle, cle, attrs) => champTexte(libelle, v.bloc[cle], (val) => modifier((x) => { x[cle] = propre(val); }), attrs);
        const autres = elements(modele).filter((e) => !e.cle.startsWith('l:') && e.cle !== selection).map((e) => [e.cle, e.nom]);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, exigence ? 'Exigence sélectionnée' : 'Élément sélectionné'),
            champTexte('Nom', v.bloc.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            exigence ? [
                champSelect('Nature', GENRES, v.bloc.genre, (val) => modifier((x) => { x.genre = val; })),
                champLibre('Identifiant', 'id'),
                champLibre('Énoncé', 'texte', { multiligne: true }),
                h('div', { class: 'fusain-ligne' },
                    champSelect('Risque', RISQUES, v.bloc.risque, (val) => modifier((x) => { x.risque = val; })),
                    champSelect('Vérification', VERIFICATIONS, v.bloc.verification, (val) => modifier((x) => { x.verification = val; }))),
            ] : [champLibre('Type', 'type'), champLibre('Référence documentaire', 'ref')],
            h('div', { class: 'fusain-actions' },
                bouton(exigence ? 'Ajouter une sous-exigence' : 'Ajouter une exigence satisfaite', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => relier(m, selection, null)) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) })),
            autres.length ? champSelect('Relation vers…', [['', 'Choisir'], ...autres], '', (val) => {
                if (!val) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, val); }, () => cle);
            }) : null));
    }

    if (v.relation) {
        const modifier = (fonction) => appliquer((m) => fonction(m.relations[v.i]));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Relation sélectionnée'),
            h('p', { class: 'fusain-aide' }, `${v.relation.de} → ${v.relation.vers}`),
            champSelect('Nature', RELATIONS, v.relation.type, (val) => modifier((x) => { x.type = val; }), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => modifier((x) => { [x.de, x.vers] = [x.vers, x.de]; }) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'requirementDiagram', nom: 'Diagramme d\'exigences', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

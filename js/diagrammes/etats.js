// Diagramme d'états : états et transitions
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, plan, marquer } from './commun.js';

const SENS = [['', 'Automatique'], ['TB', 'De haut en bas'], ['LR', 'De gauche à droite'], ['BT', 'De bas en haut'], ['RL', 'De droite à gauche']];
const RE_ID = /^[\p{L}\p{N}_]+$/u;
const EXTREMITE = '[*]';
// Guillemets, deux-points et points-virgules structurent la syntaxe : ils sont retirés ou encodés
const propreNom = (t) => String(t).replace(/"/g, '#quot;').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const propreTexte = (t) => String(t).replace(/[;\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const lireNom = (t) => t.replace(/#quot;/g, '"');

class Inconnu extends Error {}

function etat(modele, id) {
    if (id === EXTREMITE) return null;
    if (!RE_ID.test(id)) throw new Inconnu('identifiant d\'état');
    let e = modele.etats.find((x) => x.id === id);
    if (!e) { e = { id, nom: null }; modele.etats.push(e); }
    return e;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^stateDiagram(-v2)?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « stateDiagram-v2 ».');
    const modele = { preambule, sens: '', etats: [], transitions: [], brut: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        try {
            let m = ligne.match(/^direction\s+(TB|TD|BT|LR|RL)$/);
            if (m) { modele.sens = m[1] === 'TD' ? 'TB' : m[1]; return; }
            m = ligne.match(/^state\s+"([^"]*)"\s+as\s+(\S+)$/);
            if (m) { etat(modele, m[2]).nom = lireNom(m[1]); return; }
            if (/^(classDef|class|accTitle|accDescr)\s/.test(ligne)) { modele.brut.push(ligne); return; }
            if (/^(state|note|end note|hide|scale)\b/.test(ligne) || ligne === '--' || ligne === '}' || ligne.includes('<<')) throw new Inconnu('états composés, notes ou branchements');
            m = ligne.match(/^(\[\*\]|[^\s:]+)\s*-->\s*(\[\*\]|[^\s:]+)\s*(?::\s*(.*))?$/);
            if (m) {
                etat(modele, m[1]);
                etat(modele, m[2]);
                modele.transitions.push({ de: m[1], vers: m[2], texte: (m[3] || '').trim() });
                return;
            }
            m = ligne.match(/^([^\s:]+)\s*:\s*(.+)$/);
            if (m) {
                const e = etat(modele, m[1]);
                if (e.nom !== null) throw new Inconnu('plusieurs descriptions pour un même état');
                e.nom = m[2].trim();
                return;
            }
            etat(modele, ligne);
        } catch (e) {
            if (e instanceof Inconnu) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle (${e.message}).`);
            throw e;
        }
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'stateDiagram-v2'];
    if (modele.sens) lignes.push(`    direction ${modele.sens}`);
    const lies = new Set(modele.transitions.flatMap((t) => [t.de, t.vers]));
    for (const e of modele.etats) {
        const nom = e.nom === null ? '' : propreNom(e.nom);
        if (nom && nom !== e.id) lignes.push(`    state "${nom}" as ${e.id}`);
        else if (!lies.has(e.id)) lignes.push(`    ${e.id}`);
    }
    for (const t of modele.transitions) lignes.push(`    ${t.de} --> ${t.vers}${propreTexte(t.texte) ? ` : ${propreTexte(t.texte)}` : ''}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomEtat = (modele, id) => (id === EXTREMITE ? '●' : modele.etats.find((e) => e.id === id)?.nom ?? id);

export function elements(modele) {
    return [
        ...modele.etats.map((e) => ({ cle: `n:${e.id}`, nom: e.nom ?? e.id })),
        ...modele.transitions.map((t, i) => ({ cle: `l:${i}`, nom: `${nomEtat(modele, t.de)} → ${nomEtat(modele, t.vers)}${t.texte ? ` (${t.texte})` : ''}` })),
    ];
}

export function reperer(svg, modele) {
    const prefixe = `${svg.id}-`;
    for (const g of svg.querySelectorAll('g.node')) {
        const m = g.id.startsWith(prefixe) && g.id.slice(prefixe.length).match(/^state-(.+)-\d+$/);
        if (!m) continue;
        if (m[1] === 'root_start') marquer(g, 's:debut');
        else if (m[1] === 'root_end') marquer(g, 's:fin');
        else if (modele.etats.some((e) => e.id === m[1])) marquer(g, `n:${m[1]}`);
    }
    const chemins = [...svg.querySelectorAll('path.transition')];
    if (chemins.length !== modele.transitions.length) return;
    chemins.forEach((chemin, i) => {
        marquer(chemin, `l:${i}`);
        const touche = chemin.cloneNode(false);
        for (const a of ['id', 'marker-end', 'marker-start']) touche.removeAttribute(a);
        touche.setAttribute('class', 'fusain-touche');
        marquer(touche, `l:${i}`);
        chemin.after(touche);
        const idLien = chemin.getAttribute('data-id');
        marquer(idLien && svg.querySelector(`g.edgeLabel g.label[data-id="${CSS.escape(idLien)}"]`), `l:${i}`);
    });
}

export function texte(modele, cle) {
    if (cle.startsWith('n:')) { const e = modele.etats.find((x) => x.id === cle.slice(2)); return e ? e.nom ?? e.id : null; }
    if (cle.startsWith('l:')) return modele.transitions[Number(cle.slice(2))]?.texte ?? null;
    return null;
}

export function renommer(modele, cle, valeur) {
    if (cle.startsWith('n:')) { const e = modele.etats.find((x) => x.id === cle.slice(2)); if (e && valeur.trim()) e.nom = valeur.trim(); }
    if (cle.startsWith('l:') && modele.transitions[Number(cle.slice(2))]) modele.transitions[Number(cle.slice(2))].texte = valeur.trim();
}

function supprimerEtat(modele, id) {
    modele.etats = modele.etats.filter((e) => e.id !== id);
    modele.transitions = modele.transitions.filter((t) => t.de !== id && t.vers !== id);
}

export function supprimer(modele, cle) {
    if (cle.startsWith('n:')) supprimerEtat(modele, cle.slice(2));
    if (cle.startsWith('l:')) modele.transitions.splice(Number(cle.slice(2)), 1);
}

function nouvelEtat(modele) {
    let n = 1;
    while (modele.etats.some((e) => e.id === `e${n}`)) n += 1;
    const e = { id: `e${n}`, nom: 'Nouvel état' };
    modele.etats.push(e);
    return e;
}

const identifiant = (cle) => (cle.startsWith('s:') ? EXTREMITE : cle.slice(2));
export const peutRelier = (cle) => cle.startsWith('n:') || cle === 's:debut';

export function relier(modele, de, vers) {
    if (de === 's:fin') return null;
    const source = identifiant(de);
    if (vers && (vers.startsWith('n:') || vers === 's:fin')) {
        if (source === EXTREMITE && vers === 's:fin') return null;
        modele.transitions.push({ de: source, vers: identifiant(vers), texte: '' });
        return `l:${modele.transitions.length - 1}`;
    }
    if (vers) return null;
    const e = nouvelEtat(modele);
    modele.transitions.push({ de: source, vers: e.id, texte: '' });
    return `n:${e.id}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme d\'états'),
        champSelect('Sens de lecture', SENS, modele.sens, (v) => appliquer((m) => { m.sens = v; })),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter un état', { icone: 'add-line', variante: 'secondary', onclick: () => {
            let cle;
            appliquer((m) => { cle = `n:${nouvelEtat(m).id}`; }, () => cle);
        } })))];

    if (selection?.startsWith('n:') && modele.etats.some((e) => e.id === selection.slice(2))) {
        const id = selection.slice(2);
        const e = modele.etats.find((x) => x.id === id);
        const initial = modele.transitions.some((t) => t.de === EXTREMITE && t.vers === id);
        const final = modele.transitions.some((t) => t.de === id && t.vers === EXTREMITE);
        const autres = modele.etats.filter((x) => x.id !== id).map((x) => [`n:${x.id}`, x.nom ?? x.id]);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'État sélectionné'),
            champTexte('Nom', e.nom ?? e.id, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            champCase('État initial (relié au point de départ)', initial, (coche) => appliquer((m) => {
                if (coche) m.transitions.unshift({ de: EXTREMITE, vers: id, texte: '' });
                else m.transitions = m.transitions.filter((t) => !(t.de === EXTREMITE && t.vers === id));
            })),
            champCase('État final (relié au point d\'arrivée)', final, (coche) => appliquer((m) => {
                if (coche) m.transitions.push({ de: id, vers: EXTREMITE, texte: '' });
                else m.transitions = m.transitions.filter((t) => !(t.de === id && t.vers === EXTREMITE));
            })),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter un état suivant', { icone: 'add-line', variante: 'secondary', onclick: () => {
                    let cle;
                    appliquer((m) => { cle = relier(m, selection, null); }, () => cle);
                } }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimerEtat(m, id), () => null) })),
            champSelect('Transition vers…', [['', 'Choisir un état'], [selection, 'Lui-même (boucle)'], ...autres], '', (v) => {
                if (!v) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, v); }, () => cle);
            })));
    }

    if (selection?.startsWith('l:') && modele.transitions[Number(selection.slice(2))]) {
        const i = Number(selection.slice(2));
        const t = modele.transitions[i];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Transition sélectionnée'),
            h('p', { class: 'fusain-aide' }, `${nomEtat(modele, t.de)} → ${nomEtat(modele, t.vers)}`),
            champTexte('Événement ou condition', t.texte, (v) => appliquer((m) => { m.transitions[i].texte = v.trim(); }), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-actions' },
                t.de !== EXTREMITE && t.vers !== EXTREMITE ? bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => appliquer((m) => { const x = m.transitions[i]; [x.de, x.vers] = [x.vers, x.de]; }) }) : null,
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => { m.transitions.splice(i, 1); }, () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'stateDiagram', nom: 'Diagramme d\'états', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

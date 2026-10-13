// Diagramme de flux (Sankey) : des flux chiffrés entre des postes
import { h, bouton, champTexte, champSelect, message } from '../dom.js';
import { separerPreambule, plan, marquer, Inconnu, parLigne, nomLibre } from './commun.js';

// Mermaid n'accepte ici que des caractères sans accent : les autres sont ramenés à leur lettre de base ou retirés
const propre = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]|#/g, ' ').replace(/\s+/g, ' ').trim();
const champ = (t) => (/^[A-Za-z0-9 _.-]+$/.test(t) ? t : `"${t.replace(/"/g, '""')}"`);
const quantite = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };

function lireLigne(ligne) {
    const champs = [];
    let reste = ligne;
    while (reste !== null) {
        const m = reste.match(/^\s*(?:"((?:[^"]|"")*)"|([^,"]*))\s*(?:,(.*))?$/);
        if (!m) throw new Inconnu('ligne de flux mal formée');
        champs.push(m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2].trim());
        reste = m[3] === undefined ? null : m[3];
    }
    return champs;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^sankey(-beta)?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « sankey-beta ».');
    const modele = { preambule, entete: corps[0].trim(), flux: [] };
    parLigne(corps.slice(1), preambule, (ligne) => {
        const c = lireLigne(ligne);
        if (c.length !== 3 || !c[0] || !c[1] || quantite(c[2]) === null) throw new Inconnu('un flux s\'écrit « origine,destination,valeur »');
        modele.flux.push({ de: c[0], vers: c[1], valeur: quantite(c[2]) });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete || 'sankey-beta', ''];
    for (const f of modele.flux) lignes.push(`${champ(propre(f.de))},${champ(propre(f.vers))},${f.valeur}`);
    return lignes.join('\n') + '\n';
}

// Les postes, dans l'ordre où Mermaid les rencontre
const postes = (modele) => [...new Set(modele.flux.flatMap((f) => [f.de, f.vers]))];
const nomPoste = (modele, cle) => postes(modele)[Number(cle.slice(2))];

// Un flux ne peut pas revenir vers son origine : Mermaid refuse les circuits
function sansCircuit(flux) {
    const suivants = new Map();
    for (const f of flux) { if (f.de === f.vers) return false; suivants.set(f.de, [...(suivants.get(f.de) || []), f.vers]); }
    const etat = new Map();
    const visiter = (n) => {
        if (etat.get(n) === 1) return false;
        if (etat.get(n) === 2) return true;
        etat.set(n, 1);
        for (const s of suivants.get(n) || []) if (!visiter(s)) return false;
        etat.set(n, 2);
        return true;
    };
    return [...suivants.keys()].every(visiter);
}

// Applique une modification, et la défait si elle crée un circuit
function tenter(modele, fonction) {
    const avant = JSON.stringify(modele.flux);
    fonction(modele);
    if (sansCircuit(modele.flux.map((f) => ({ de: propre(f.de), vers: propre(f.vers) })))) return true;
    modele.flux = JSON.parse(avant);
    return false;
}

export function elements(modele) {
    const total = (nom) => Math.max(...['de', 'vers'].map((sens) => modele.flux.filter((f) => f[sens] === nom).reduce((s, f) => s + f.valeur, 0)));
    return [
        ...postes(modele).map((nom, i) => ({ cle: `n:${i}`, nom: `${nom} (${total(nom)})` })),
        ...modele.flux.map((f, i) => ({ cle: `l:${i}`, nom: `${f.de} → ${f.vers} : ${f.valeur}` })),
    ];
}

export function reperer(svg, modele) {
    const noms = postes(modele);
    const noeuds = [...svg.querySelectorAll('g.nodes g.node')];
    const libelles = [...svg.querySelectorAll('g.node-labels text')];
    if (noeuds.length === noms.length) noeuds.forEach((g, i) => marquer(g, `n:${i}`));
    if (libelles.length === noms.length) libelles.forEach((t, i) => marquer(t, `n:${i}`));
    const liens = [...svg.querySelectorAll('g.links g.link')];
    if (liens.length === modele.flux.length) liens.forEach((g, i) => marquer(g, `l:${i}`));
}

export function texte(modele, cle) {
    if (cle.startsWith('n:')) return nomPoste(modele, cle) ?? null;
    return modele.flux[Number(cle.slice(2))] ? String(modele.flux[Number(cle.slice(2))].valeur) : null;
}

export function renommer(modele, cle, valeur) {
    if (cle.startsWith('l:')) {
        const f = modele.flux[Number(cle.slice(2))];
        if (f && quantite(valeur) !== null) f.valeur = quantite(valeur);
        return;
    }
    const ancien = nomPoste(modele, cle);
    const nom = propre(valeur);
    // Deux postes de même nom n'en feraient plus qu'un
    if (ancien === undefined || !nom || postes(modele).some((p) => p !== ancien && propre(p) === nom)) return;
    for (const f of modele.flux) { if (f.de === ancien) f.de = nom; if (f.vers === ancien) f.vers = nom; }
}

// Le schéma garde toujours au moins un flux : vide, il ne serait plus valide
export function supprimer(modele, cle) {
    let reste;
    if (cle.startsWith('n:')) { const nom = nomPoste(modele, cle); reste = modele.flux.filter((f) => f.de !== nom && f.vers !== nom); } else reste = modele.flux.filter((_, i) => i !== Number(cle.slice(2)));
    if (reste.length) modele.flux = reste;
}

export const peutRelier = (cle) => cle.startsWith('n:');

export function relier(modele, de, vers) {
    const origine = nomPoste(modele, de);
    if (origine === undefined) return null;
    if (vers) {
        const cible = vers.startsWith('n:') ? nomPoste(modele, vers) : undefined;
        if (cible === undefined || !tenter(modele, (m) => m.flux.push({ de: origine, vers: cible, valeur: 10 }))) return null;
        return `l:${modele.flux.length - 1}`;
    }
    const nom = nomLibre('Poste ', (n) => postes(modele).includes(n));
    modele.flux.push({ de: origine, vers: nom, valeur: 10 });
    return `n:${postes(modele).indexOf(nom)}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const noms = postes(modele);
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme de flux'),
        h('p', { class: 'fusain-aide' }, 'La largeur d\'un flux est proportionnelle à sa valeur. Mermaid n\'accepte pas les accents dans ce type de schéma : ils sont retirés des noms.'),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter un flux', { icone: 'add-line', variante: 'secondary', onclick: () => {
            let cle;
            appliquer((m) => {
                const a = nomLibre('Poste ', (n) => postes(m).includes(n));
                m.flux.push({ de: a, vers: nomLibre('Poste ', (n) => n === a || postes(m).includes(n)), valeur: 10 });
                cle = `l:${m.flux.length - 1}`;
            }, () => cle);
        } })))];

    if (selection?.startsWith('n:') && noms[Number(selection.slice(2))] !== undefined) {
        const nom = noms[Number(selection.slice(2))];
        const autres = noms.map((n, i) => [`n:${i}`, n]).filter(([, n]) => n !== nom);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Poste sélectionné'),
            champTexte('Nom', nom, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter un flux sortant', { icone: 'add-line', variante: 'secondary', onclick: () => {
                    let cle;
                    appliquer((m) => { cle = relier(m, selection, null); }, () => cle);
                } }),
                modele.flux.some((f) => f.de !== nom && f.vers !== nom) ? bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }) : null),
            champSelect('Flux vers…', [['', 'Choisir un poste'], ...autres], '', (v) => {
                if (!v) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, v); }, () => cle || selection);
                if (!cle) message('Flux impossible', 'Ce flux reviendrait vers son origine : Mermaid refuse les circuits.', 'warning');
            })));
    }

    if (selection?.startsWith('l:') && modele.flux[Number(selection.slice(2))]) {
        const i = Number(selection.slice(2));
        const f = modele.flux[i];
        const extremite = (sens, libelle) => champSelect(libelle, noms.map((n) => [n, n]), f[sens], (v) => {
            let fait;
            appliquer((m) => { fait = tenter(m, (x) => { x.flux[i][sens] = v; }); });
            if (!fait) message('Flux impossible', 'Ce flux reviendrait vers son origine : Mermaid refuse les circuits.', 'warning');
        });
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Flux sélectionné'),
            champTexte('Valeur', f.valeur, (v) => appliquer((m) => renommer(m, selection, v)), { type: 'number', min: 0, step: 'any', id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' }, extremite('de', 'Origine'), extremite('vers', 'Destination')),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => appliquer((m) => { tenter(m, (x) => { const y = x.flux[i]; [y.de, y.vers] = [y.vers, y.de]; }); }) }),
                modele.flux.length > 1 ? bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }) : null)));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Postes et flux'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'sankey', nom: 'Diagramme de flux', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

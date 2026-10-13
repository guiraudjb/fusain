// Architecture technique : services, groupes et liaisons
import { h, bouton, champTexte, champSelect, champCase, message } from '../dom.js';
import { separerPreambule, sansGuillemets, plan, marquer, marquerLien, Inconnu, parLigne, nomLibre } from './commun.js';
import { PREFIXE, choisirIcone } from '../icones.js';

const ICONES = [['server', 'Serveur'], ['database', 'Base de données'], ['disk', 'Disque'], ['cloud', 'Nuage'], ['internet', 'Internet'], ['blank', 'Carré plein'], ['', 'Sans icône']];
const COTES = [['L', 'Gauche'], ['R', 'Droite'], ['T', 'Haut'], ['B', 'Bas']];
const RE_BLOC = /^(group|service)\s+([A-Za-z0-9_]+)(?:\(([A-Za-z0-9_:-]+)\))?(?:\[(.+)\])?(?:\s+in\s+([A-Za-z0-9_]+))?$/;
const RE_LIEN = /^([A-Za-z0-9_]+):([TBLR])\s+(<)?-(?:-|\[(.+)\]-)(>)?\s+([TBLR]):([A-Za-z0-9_]+)$/;

// Un libellé n'admet que lettres, chiffres, espaces et quelques signes
const propre = (t) => String(t).replace(/[^\p{L}\p{N} _.-]/gu, ' ').replace(/\s+/g, ' ').trim();

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'architecture-beta') throw new Error('La première ligne doit être « architecture-beta ».');
    const modele = { preambule, groupes: [], services: [], liens: [], brut: [] };
    parLigne(corps.slice(1), preambule, (ligne) => {
        if (/^(title|accTitle|accDescr)\s/.test(ligne)) { modele.brut.push(ligne); return; }
        let m = ligne.match(RE_BLOC);
        if (m) {
            (m[1] === 'group' ? modele.groupes : modele.services).push({ id: m[2], icone: m[3] || '', nom: m[4] === undefined ? '' : sansGuillemets(m[4]), parent: m[5] || '' });
            return;
        }
        m = ligne.match(RE_LIEN);
        if (!m) throw new Inconnu('jonctions ou liaisons entre groupes');
        modele.liens.push({ de: m[1], coteDe: m[2], flecheDe: Boolean(m[3]), texte: m[4] === undefined ? '' : sansGuillemets(m[4]), flecheVers: Boolean(m[5]), coteVers: m[6], vers: m[7] });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'architecture-beta'];
    for (const b of modele.brut) lignes.push(`    ${b}`);
    const bloc = (mot, x) => `    ${mot} ${x.id}${x.icone ? `(${x.icone})` : ''}${propre(x.nom) ? `[${propre(x.nom)}]` : ''}${x.parent ? ` in ${x.parent}` : ''}`;
    for (const g of modele.groupes) lignes.push(bloc('group', g));
    for (const s of modele.services) lignes.push(bloc('service', s));
    for (const l of modele.liens) lignes.push(`    ${l.de}:${l.coteDe} ${l.flecheDe ? '<' : ''}-${propre(l.texte) ? `[${propre(l.texte)}]` : '-'}${propre(l.texte) ? '-' : ''}${l.flecheVers ? '>' : ''} ${l.coteVers}:${l.vers}`);
    return lignes.join('\n') + '\n';
}

const nomDe = (modele, id) => { const x = [...modele.services, ...modele.groupes].find((e) => e.id === id); return x ? x.nom || x.id : id; };

export function elements(modele) {
    return [
        ...modele.groupes.map((g) => ({ cle: `g:${g.id}`, nom: `Groupe : ${g.nom || g.id}` })),
        ...modele.services.map((s) => ({ cle: `n:${s.id}`, nom: s.nom || s.id })),
        ...modele.liens.map((l, i) => ({ cle: `l:${i}`, nom: `${nomDe(modele, l.de)} — ${nomDe(modele, l.vers)}${l.texte ? ` (${l.texte})` : ''}` })),
    ];
}

export function reperer(svg, modele) {
    for (const s of modele.services) marquer(svg.querySelector(`[id="${CSS.escape(`${svg.id}-service-${s.id}`)}"]`), `n:${s.id}`);
    for (const g of modele.groupes) {
        const cadre = svg.querySelector(`[id="${CSS.escape(`${svg.id}-group-${g.id}`)}"]`);
        marquer(cadre, `g:${g.id}`);
        // Le titre du groupe suit son cadre
        if (cadre?.nextElementSibling?.localName === 'g') marquer(cadre.nextElementSibling, `g:${g.id}`);
    }
    const chemins = [...svg.querySelectorAll('g.architecture-edges path.edge')];
    if (chemins.length === modele.liens.length) chemins.forEach((chemin, i) => marquerLien(chemin, `l:${i}`));
}

function viser(modele, cle) {
    if (cle.startsWith('l:')) return { lien: modele.liens[Number(cle.slice(2))], i: Number(cle.slice(2)) };
    return { bloc: (cle.startsWith('g:') ? modele.groupes : modele.services).find((x) => x.id === cle.slice(2)) };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    return cle.startsWith('l:') ? v.lien?.texte ?? null : v.bloc ? v.bloc.nom || v.bloc.id : null;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.lien) v.lien.texte = propre(valeur); } else if (v.bloc && propre(valeur)) v.bloc.nom = propre(valeur);
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.lien) modele.liens.splice(v.i, 1); return; }
    if (!v.bloc) return;
    if (cle.startsWith('g:')) {
        // Le contenu du groupe remonte d'un niveau
        modele.groupes = modele.groupes.filter((g) => g !== v.bloc);
        for (const x of [...modele.groupes, ...modele.services]) if (x.parent === v.bloc.id) x.parent = v.bloc.parent;
    } else {
        modele.services = modele.services.filter((s) => s !== v.bloc);
        modele.liens = modele.liens.filter((l) => l.de !== v.bloc.id && l.vers !== v.bloc.id);
    }
}

const pris = (modele) => (id) => [...modele.groupes, ...modele.services].some((x) => x.id === id);

function nouveauService(modele, parent = '') {
    const s = { id: nomLibre('service', pris(modele)), icone: 'server', nom: 'Nouveau service', parent };
    modele.services.push(s);
    return s;
}

export const peutRelier = (cle) => cle.startsWith('n:');

export function relier(modele, de, vers) {
    const source = de.startsWith('n:') ? viser(modele, de).bloc : null;
    if (!source) return null;
    const lien = (cible) => modele.liens.push({ de: source.id, coteDe: 'R', flecheDe: false, texte: '', flecheVers: false, coteVers: 'L', vers: cible });
    if (vers) {
        const cible = vers.startsWith('n:') ? viser(modele, vers).bloc : null;
        if (!cible || cible === source) return null;
        lien(cible.id);
        return `l:${modele.liens.length - 1}`;
    }
    const s = nouveauService(modele, source.parent);
    lien(s.id);
    return `n:${s.id}`;
}

// Un groupe ne peut pas être rangé dans lui-même ni dans un de ses sous-groupes
function groupesPossibles(modele, bloc) {
    const interdits = new Set([bloc.id]);
    let change = true;
    while (change) {
        change = false;
        for (const g of modele.groupes) if (interdits.has(g.parent) && !interdits.has(g.id)) { interdits.add(g.id); change = true; }
    }
    return [['', 'Aucun'], ...modele.groupes.filter((g) => !modele.groupes.includes(bloc) || !interdits.has(g.id)).map((g) => [g.id, g.nom || g.id])];
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Architecture technique'),
        h('div', { class: 'fusain-actions' },
            bouton('Service', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = `n:${nouveauService(m, selection?.startsWith('g:') && v.bloc ? v.bloc.id : '').id}`; }, () => cle); } }),
            bouton('Groupe', { icone: 'add-line', onclick: () => {
                let cle;
                appliquer((m) => { const g = { id: nomLibre('groupe', pris(m)), icone: 'cloud', nom: 'Nouveau groupe', parent: '' }; m.groupes.push(g); nouveauService(m, g.id); cle = `g:${g.id}`; }, () => cle);
            } })),
        h('p', { class: 'fusain-aide' }, 'Mermaid place les services d\'après les côtés choisis pour chaque liaison.'))];

    if (v.bloc) {
        const groupe = selection.startsWith('g:');
        const modifier = (fonction) => appliquer((m) => fonction(viser(m, selection).bloc));
        // Une icône choisie dans la fenêtre (« dsfr:nom », « illus:nom ») s'ajoute à la liste courte
        const [jeu, nomIcone] = v.bloc.icone.includes(':') ? v.bloc.icone.split(':') : ['', v.bloc.icone];
        const icones = ICONES.some(([i]) => i === v.bloc.icone) ? ICONES : [[v.bloc.icone, jeu === PREFIXE ? `DSFR : ${nomIcone}` : jeu === 'illus' ? `Illustrée : ${nomIcone}` : v.bloc.icone], ...ICONES];
        const autres = modele.services.filter((s) => s !== v.bloc).map((s) => [`n:${s.id}`, s.nom || s.id]);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, groupe ? 'Groupe sélectionné' : 'Service sélectionné'),
            champTexte('Nom', v.bloc.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champSelect('Icône', icones, v.bloc.icone, (val) => modifier((x) => { x.icone = val; })),
                champSelect(groupe ? 'Dans le groupe' : 'Groupe', groupesPossibles(modele, v.bloc), v.bloc.parent, (val) => modifier((x) => { x.parent = val; }))),
            h('div', { class: 'fusain-actions' },
                bouton('Autres icônes…', { icone: 'layout-grid-line', onclick: () => choisirIcone(v.bloc.icone, (val) => modifier((x) => { x.icone = val; })).catch((e) => message('Icônes indisponibles', e.message, 'error')) }),
                groupe ? null : bouton('Ajouter un service relié', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = relier(m, selection, null); }, () => cle); } }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) })),
            groupe || !autres.length ? null : champSelect('Liaison vers…', [['', 'Choisir un service'], ...autres], '', (val) => {
                if (!val) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, val); }, () => cle);
            })));
    }

    if (v.lien) {
        const l = v.lien;
        const modifier = (fonction) => appliquer((m) => fonction(m.liens[v.i]));
        const cote = (cle, fleche, id) => h('div', { class: 'fusain-ligne' },
            champSelect(`Côté de « ${nomDe(modele, id)} »`, COTES, l[cle], (val) => modifier((x) => { x[cle] = val; })),
            champCase('Flèche', l[fleche], (coche) => modifier((x) => { x[fleche] = coche; })));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Liaison sélectionnée'),
            champTexte('Libellé', l.texte, (val) => modifier((x) => { x.texte = propre(val); }), { id: 'fusain-champ-texte' }),
            cote('coteDe', 'flecheDe', l.de),
            cote('coteVers', 'flecheVers', l.vers),
            h('div', { class: 'fusain-actions' }, bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'architecture', nom: 'Architecture technique', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

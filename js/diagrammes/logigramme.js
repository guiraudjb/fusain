// Logigramme : analyse du code Mermaid en modèle, réécriture, édition visuelle
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { nuancier, echapper, desechapper, sansGuillemets, separerPreambule, plan, marquer } from './commun.js';

// [nom, ouvrant, fermant, libellé] — les ouvrants les plus longs sont testés en premier
const FORMES = [
    ['double-cercle', '(((', ')))', 'Double cercle'],
    ['stade', '([', '])', 'Début / fin (arrondi complet)'],
    ['sous-programme', '[[', ']]', 'Sous-processus'],
    ['cylindre', '[(', ')]', 'Base de données'],
    ['cercle', '((', '))', 'Cercle'],
    ['hexagone', '{{', '}}', 'Hexagone (préparation)'],
    ['parallelogramme', '[/', '/]', 'Entrée / sortie'],
    ['parallelogramme-inverse', '[\\', '\\]', 'Entrée / sortie (inversé)'],
    ['trapeze', '[/', '\\]', 'Trapèze'],
    ['trapeze-inverse', '[\\', '/]', 'Trapèze inversé'],
    ['rectangle', '[', ']', 'Rectangle (étape)'],
    ['arrondi', '(', ')', 'Rectangle arrondi'],
    ['losange', '{', '}', 'Losange (décision)'],
    ['drapeau', '>', ']', 'Étiquette'],
];
const OUVRANTS = [...new Set(FORMES.map((f) => f[1]))].sort((a, b) => b.length - a.length);
const SENS = [['TD', 'De haut en bas'], ['LR', 'De gauche à droite'], ['BT', 'De bas en haut'], ['RL', 'De droite à gauche']];
const TRAITS = [['plein', 'Plein'], ['pointille', 'Pointillé'], ['epais', 'Épais'], ['invisible', 'Invisible']];
const FLECHES = [['fin', 'Flèche'], ['aucune', 'Sans flèche'], ['double', 'Double flèche'], ['rond', 'Extrémité ronde'], ['croix', 'Extrémité en croix']];
const MOTS_BRUTS = ['classDef', 'class', 'linkStyle', 'accTitle', 'accDescr'];
const RESERVES = new Set(['end', 'subgraph', 'direction', 'style', 'click', 'graph', 'flowchart', ...MOTS_BRUTS]);
const RE_ID = /^[\p{L}\p{N}_]+/u;
const RE_LIEN_TEXTE = /^([<ox])?(--|==|-\.)\s+("[^"]*"|.+?)\s+(-{2,}|={2,}|\.+-)([>ox])?(?=\s|$|[\p{L}\p{N}_])/u;
const RE_LIEN = /^([<ox])?(-{2,}|={2,}|-\.+-|~{3,})([>ox])?/;

class Inconnu extends Error {}

// ---------- Analyse ----------

function lireEnonce(texte, modele, groupe) {
    let pos = 0;
    const blancs = () => { while (pos < texte.length && /\s/.test(texte[pos])) pos += 1; };

    const lireNoeud = () => {
        blancs();
        const m = texte.slice(pos).match(RE_ID);
        if (!m || RESERVES.has(m[0])) throw new Inconnu('identifiant attendu');
        const id = m[0];
        pos += id.length;
        let noeud = modele.noeuds.find((n) => n.id === id);
        if (!noeud) { noeud = { id, texte: null, forme: 'rectangle', groupe: null, classe: null }; modele.noeuds.push(noeud); }
        if (groupe && !noeud.groupe) noeud.groupe = groupe;

        const ouvrant = OUVRANTS.find((o) => texte.startsWith(o, pos));
        if (ouvrant) {
            const candidates = FORMES.filter((f) => f[1] === ouvrant);
            let j = pos + ouvrant.length;
            while (texte[j] === ' ') j += 1;
            let libelle;
            let apres;
            if (texte[j] === '"') {
                const fin = texte.indexOf('"', j + 1);
                if (fin < 0) throw new Inconnu('guillemet non fermé');
                libelle = texte.slice(j + 1, fin);
                apres = fin + 1;
                while (texte[apres] === ' ') apres += 1;
            } else {
                apres = Math.min(...candidates.map((f) => texte.indexOf(f[2], j)).filter((x) => x >= 0));
                if (!Number.isFinite(apres)) throw new Inconnu('forme non fermée');
                libelle = texte.slice(j, apres).trim();
            }
            const forme = candidates.find((f) => texte.startsWith(f[2], apres));
            if (!forme) throw new Inconnu('forme non fermée');
            if (/^`[\s\S]*`$/.test(libelle.trim())) throw new Inconnu('texte au format Markdown');
            noeud.texte = desechapper(libelle);
            noeud.forme = forme[0];
            pos = apres + forme[2].length;
        } else if (texte.startsWith('@{', pos)) {
            throw new Inconnu('syntaxe de forme étendue');
        }
        const classe = texte.slice(pos).match(/^:::([\w-]+)/);
        if (classe) { noeud.classe = classe[1]; pos += classe[0].length; }
        return id;
    };

    const lireGroupe = () => {
        const ids = [lireNoeud()];
        blancs();
        while (texte[pos] === '&') { pos += 1; ids.push(lireNoeud()); blancs(); }
        return ids;
    };

    const lireLien = () => {
        blancs();
        const reste = texte.slice(pos);
        let m = reste.match(RE_LIEN_TEXTE);
        let lien;
        if (m) {
            const corps = m[4];
            lien = { debut: m[1] || '', fin: m[5] || '', texte: desechapper(sansGuillemets(m[3])),
                trait: m[2] === '==' ? 'epais' : m[2] === '-.' ? 'pointille' : 'plein',
                longueur: m[2] === '-.' ? corps.length - 1 : corps.length - (m[5] ? 1 : 2) };
        } else {
            m = reste.match(RE_LIEN);
            if (!m) throw new Inconnu('lien attendu');
            const corps = m[2];
            const trait = corps[0] === '=' ? 'epais' : corps[0] === '~' ? 'invisible' : corps.includes('.') ? 'pointille' : 'plein';
            const longueur = trait === 'pointille' ? corps.length - 2 : trait === 'invisible' ? 1 : corps.length - (m[3] ? 1 : 2);
            if (longueur < 1) throw new Inconnu('lien incomplet');
            lien = { debut: m[1] || '', fin: m[3] || '', texte: '', trait, longueur };
        }
        pos += m[0].length;
        blancs();
        if (texte[pos] === '|') {
            const fin = texte.indexOf('|', pos + 1);
            if (fin < 0) throw new Inconnu('libellé de lien non fermé');
            lien.texte = desechapper(sansGuillemets(texte.slice(pos + 1, fin)));
            pos = fin + 1;
        }
        if (/^`[\s\S]*`$/.test(lien.texte.trim())) throw new Inconnu('texte au format Markdown');
        lien.longueur = Math.max(1, Math.min(lien.longueur, 6));
        return lien;
    };

    let sources = lireGroupe();
    blancs();
    while (pos < texte.length) {
        const lien = lireLien();
        const cibles = lireGroupe();
        for (const de of sources) for (const vers of cibles) modele.liens.push({ ...lien, de, vers });
        sources = cibles;
        blancs();
    }
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    const entete = (corps[0] || '').trim().match(/^(flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?\s*;?$/);
    if (!entete) throw new Error('La première ligne doit être « flowchart » suivi du sens (TD, LR…).');
    const modele = { preambule, sens: entete[2] === 'TB' ? 'TD' : entete[2] || 'TD', noeuds: [], liens: [], groupes: [], styles: {}, brut: [] };
    const pile = [];

    corps.slice(1).forEach((ligneBrute, n) => {
        const ligne = ligneBrute.trim().replace(/;$/, '').trim();
        if (!ligne) return;
        const mot = ligne.match(/^[A-Za-z]+/)?.[0] || '';
        const groupe = pile[pile.length - 1] || null;
        try {
            if (ligne.startsWith('%%')) { modele.brut.push(ligne); return; }
            if (mot === 'subgraph') {
                const reste = ligne.slice(8).trim();
                const m = reste.match(/^([\p{L}\p{N}_]+)\s*\[(.*)\]$/u);
                let id;
                let titre;
                if (m) { id = m[1]; titre = desechapper(sansGuillemets(m[2])); }
                else if (RE_ID.test(reste) && reste.match(RE_ID)[0] === reste) { id = reste; titre = reste; }
                else { titre = desechapper(sansGuillemets(reste)); id = nouvelId(modele, 'groupe'); }
                if (!titre || modele.groupes.some((g) => g.id === id)) throw new Inconnu('groupe invalide');
                modele.groupes.push({ id, titre, parent: groupe, sens: null });
                pile.push(id);
                return;
            }
            if (ligne === 'end') { if (!pile.length) throw new Inconnu('« end » sans groupe'); pile.pop(); return; }
            if (mot === 'direction') {
                const m = ligne.match(/^direction\s+(TB|TD|BT|LR|RL)$/);
                if (!m || !groupe) throw new Inconnu('direction');
                modele.groupes.find((g) => g.id === groupe).sens = m[1] === 'TB' ? 'TD' : m[1];
                return;
            }
            if (mot === 'style') {
                const m = ligne.match(/^style\s+([\p{L}\p{N}_]+)\s+(.+)$/u);
                if (!m) throw new Inconnu('style');
                const proprietes = {};
                for (const paire of m[2].split(',')) {
                    const i = paire.indexOf(':');
                    if (i > 0) proprietes[paire.slice(0, i).trim()] = paire.slice(i + 1).trim();
                }
                modele.styles[m[1]] = proprietes;
                return;
            }
            if (mot === 'click') return; // les interactions sont neutralisées (§7.2)
            if (MOTS_BRUTS.includes(mot) && /\s/.test(ligne[mot.length] || '')) { modele.brut.push(ligne); return; }
            lireEnonce(ligne, modele, groupe);
        } catch (e) {
            if (e instanceof Inconnu) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle (${e.message}).`);
            throw e;
        }
    });
    if (pile.length) throw new Error('Un groupe n\'est pas fermé par « end ».');

    // Un lien peut viser un groupe : ce n'est alors pas un nœud
    const idsGroupes = new Set(modele.groupes.map((g) => g.id));
    modele.noeuds = modele.noeuds.filter((n) => !(idsGroupes.has(n.id) && n.texte === null));
    return modele;
}

// ---------- Écriture ----------

function ecrireNoeud(n) {
    const forme = FORMES.find((f) => f[0] === n.forme) || FORMES.find((f) => f[0] === 'rectangle');
    const corps = n.texte === null && n.forme === 'rectangle' ? '' : `${forme[1]}"${echapper(n.texte ?? n.id)}"${forme[2]}`;
    return n.id + corps + (n.classe ? `:::${n.classe}` : '');
}

function ecrireLien(l) {
    const n = Math.max(1, l.longueur || 1);
    let corps;
    if (l.trait === 'invisible') corps = '~~~';
    else if (l.trait === 'pointille') corps = `-${'.'.repeat(n)}-`;
    else corps = (l.trait === 'epais' ? '=' : '-').repeat(n + (l.fin ? 1 : 2));
    const fleche = l.trait === 'invisible' ? '~~~' : `${l.debut}${corps}${l.fin}`;
    const texte = l.texte ? `|"${echapper(l.texte)}"|` : '';
    return `${l.de} ${fleche}${texte} ${l.vers}`;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, `flowchart ${modele.sens}`];
    const marge = (p) => '    '.repeat(p);
    const ecrireGroupe = (idParent, p) => {
        for (const n of modele.noeuds.filter((x) => x.groupe === idParent)) lignes.push(marge(p) + ecrireNoeud(n));
        for (const g of modele.groupes.filter((x) => x.parent === idParent)) {
            lignes.push(`${marge(p)}subgraph ${g.id} ["${echapper(g.titre)}"]`);
            if (g.sens) lignes.push(`${marge(p + 1)}direction ${g.sens}`);
            ecrireGroupe(g.id, p + 1);
            lignes.push(`${marge(p)}end`);
        }
    };
    ecrireGroupe(null, 1);
    for (const l of modele.liens) lignes.push(marge(1) + ecrireLien(l));
    for (const [id, proprietes] of Object.entries(modele.styles)) {
        const paires = Object.entries(proprietes).map(([k, v]) => `${k}:${v}`);
        if (paires.length) lignes.push(`${marge(1)}style ${id} ${paires.join(',')}`);
    }
    for (const b of modele.brut) lignes.push(marge(1) + b);
    return lignes.join('\n') + '\n';
}

// ---------- Opérations sur le modèle ----------

function nouvelId(modele, prefixe) {
    const pris = new Set([...modele.noeuds.map((n) => n.id), ...modele.groupes.map((g) => g.id)]);
    let i = 1;
    while (pris.has(`${prefixe}${i}`)) i += 1;
    return `${prefixe}${i}`;
}

function ajouterNoeud(modele, groupe = null, texte = 'Nouvelle étape') {
    const noeud = { id: nouvelId(modele, 'n'), texte, forme: 'rectangle', groupe, classe: null };
    modele.noeuds.push(noeud);
    return noeud;
}

function nouveauLien(de, vers) {
    return { de, vers, debut: '', fin: '>', texte: '', trait: 'plein', longueur: 1 };
}

function supprimerNoeud(modele, id) {
    modele.noeuds = modele.noeuds.filter((n) => n.id !== id);
    modele.liens = modele.liens.filter((l) => l.de !== id && l.vers !== id);
    delete modele.styles[id];
}

function supprimerGroupe(modele, id) {
    const g = modele.groupes.find((x) => x.id === id);
    if (!g) return;
    // Le contenu remonte dans le groupe parent : supprimer un groupe ne détruit pas ses étapes
    for (const n of modele.noeuds) if (n.groupe === id) n.groupe = g.parent;
    for (const x of modele.groupes) if (x.parent === id) x.parent = g.parent;
    modele.groupes = modele.groupes.filter((x) => x.id !== id);
    modele.liens = modele.liens.filter((l) => l.de !== id && l.vers !== id);
    delete modele.styles[id];
}

function typeFleche(l) {
    if (l.debut === '<' && l.fin === '>') return 'double';
    if (l.fin === 'o') return 'rond';
    if (l.fin === 'x') return 'croix';
    return l.fin === '>' ? 'fin' : 'aucune';
}

function appliquerFleche(l, type) {
    l.debut = type === 'double' ? '<' : '';
    l.fin = { fin: '>', double: '>', rond: 'o', croix: 'x', aucune: '' }[type];
}

const nomNoeud = (n) => (n.texte ?? n.id).replace(/\s+/g, ' ');
function nomExtremite(modele, id) {
    const n = modele.noeuds.find((x) => x.id === id);
    if (n) return nomNoeud(n);
    return modele.groupes.find((g) => g.id === id)?.titre || id;
}

// ---------- Interface commune aux éditeurs ----------

export function elements(modele) {
    return [
        ...modele.noeuds.map((n) => ({ cle: `n:${n.id}`, nom: nomNoeud(n) })),
        ...modele.liens.map((l, i) => ({ cle: `l:${i}`, nom: `${nomExtremite(modele, l.de)} → ${nomExtremite(modele, l.vers)}${l.texte ? ` (${l.texte})` : ''}` })),
        ...modele.groupes.map((g) => ({ cle: `g:${g.id}`, nom: `Groupe : ${g.titre}` })),
    ];
}

// Associe chaque élément du SVG rendu à son élément du modèle
export function reperer(svg, modele) {
    const prefixe = `${svg.id}-`;
    for (const g of svg.querySelectorAll('g.node')) {
        const m = g.id.startsWith(prefixe) && g.id.slice(prefixe.length).match(/^flowchart-(.+)-\d+$/);
        if (m && modele.noeuds.some((n) => n.id === m[1])) marquer(g, `n:${m[1]}`);
    }
    const chemins = [...svg.querySelectorAll('path.flowchart-link')];
    if (chemins.length === modele.liens.length) {
        chemins.forEach((chemin, i) => {
            marquer(chemin, `l:${i}`);
            const touche = chemin.cloneNode(false);
            touche.removeAttribute('id');
            touche.removeAttribute('marker-end');
            touche.removeAttribute('marker-start');
            touche.setAttribute('class', 'fusain-touche');
            marquer(touche, `l:${i}`);
            chemin.after(touche);
            const idLien = chemin.getAttribute('data-id');
            const etiquette = idLien && svg.querySelector(`g.edgeLabel g.label[data-id="${CSS.escape(idLien)}"]`);
            marquer(etiquette, `l:${i}`);
        });
    }
    for (const g of svg.querySelectorAll('g.cluster')) {
        const id = g.id.startsWith(prefixe) ? g.id.slice(prefixe.length) : g.id;
        if (modele.groupes.some((x) => x.id === id)) marquer(g, `g:${id}`);
    }
}

export function texte(modele, cle) {
    const [genre, id] = [cle.slice(0, 1), cle.slice(2)];
    if (genre === 'n') { const n = modele.noeuds.find((x) => x.id === id); return n ? n.texte ?? n.id : null; }
    if (genre === 'l') return modele.liens[Number(id)]?.texte ?? null;
    if (genre === 'g') return modele.groupes.find((x) => x.id === id)?.titre ?? null;
    return null;
}

export function renommer(modele, cle, valeur) {
    const [genre, id] = [cle.slice(0, 1), cle.slice(2)];
    if (genre === 'n') { const n = modele.noeuds.find((x) => x.id === id); if (n) n.texte = valeur.trim() || n.id; }
    if (genre === 'l' && modele.liens[Number(id)]) modele.liens[Number(id)].texte = valeur.trim();
    if (genre === 'g') { const g = modele.groupes.find((x) => x.id === id); if (g && valeur.trim()) g.titre = valeur.trim(); }
}

export function supprimer(modele, cle) {
    const [genre, id] = [cle.slice(0, 1), cle.slice(2)];
    if (genre === 'n') supprimerNoeud(modele, id);
    if (genre === 'l') modele.liens.splice(Number(id), 1);
    if (genre === 'g') supprimerGroupe(modele, id);
}

export const peutRelier = (cle) => cle.startsWith('n:') || cle.startsWith('g:');

// Tire un lien depuis « de » : vers un élément existant, ou vers une nouvelle étape si « vers » est vide
export function relier(modele, de, vers) {
    const source = de.slice(2);
    if (vers && vers !== de && peutRelier(vers)) {
        modele.liens.push(nouveauLien(source, vers.slice(2)));
        return `l:${modele.liens.length - 1}`;
    }
    const origine = modele.noeuds.find((n) => n.id === source);
    const noeud = ajouterNoeud(modele, origine?.groupe ?? null);
    modele.liens.push(nouveauLien(source, noeud.id));
    return `n:${noeud.id}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const blocs = [];

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Logigramme'),
        champSelect('Sens de lecture', SENS, modele.sens, (v) => appliquer((m) => { m.sens = v; })),
        h('div', { class: 'fusain-actions' },
            bouton('Ajouter une étape', { icone: 'add-line', variante: 'secondary', onclick: () => {
                let cle;
                appliquer((m) => { cle = `n:${ajouterNoeud(m).id}`; }, () => cle);
            } }),
            bouton('Ajouter un groupe', { icone: 'add-line', onclick: () => {
                let cle;
                appliquer((m) => {
                    const id = nouvelId(m, 'groupe');
                    m.groupes.push({ id, titre: 'Nouveau groupe', parent: null, sens: null });
                    ajouterNoeud(m, id);
                    cle = `g:${id}`;
                }, () => cle);
            } }))));

    const genre = selection?.slice(0, 1);
    const id = selection?.slice(2);

    if (genre === 'n' && modele.noeuds.some((n) => n.id === id)) {
        const n = modele.noeuds.find((x) => x.id === id);
        const maj = (f) => appliquer((m) => f(m.noeuds.find((x) => x.id === id), m));
        const autres = [...modele.noeuds.filter((x) => x.id !== id).map((x) => [`n:${x.id}`, nomNoeud(x)]), ...modele.groupes.map((g) => [`g:${g.id}`, `Groupe : ${g.titre}`])];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Étape sélectionnée'),
            champTexte('Texte', n.texte ?? n.id, (v) => maj((x) => { x.texte = v.trim() || x.id; }), { multiligne: true, id: 'fusain-champ-texte' }),
            champSelect('Forme', FORMES.map((f) => [f[0], f[3]]), n.forme, (v) => maj((x) => { x.forme = v; if (x.texte === null) x.texte = x.id; })),
            modele.groupes.length ? champSelect('Groupe', [['', 'Aucun'], ...modele.groupes.map((g) => [g.id, g.titre])], n.groupe || '', (v) => maj((x) => { x.groupe = v || null; })) : null,
            h('p', { class: 'fr-label fusain-champ' }, 'Couleur'),
            nuancier(modele.styles[id]?.fill, (fond, bord) => maj((x, m) => {
                if (fond) m.styles[id] = { ...m.styles[id], fill: fond, stroke: bord, color: '#161616' };
                else delete m.styles[id];
            })),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter une étape liée', { icone: 'add-line', variante: 'secondary', onclick: () => {
                    let cle;
                    appliquer((m) => { cle = relier(m, selection, null); }, () => cle);
                } }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimerNoeud(m, id), () => null) })),
            autres.length ? champSelect('Relier à…', [['', 'Choisir une destination'], ...autres], '', (v) => {
                if (!v) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, v); }, () => cle);
            }) : null));
    }

    if (genre === 'l' && modele.liens[Number(id)]) {
        const i = Number(id);
        const l = modele.liens[i];
        const maj = (f) => appliquer((m) => f(m.liens[i]));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Lien sélectionné'),
            h('p', { class: 'fusain-aide' }, `${nomExtremite(modele, l.de)} → ${nomExtremite(modele, l.vers)}`),
            champTexte('Texte du lien', l.texte, (v) => maj((x) => { x.texte = v.trim(); }), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champSelect('Trait', TRAITS, l.trait, (v) => maj((x) => { x.trait = v; })),
                champSelect('Extrémité', FLECHES, typeFleche(l), (v) => maj((x) => appliquerFleche(x, v)))),
            champSelect('Longueur', [[1, 'Normale'], [2, 'Longue'], [3, 'Très longue']].map(([v, nom]) => [String(v), nom]), String(Math.min(l.longueur, 3)), (v) => maj((x) => { x.longueur = Number(v); })),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => maj((x) => { [x.de, x.vers] = [x.vers, x.de]; }) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => { m.liens.splice(i, 1); }, () => null) }))));
    }

    if (genre === 'g' && modele.groupes.some((g) => g.id === id)) {
        const g = modele.groupes.find((x) => x.id === id);
        const maj = (f) => appliquer((m) => f(m.groupes.find((x) => x.id === id), m));
        // Un groupe ne peut pas être rangé dans lui-même ni dans l'un de ses descendants
        const descendants = new Set([id]);
        for (let ajout = true; ajout;) {
            ajout = false;
            for (const x of modele.groupes) if (x.parent && descendants.has(x.parent) && !descendants.has(x.id)) { descendants.add(x.id); ajout = true; }
        }
        const parents = modele.groupes.filter((x) => !descendants.has(x.id));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Groupe sélectionné'),
            champTexte('Titre', g.titre, (v) => maj((x) => { if (v.trim()) x.titre = v.trim(); }), { id: 'fusain-champ-texte' }),
            champSelect('Sens à l\'intérieur du groupe', [['', 'Comme le schéma'], ...SENS], g.sens || '', (v) => maj((x) => { x.sens = v || null; })),
            parents.length ? champSelect('Rangé dans', [['', 'Aucun groupe'], ...parents.map((x) => [x.id, x.titre])], g.parent || '', (v) => maj((x) => { x.parent = v || null; })) : null,
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter une étape dans le groupe', { icone: 'add-line', variante: 'secondary', onclick: () => {
                    let cle;
                    appliquer((m) => { cle = `n:${ajouterNoeud(m, id).id}`; }, () => cle);
                } }),
                bouton('Dissoudre le groupe', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimerGroupe(m, id), () => null) }))));
    }

    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'flowchart', nom: 'Logigramme', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

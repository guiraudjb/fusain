// Diapositive de texte : une mise en page de la charte de l'État pour les présentations, remplie de textes.
// Ce n'est pas un schéma Mermaid : le code est un petit format « clé: valeur », dessiné par js/diapo.js.
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { deplacer, actionsListe, plan, marquer } from './commun.js';

// Mises en page reprises des diapositives libres de VALOR. Pour chacune : champs simples (clé, libellé, valeur de départ),
// champs d'un élément répété, éléments de départ.
export const DISPOSITIONS = {
    titre: { nom: 'Page de titre', champs: [['titre', 'Titre', 'Titre de la<br>présentation'], ['sous-titre', 'Sous-titre', 'Sous-titre de la présentation'], ['date', 'Date', 'xx mai'], ['annee', 'Année', '2026']] },
    'titre-epure': { nom: 'Page de titre (épurée)', champs: [['titre', 'Titre', 'Titre de la<br>présentation'], ['sous-titre', 'Sous-titre', 'Sous-titre de la présentation']] },
    sommaire: { nom: 'Sommaire', champs: [['titre', 'Titre', 'SOMMAIRE']], item: ['Titre', 'Descriptif'], items: [['ÉLÉMENT 1', 'Descriptif ou sous-titre de cette partie...'], ['ÉLÉMENT 2', 'Descriptif ou sous-titre de cette partie...'], ['ÉLÉMENT 3', 'Descriptif ou sous-titre de cette partie...']] },
    'sommaire-colonnes': { nom: 'Sommaire (colonnes)', champs: [['titre', 'Titre', 'Sommaire']], item: ['Titre de la partie', 'Sous-titres (séparés par « ; »)'], items: [1, 2, 3, 4].map((n) => [`${n}. Titre de la partie`, 'a. Sous-titre de partie ; b. Sous-titre de partie ; c. Sous-titre de partie']) },
    intercalaire: { nom: 'Intercalaire', champs: [['numero', 'Numéro', '1'], ['titre', 'Nom de la partie', 'Nom de la partie']] },
    'intercalaire-centre': { nom: 'Intercalaire (centré)', champs: [['titre', 'Titre', '1. Titre de partie']] },
    colonne: { nom: 'Une colonne', champs: [['titre', 'Titre', 'ÉLÉMENT 1 :'], ['texte', 'Texte', 'Votre texte : une analyse, un compte rendu, une synthèse.']] },
    colonnes: { nom: 'Deux ou trois colonnes', item: ['Titre', 'Texte'], items: [['ÉLÉMENT 1', 'Contenu de la première colonne...'], ['ÉLÉMENT 2', 'Contenu de la seconde colonne...']] },
    'texte-colonnes': { nom: 'Texte en colonnes', champs: [['partie', 'Partie', '1. Titre de partie'], ['sous-partie', 'Sous-partie', 'a. Titre de sous-partie'], ['titre', 'Titre', 'Niveau 1'], ['accroche', 'Accroche', 'Une phrase d\'accroche en gras']], item: ['Texte de la colonne'], items: [['Texte de la première colonne.'], ['Texte de la deuxième colonne.'], ['Texte de la troisième colonne.']] },
    chiffres: { nom: 'Chiffres clés', item: ['Chiffre', 'Légende'], items: [['XX', 'Zone de texte explicative'], ['XX', 'Zone de texte explicative'], ['XX', 'Zone de texte explicative'], ['XX', 'Zone de texte explicative']] },
    frise: { nom: 'Frise, étapes', item: ['Titre', 'Texte'], items: [['Élément 1', 'Zone de texte descriptive pour cette première étape ou information.'], ['Élément 2', 'Zone de texte descriptive pour cette deuxième étape.'], ['Élément 3', 'Zone de texte descriptive pour la conclusion.']] },
    blocs: { nom: 'Texte et blocs', champs: [['partie', 'Partie', '1. Titre de partie'], ['sous-partie', 'Sous-partie', 'a. Titre de sous-partie'], ['titre', 'Titre', 'Niveau 1 : le message principal'], ['texte', 'Texte', 'Niveau 2 : quelques lignes d\'explication.']], item: ['Titre', 'Texte'], items: [1, 2, 3, 4].map(() => ['Niveau 3', 'Une précision']) },
    libre: { nom: 'Texte libre', blocs: [['h2', 'Titre de la diapositive'], ['p', 'Un paragraphe de texte. Les mots entre deux astérisques doubles sont en **gras**.'], ['li', 'Un premier point'], ['li', 'Un second point']] },
};
const BLOCS = [['h2', 'Titre', '# '], ['h3', 'Sous-titre', '## '], ['p', 'Paragraphe', ''], ['li', 'Puce', '- '], ['ligne', 'Ligne de tableau', '| ']];
const ITEMS_MAX = 8;

// Un texte tient sur une ligne du code : les retours à la ligne s'écrivent <br>
const propre = (t) => String(t).replace(/\r?\n/g, '<br>').replace(/[\t ]+/g, ' ').trim();
const propreItem = (t) => propre(t).replace(/\|/g, '/');
const enLignes = (t) => String(t).replace(/<br\s*\/?>/gi, '\n');

export function analyser(code) {
    const lignes = String(code).replace(/\r\n?/g, '\n').split('\n');
    const debut = lignes.findIndex((l) => l.trim());
    const entete = (lignes[debut] || '').trim().match(/^diapo\s+([a-z-]+)$/);
    const d = entete && DISPOSITIONS[entete[1]];
    if (!d) throw new Error(`La première ligne doit être « diapo » suivi d'une mise en page : ${Object.keys(DISPOSITIONS).join(', ')}.`);
    const modele = { preambule: [], disposition: entete[1], champs: {}, items: [], blocs: [] };
    lignes.slice(debut + 1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne) return;
        if (d.blocs) {
            // « ## » sous-titre, « # » titre, « - » puce, « | » ligne de tableau ; tout le reste est un paragraphe
            const b = ligne.match(/^(##|#|-)(?:\s+(.*))?$/);
            if (b) modele.blocs.push({ t: { '##': 'h3', '#': 'h2', '-': 'li' }[b[1]], texte: b[2] || '' });
            else if (ligne.startsWith('|')) modele.blocs.push({ t: 'ligne', texte: ligne.replace(/^\|\s*|\s*\|$/g, '') });
            else modele.blocs.push({ t: 'p', texte: ligne.replace(/^\u200b/, '') });
            return;
        }
        if (ligne.startsWith('- ') || ligne === '-') {
            if (!d.item) throw new Error(`Ligne ${debut + n + 2} : cette mise en page n'a pas d'éléments répétés.`);
            const valeurs = ligne.slice(1).split('|').map((x) => x.trim());
            modele.items.push(d.item.map((_, k) => valeurs[k] ?? ''));
            return;
        }
        const m = ligne.match(/^([a-z-]+)\s*:\s*(.*)$/);
        if (!m || !(d.champs || []).some(([cle]) => cle === m[1])) throw new Error(`Ligne ${debut + n + 2} : champ inconnu pour la mise en page « ${d.nom} ».`);
        modele.champs[m[1]] = m[2];
    });
    return modele;
}

export function ecrire(modele) {
    const d = DISPOSITIONS[modele.disposition];
    const lignes = [`diapo ${modele.disposition}`];
    for (const [cle] of d.champs || []) if (propre(modele.champs[cle] ?? '')) lignes.push(`${cle}: ${propre(modele.champs[cle])}`);
    for (const item of d.item ? modele.items : []) lignes.push(`- ${d.item.map((_, k) => propreItem(item[k] ?? '')).join(' | ')}`.replace(/(\s\|\s)+$/, '').trimEnd());
    for (const b of d.blocs ? modele.blocs : []) {
        const marque = BLOCS.find(([g]) => g === b.t)[2];
        // Un paragraphe qui commencerait comme un titre, une puce ou un tableau est protégé par une espace sans chasse
        const texte = b.t === 'ligne' ? `${propre(b.texte)} |` : propre(b.texte).replace(/^\u200b+/, '') || '…';
        lignes.push(`${marque}${b.t === 'p' && /^(#|-(\s|$)|\|)/.test(texte) ? '\u200b' : ''}${texte}`);
    }
    return lignes.join('\n') + '\n';
}

// Code de départ d'une mise en page
export function codeInitial(disposition) {
    const d = DISPOSITIONS[disposition];
    return ecrire({ disposition, champs: Object.fromEntries((d.champs || []).map(([cle, , defaut]) => [cle, defaut])), items: (d.items || []).map((i) => [...i]), blocs: (d.blocs || []).map(([t, texte]) => ({ t, texte })) });
}

export function elements(modele) {
    const d = DISPOSITIONS[modele.disposition];
    const court = (t) => enLignes(t).replace(/\n/g, ' ').slice(0, 60);
    return [
        ...(d.champs || []).map(([cle, nom]) => ({ cle: `c:${cle}`, nom: `${nom} : ${court(modele.champs[cle] ?? '')}` })),
        ...(d.item ? modele.items : []).flatMap((item, n) => d.item.map((nom, k) => ({ cle: `e:${n}.${k}`, nom: `${k ? '— ' : `${n + 1}. `}${court(item[k] ?? '')}` }))),
        ...(d.blocs ? modele.blocs : []).map((b, n) => ({ cle: `b:${n}`, nom: `${BLOCS.find(([g]) => g === b.t)[1]} : ${court(b.texte)}` })),
    ];
}

// Le dessin porte déjà la clé de chaque texte
export function reperer(svg) {
    for (const el of svg.querySelectorAll('[data-champ]')) marquer(el, el.getAttribute('data-champ'));
}

function viser(modele, cle) {
    const [n, k] = cle.slice(2).split('.').map(Number);
    if (cle.startsWith('c:')) return { lire: () => modele.champs[cle.slice(2)] ?? '', ecrire: (v) => { modele.champs[cle.slice(2)] = v; }, existe: (DISPOSITIONS[modele.disposition].champs || []).some(([c]) => c === cle.slice(2)) };
    if (cle.startsWith('e:')) return { n, k, lire: () => modele.items[n][k] ?? '', ecrire: (v) => { modele.items[n][k] = v; }, existe: Boolean(modele.items[n]) && k < (DISPOSITIONS[modele.disposition].item || []).length };
    return { n, lire: () => modele.blocs[n].texte, ecrire: (v) => { modele.blocs[n].texte = v; }, existe: Boolean(modele.blocs[n]) };
}

export function texte(modele, cle) { const v = viser(modele, cle); return v.existe ? enLignes(v.lire()) : null; }
export function renommer(modele, cle, valeur) { const v = viser(modele, cle); if (v.existe) v.ecrire(cle.startsWith('e:') ? propreItem(valeur) : propre(valeur)); }

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (!v.existe) return;
    if (cle.startsWith('c:')) v.ecrire('');
    else if (cle.startsWith('e:')) { if (modele.items.length > 1) modele.items.splice(v.n, 1); } else if (modele.blocs.length > 1) modele.blocs.splice(v.n, 1);
}

export const peutRelier = (cle) => cle.startsWith('e:') || cle.startsWith('b:');

// La poignée ajoute un élément (ou un bloc de texte) à la suite
export function relier(modele, de, vers) {
    const v = viser(modele, de);
    if (vers || !v.existe) return null;
    if (de.startsWith('b:')) { modele.blocs.splice(v.n + 1, 0, { t: modele.blocs[v.n].t === 'h2' || modele.blocs[v.n].t === 'h3' ? 'p' : modele.blocs[v.n].t, texte: modele.blocs[v.n].t === 'ligne' ? 'Donnée | Donnée' : 'Nouveau texte' }); return `b:${v.n + 1}`; }
    if (modele.items.length >= ITEMS_MAX) return null;
    modele.items.splice(v.n + 1, 0, DISPOSITIONS[modele.disposition].item.map((nom) => nom.split(' (')[0]));
    return `e:${v.n + 1}.0`;
}

// Changer de mise en page conserve les textes qui ont leur place dans la nouvelle
function changerDisposition(modele, disposition) {
    const d = DISPOSITIONS[disposition];
    const ancien = DISPOSITIONS[modele.disposition];
    modele.disposition = disposition;
    modele.champs = Object.fromEntries((d.champs || []).map(([cle, , defaut]) => [cle, modele.champs[cle] ?? defaut]));
    modele.items = d.item ? (ancien.item && modele.items.length ? modele.items : d.items).map((i) => d.item.map((_, k) => i[k] ?? '')) : [];
    modele.blocs = d.blocs ? (modele.blocs.length ? modele.blocs : d.blocs.map(([t, texte]) => ({ t, texte }))) : [];
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const d = DISPOSITIONS[modele.disposition];
    const v = selection ? viser(modele, selection) : {};
    const saisie = (libelle, cle, attrs = {}) => champTexte(libelle, texte(modele, cle), (val) => appliquer((m) => renommer(m, cle, val)), { multiligne: true, rows: 2, ...attrs, ...(cle === selection ? { id: 'fusain-champ-texte' } : {}) });
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diapositive de texte'),
        champSelect('Mise en page', Object.entries(DISPOSITIONS).map(([id, x]) => [id, x.nom]), modele.disposition, (val) => appliquer((m) => changerDisposition(m, val), () => null)),
        (d.champs || []).map(([cle, nom]) => saisie(nom, `c:${cle}`)),
        h('p', { class: 'fusain-aide' }, 'Deux astérisques autour d\'un passage le mettent en **gras**. Un retour à la ligne dans le champ est repris sur la diapositive.'))];

    if (d.item) {
        const n = selection?.startsWith('e:') && v.existe ? v.n : -1;
        const ajout = () => appliquer((m) => { m.items.splice(n < 0 ? m.items.length : n + 1, 0, d.item.map((nom) => nom.split(' (')[0])); }, (m) => `e:${n < 0 ? m.items.length - 1 : n + 1}.0`);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, n >= 0 ? `Élément ${n + 1} sur ${modele.items.length}` : `Éléments (${modele.items.length})`),
            n >= 0 ? [
                d.item.map((nom, k) => saisie(nom, `e:${n}.${k}`)),
                actionsListe({
                    monter: () => appliquer(() => {}, (m) => `e:${deplacer(m.items, n, -1)}.${v.k}`),
                    descendre: () => appliquer(() => {}, (m) => `e:${deplacer(m.items, n, 1)}.${v.k}`),
                    supprimer: modele.items.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
                }),
            ] : h('p', { class: 'fusain-aide' }, 'Cliquez sur un élément de la diapositive pour le modifier.'),
            modele.items.length < ITEMS_MAX ? h('div', { class: 'fusain-actions' }, bouton('Ajouter un élément', { icone: 'add-line', variante: 'secondary', onclick: ajout })) : null));
    }

    if (d.blocs) {
        const n = selection?.startsWith('b:') && v.existe ? v.n : -1;
        const ajout = (t, defaut) => bouton(BLOCS.find(([g]) => g === t)[1], { icone: 'add-line', onclick: () => appliquer((m) => { m.blocs.splice(n < 0 ? m.blocs.length : n + 1, 0, { t, texte: defaut }); }, (m) => `b:${n < 0 ? m.blocs.length - 1 : n + 1}`) });
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, n >= 0 ? 'Bloc de texte sélectionné' : 'Blocs de texte'),
            n >= 0 ? [
                champSelect('Nature', BLOCS.map(([g, nom]) => [g, nom]), modele.blocs[n].t, (val) => appliquer((m) => { m.blocs[n].t = val; })),
                saisie(modele.blocs[n].t === 'ligne' ? 'Cellules, séparées par une barre « | »' : 'Texte', `b:${n}`, { rows: 3 }),
                actionsListe({
                    monter: () => appliquer(() => {}, (m) => `b:${deplacer(m.blocs, n, -1)}`),
                    descendre: () => appliquer(() => {}, (m) => `b:${deplacer(m.blocs, n, 1)}`),
                    supprimer: modele.blocs.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
                }),
            ] : null,
            h('div', { class: 'fusain-actions' }, ajout('h2', 'Titre'), ajout('h3', 'Sous-titre'), ajout('p', 'Nouveau paragraphe'), ajout('li', 'Nouveau point'), ajout('ligne', 'Colonne 1 | Colonne 2 | Colonne 3')),
            h('p', { class: 'fusain-aide' }, 'Des lignes de tableau qui se suivent forment un tableau ; la première en est l\'en-tête.')));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'diapo', nom: 'Diapositive de texte', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };

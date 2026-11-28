// Diapositive de texte : une mise en page de la charte de l'État pour les présentations, remplie de textes.
// Ce n'est pas un schéma Mermaid : le code est un petit format « clé: valeur », dessiné par js/diapo.js.
import { h, bouton, champTexte, champSelect, message } from '../dom.js';
import { deplacer, actionsListe, plan, marquer } from './commun.js';
import { choisirIcone } from '../icones.js';
import { COULEURS_TEXTE, COULEURS_STABILO, texteSansMarques } from '../texte-riche.js';

// Mises en page reprises des diapositives libres de VALOR. Pour chacune : champs simples (clé, libellé, valeur de départ),
// champs d'un élément répété, éléments de départ.
export const DISPOSITIONS = {
    titre: { nom: 'Page de titre', champs: [['titre', 'Titre', 'Titre de la<br>présentation'], ['sous-titre', 'Sous-titre', 'Sous-titre de la présentation'], ['date', 'Date', 'xx mai'], ['annee', 'Année', '2026']] },
    'titre-epure': { nom: 'Page de titre (épurée)', champs: [['titre', 'Titre', 'Titre de la<br>présentation'], ['sous-titre', 'Sous-titre', 'Sous-titre de la présentation']] },
    sommaire: { nom: 'Sommaire', icones: true, champs: [['titre', 'Titre', 'SOMMAIRE']], item: ['Titre', 'Descriptif'], items: [['ÉLÉMENT 1', 'Descriptif ou sous-titre de cette partie...'], ['ÉLÉMENT 2', 'Descriptif ou sous-titre de cette partie...'], ['ÉLÉMENT 3', 'Descriptif ou sous-titre de cette partie...']] },
    'sommaire-colonnes': { nom: 'Sommaire (colonnes)', champs: [['titre', 'Titre', 'Sommaire']], item: ['Titre de la partie', 'Sous-titres (séparés par « ; »)'], items: [1, 2, 3, 4].map((n) => [`${n}. Titre de la partie`, 'a. Sous-titre de partie ; b. Sous-titre de partie ; c. Sous-titre de partie']) },
    intercalaire: { nom: 'Intercalaire', champs: [['numero', 'Numéro', '1'], ['titre', 'Nom de la partie', 'Nom de la partie']] },
    'intercalaire-centre': { nom: 'Intercalaire (centré)', champs: [['titre', 'Titre', '1. Titre de partie']] },
    colonne: { nom: 'Une colonne', champs: [['titre', 'Titre', 'ÉLÉMENT 1 :'], ['texte', 'Texte', 'Votre texte : une analyse, un compte rendu, une synthèse.']] },
    colonnes: { nom: 'Deux ou trois colonnes', icones: true, item: ['Titre', 'Texte'], items: [['ÉLÉMENT 1', 'Contenu de la première colonne...'], ['ÉLÉMENT 2', 'Contenu de la seconde colonne...']] },
    'texte-colonnes': { nom: 'Texte en colonnes', champs: [['partie', 'Partie', '1. Titre de partie'], ['sous-partie', 'Sous-partie', 'a. Titre de sous-partie'], ['titre', 'Titre', 'Niveau 1'], ['accroche', 'Accroche', 'Une phrase d\'accroche en gras']], item: ['Texte de la colonne'], items: [['Texte de la première colonne.'], ['Texte de la deuxième colonne.'], ['Texte de la troisième colonne.']] },
    chiffres: { nom: 'Chiffres clés', icones: true, item: ['Chiffre', 'Légende'], items: [['XX', 'Zone de texte explicative'], ['XX', 'Zone de texte explicative'], ['XX', 'Zone de texte explicative'], ['XX', 'Zone de texte explicative']] },
    frise: { nom: 'Frise, étapes', icones: true, item: ['Titre', 'Texte'], items: [['Élément 1', 'Zone de texte descriptive pour cette première étape ou information.'], ['Élément 2', 'Zone de texte descriptive pour cette deuxième étape.'], ['Élément 3', 'Zone de texte descriptive pour la conclusion.']] },
    blocs: { nom: 'Texte et blocs', icones: true, champs: [['partie', 'Partie', '1. Titre de partie'], ['sous-partie', 'Sous-partie', 'a. Titre de sous-partie'], ['titre', 'Titre', 'Niveau 1 : le message principal'], ['texte', 'Texte', 'Niveau 2 : quelques lignes d\'explication.']], item: ['Titre', 'Texte'], items: [1, 2, 3, 4].map(() => ['Niveau 3', 'Une précision']) },
    libre: { nom: 'Texte libre', blocs: [['h2', 'Titre de la diapositive'], ['p', 'Un paragraphe de texte. Les mots entre deux astérisques doubles sont en **gras**.'], ['li', 'Un premier point'], ['li', 'Un second point']] },
};
const BLOCS = [['h2', 'Titre', '# '], ['h3', 'Sous-titre', '## '], ['p', 'Paragraphe', ''], ['li', 'Puce', '- '], ['ligne', 'Ligne de tableau', '| '], ['icone', 'Icône', '']];
export const ALIGNEMENTS_TEXTE = [
    ['', 'Par défaut'],
    ['gauche', 'À gauche'],
    ['centre', 'Centré'],
    ['droite', 'À droite'],
    ['justifie', 'Justifié'],
];
export const TAILLES_POLICE = [
    ['', 'Par défaut'],
    ['12', '12 px (très petit)'],
    ['14', '14 px (petit)'],
    ['16', '16 px (normal)'],
    ['18', '18 px'],
    ['20', '20 px (moyen)'],
    ['22', '22 px'],
    ['24', '24 px (grand)'],
    ['28', '28 px'],
    ['32', '32 px (sous-titre)'],
    ['36', '36 px'],
    ['40', '40 px (titre)'],
    ['48', '48 px'],
    ['56', '56 px'],
    ['64', '64 px (très grand)'],
    ['72', '72 px'],
];
const ALIGN_PERMIS = new Set(['gauche', 'centre', 'droite', 'justifie']);

// Une icône embarquée : « dsfr:nom », « illus:nom » ou « picto:nom ». Elle s'écrit entre crochets, en tête d'un élément ou seule sur sa ligne.
const RE_NOM_ICONE = /^(?:dsfr|illus|picto):[a-z0-9-]+$/;
const RE_ICONE = /^\[((?:dsfr|illus|picto):[a-z0-9-]+)\]\s*(.*)$/;
const ICONE_DEPART = 'dsfr:information-line';
// Un texte qui commencerait comme une icône ou une directive @style est protégé par une espace sans chasse
const proteger = (t) => (/^(\[(dsfr|illus|picto):|@style\b)/.test(t) ? `\u200b${t}` : t);
const ITEMS_MAX = 8;

// Un texte tient sur une ligne du code : les retours à la ligne s'écrivent <br>
const propre = (t) => String(t).replace(/\r?\n/g, '<br>').replace(/[\t ]+/g, ' ').trim();
const propreItem = (t) => propre(t).replace(/\|/g, '/');
const enLignes = (t) => String(t).replace(/<br\s*\/?>/gi, '\n');

function normaliserStyle(st) {
    if (!st) return { taille: null, align: '' };
    const t = Number(st.taille);
    const taille = Number.isFinite(t) && t >= 8 && t <= 120 ? Math.round(t * 10) / 10 : null;
    const align = ALIGN_PERMIS.has(st.align) ? st.align : '';
    return { taille, align };
}

function analyserLigneStyle(reste) {
    const st = { taille: null, align: '' };
    for (const jeton of String(reste).trim().split(/\s+/)) {
        const [k, v] = jeton.split('=');
        if (k === 'taille') {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 8 && n <= 120) st.taille = Math.round(n * 10) / 10;
        } else if (k === 'align' && ALIGN_PERMIS.has(v)) {
            st.align = v;
        }
    }
    return st;
}

function formaterStyle(cible, st) {
    const { taille, align } = normaliserStyle(st);
    const parties = [];
    if (taille) parties.push(`taille=${taille}`);
    if (align) parties.push(`align=${align}`);
    return parties.length ? `@style ${cible} ${parties.join(' ')}` : '';
}

export function lireStyle(modele, cle) {
    if (!modele || !cle) return { taille: null, align: '' };
    if (cle === 'defaut') return normaliserStyle(modele.styles?.defaut);
    if (cle.startsWith('c:')) return normaliserStyle(modele.styles?.[cle]);
    if (cle.startsWith('e:')) {
        const [n, k] = cle.slice(2).split('.').map(Number);
        return normaliserStyle(modele.items[n]?.styles?.[k]);
    }
    if (cle.startsWith('b:')) {
        const n = Number(cle.slice(2));
        const b = modele.blocs[n];
        return normaliserStyle(b ? { taille: b.taille, align: b.align } : null);
    }
    return { taille: null, align: '' };
}

export function definirStyle(modele, cle, modif) {
    if (!modele || !cle) return;
    const actuel = lireStyle(modele, cle);
    const suivant = normaliserStyle({ ...actuel, ...modif });
    if (cle === 'defaut' || cle.startsWith('c:')) {
        modele.styles ||= {};
        if (!suivant.taille && !suivant.align) delete modele.styles[cle];
        else modele.styles[cle] = suivant;
    } else if (cle.startsWith('e:')) {
        const [n, k] = cle.slice(2).split('.').map(Number);
        const item = modele.items[n];
        if (!item) return;
        item.styles ||= [];
        item.styles[k] = suivant;
    } else if (cle.startsWith('b:')) {
        const n = Number(cle.slice(2));
        const b = modele.blocs[n];
        if (!b) return;
        b.taille = suivant.taille;
        b.align = suivant.align;
    }
}

export function analyser(code) {
    const lignes = String(code).replace(/\r\n?/g, '\n').split('\n');
    const debut = lignes.findIndex((l) => l.trim());
    const entete = (lignes[debut] || '').trim().match(/^diapo\s+([a-z-]+)$/);
    const d = entete && DISPOSITIONS[entete[1]];
    if (!d) throw new Error(`La première ligne doit être « diapo » suivi d'une mise en page : ${Object.keys(DISPOSITIONS).join(', ')}.`);
    const modele = { preambule: [], disposition: entete[1], champs: {}, items: [], blocs: [], styles: {} };
    const stylesEnAttente = [];
    lignes.slice(debut + 1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne) return;
        const mStyle = ligne.match(/^@style\s+(defaut|c:[a-z-]+|e:\d+\.\d+|b:\d+)\s+(.+)$/);
        if (mStyle) {
            stylesEnAttente.push([mStyle[1], analyserLigneStyle(mStyle[2])]);
            return;
        }
        if (d.blocs) {
            // « ## » sous-titre, « # » titre, « - » puce, « | » ligne de tableau ; tout le reste est un paragraphe
            const b = ligne.match(/^(##|#|-)(?:\s+(.*))?$/);
            if (b) modele.blocs.push({ t: { '##': 'h3', '#': 'h2', '-': 'li' }[b[1]], texte: b[2] || '' });
            else if (RE_ICONE.test(ligne) && !ligne.match(RE_ICONE)[2]) modele.blocs.push({ t: 'icone', texte: ligne.match(RE_ICONE)[1] });
            else if (ligne.startsWith('|')) modele.blocs.push({ t: 'ligne', texte: ligne.replace(/^\|\s*|\s*\|$/g, '') });
            else modele.blocs.push({ t: 'p', texte: ligne.replace(/^\u200b/, '') });
            return;
        }
        if (ligne.startsWith('- ') || ligne === '-') {
            if (!d.item) throw new Error(`Ligne ${debut + n + 2} : cette mise en page n'a pas d'éléments répétés.`);
            const icone = d.icones ? ligne.slice(1).trim().match(RE_ICONE) : null;
            const valeurs = (icone ? icone[2] : ligne.slice(1)).split('|').map((x) => x.trim().replace(/^\u200b/, ''));
            const item = d.item.map((_, k) => valeurs[k] ?? '');
            item.icone = icone ? icone[1] : '';
            item.styles = [];
            modele.items.push(item);
            return;
        }
        const m = ligne.match(/^([a-z-]+)\s*:\s*(.*)$/);
        if (!m || !(d.champs || []).some(([cle]) => cle === m[1])) throw new Error(`Ligne ${debut + n + 2} : champ inconnu pour la mise en page « ${d.nom} ».`);
        modele.champs[m[1]] = m[2];
    });
    for (const [cible, st] of stylesEnAttente) definirStyle(modele, cible, st);
    return modele;
}

export function ecrire(modele) {
    const d = DISPOSITIONS[modele.disposition];
    const lignes = [`diapo ${modele.disposition}`];
    for (const [cle] of d.champs || []) if (propre(modele.champs[cle] ?? '')) lignes.push(`${cle}: ${propre(modele.champs[cle])}`);
    for (const item of d.item ? modele.items : []) lignes.push(`- ${d.icones && RE_NOM_ICONE.test(item.icone || '') ? `[${item.icone}] ` : ''}${d.item.map((_, k) => (k ? propreItem(item[k] ?? '') : proteger(propreItem(item[k] ?? '')))).join(' | ')}`.replace(/(\s\|\s)+$/, '').trimEnd());
    for (const b of d.blocs ? modele.blocs : []) {
        if (b.t === 'icone') { lignes.push(`[${RE_NOM_ICONE.test(b.texte) ? b.texte : ICONE_DEPART}]`); continue; }
        const marque = BLOCS.find(([g]) => g === b.t)[2];
        // Un paragraphe qui commencerait comme un titre, une puce, un tableau ou @style est protégé par une espace sans chasse
        const texte = b.t === 'ligne' ? `${propre(b.texte)} |` : propre(b.texte).replace(/^\u200b+/, '') || '…';
        lignes.push(`${marque}${b.t === 'p' && /^(#|-(\s|$)|\||\[(dsfr|illus|picto):|@style\b)/.test(texte) ? '\u200b' : ''}${texte}`);
    }
    const def = formaterStyle('defaut', modele.styles?.defaut);
    if (def) lignes.push(def);
    for (const [cle] of d.champs || []) {
        const s = formaterStyle(`c:${cle}`, modele.styles?.[`c:${cle}`]);
        if (s) lignes.push(s);
    }
    if (d.item) {
        modele.items.forEach((item, n) => {
            d.item.forEach((_, k) => {
                const s = formaterStyle(`e:${n}.${k}`, item.styles?.[k]);
                if (s) lignes.push(s);
            });
        });
    }
    if (d.blocs) {
        modele.blocs.forEach((b, n) => {
            if (b.t === 'icone') return;
            const s = formaterStyle(`b:${n}`, b);
            if (s) lignes.push(s);
        });
    }
    return lignes.join('\n') + '\n';
}

// Code de départ d'une mise en page
export function codeInitial(disposition) {
    const d = DISPOSITIONS[disposition];
    return ecrire({ disposition, champs: Object.fromEntries((d.champs || []).map(([cle, , defaut]) => [cle, defaut])), items: (d.items || []).map((i) => [...i]), blocs: (d.blocs || []).map(([t, texte]) => ({ t, texte })), styles: {} });
}

export function elements(modele) {
    const d = DISPOSITIONS[modele.disposition];
    const court = (t) => texteSansMarques(enLignes(t)).replace(/\n/g, ' ').slice(0, 60);
    return [
        ...(d.champs || []).map(([cle, nom]) => ({ cle: `c:${cle}`, nom: `${nom} : ${court(modele.champs[cle] ?? '')}` })),
        ...(d.item ? modele.items : []).flatMap((item, n) => d.item.map((nom, k) => ({ cle: `e:${n}.${k}`, nom: `${k ? '— ' : `${n + 1}. `}${court(item[k] ?? '')}` }))),
        ...(d.blocs ? modele.blocs : []).map((b, n) => ({ cle: `b:${n}`, nom: `${BLOCS.find(([g]) => g === b.t)[1]} : ${court(b.t === 'icone' ? b.texte.split(':')[1] || '' : b.texte)}` })),
    ];
}

// Le dessin porte déjà la clé de chaque texte. En édition, chaque texte saisissable reçoit en plus une zone de clic
// invisible couvrant toute sa boîte : un clic entre deux lignes ou au bout d'une ligne courte ouvre aussi sa saisie.
export function reperer(svg) {
    for (const el of svg.querySelectorAll('[data-champ]')) marquer(el, el.getAttribute('data-champ'));
    for (const t of svg.querySelectorAll('text[data-saisie]')) {
        const d = (k) => Number(t.getAttribute(`data-saisie-${k}`));
        const lignes = Math.max(1, t.querySelectorAll('tspan[y]').length);
        const zone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        Object.entries({ x: d('x'), y: d('y'), width: d('l'), height: lignes * d('interligne'), class: 'fusain-touche fusain-touche-texte' }).forEach(([k, v]) => zone.setAttribute(k, String(v)));
        marquer(zone, t.getAttribute('data-champ'));
        t.before(zone);
    }
}

function viser(modele, cle) {
    const [n, k] = cle.slice(2).split('.').map(Number);
    if (cle.startsWith('c:')) return { lire: () => modele.champs[cle.slice(2)] ?? '', ecrire: (v) => { modele.champs[cle.slice(2)] = v; }, existe: (DISPOSITIONS[modele.disposition].champs || []).some(([c]) => c === cle.slice(2)) };
    if (cle.startsWith('e:')) return { n, k, lire: () => modele.items[n][k] ?? '', ecrire: (v) => { modele.items[n][k] = v; }, existe: Boolean(modele.items[n]) && k < (DISPOSITIONS[modele.disposition].item || []).length };
    return { n, lire: () => modele.blocs[n].texte, ecrire: (v) => { modele.blocs[n].texte = v; }, existe: Boolean(modele.blocs[n]) };
}

export function texte(modele, cle) { const v = viser(modele, cle); return v.existe ? enLignes(v.lire()) : null; }
export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (!v.existe) return;
    // Un bloc « icône » ne reçoit qu'un nom d'icône embarquée
    if (cle.startsWith('b:') && modele.blocs[v.n].t === 'icone') { if (RE_NOM_ICONE.test(String(valeur).trim())) v.ecrire(String(valeur).trim()); return; }
    v.ecrire(cle.startsWith('e:') ? propreItem(valeur) : propre(valeur));
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (!v.existe) return;
    if (cle.startsWith('c:')) { v.ecrire(''); definirStyle(modele, cle, { taille: null, align: '' }); }
    else if (cle.startsWith('e:')) { if (modele.items.length > 1) modele.items.splice(v.n, 1); } else if (modele.blocs.length > 1) modele.blocs.splice(v.n, 1);
}

export const peutRelier = (cle) => cle.startsWith('e:') || cle.startsWith('b:');

// La poignée ajoute un élément (ou un bloc de texte) à la suite
export function relier(modele, de, vers) {
    const v = viser(modele, de);
    if (vers || !v.existe) return null;
    if (de.startsWith('b:')) { modele.blocs.splice(v.n + 1, 0, { t: ['h2', 'h3', 'icone'].includes(modele.blocs[v.n].t) ? 'p' : modele.blocs[v.n].t, texte: modele.blocs[v.n].t === 'ligne' ? 'Donnée | Donnée' : 'Nouveau texte' }); return `b:${v.n + 1}`; }
    if (modele.items.length >= ITEMS_MAX) return null;
    const nouvel = DISPOSITIONS[modele.disposition].item.map((nom) => nom.split(' (')[0]);
    nouvel.styles = [];
    modele.items.splice(v.n + 1, 0, nouvel);
    return `e:${v.n + 1}.0`;
}

// Changer de mise en page conserve les textes qui ont leur place dans la nouvelle
function changerDisposition(modele, disposition) {
    const d = DISPOSITIONS[disposition];
    const ancien = DISPOSITIONS[modele.disposition];
    modele.disposition = disposition;
    modele.champs = Object.fromEntries((d.champs || []).map(([cle, , defaut]) => [cle, modele.champs[cle] ?? defaut]));
    modele.items = d.item ? (ancien.item && modele.items.length ? modele.items : d.items).map((i) => Object.assign(d.item.map((_, k) => i[k] ?? ''), { icone: d.icones ? i.icone || '' : '', styles: i.styles || [] })) : [];
    modele.blocs = d.blocs ? (modele.blocs.length ? modele.blocs : d.blocs.map(([t, texte]) => ({ t, texte }))) : [];
}

// Mise en forme depuis le panneau : la sélection du dernier champ de texte utilisé (ou tout le champ, sans sélection)
// est entourée de ses marques (js/texte-riche.js) ; le champ est validé comme une saisie.
let champActif = null;
function entourer(avant, apres) {
    const zone = champActif?.isConnected ? champActif : document.getElementById('fusain-champ-texte') || document.querySelector('#fusain-proprietes textarea');
    if (!zone) { message('Aucun texte choisi', 'Cliquez d\'abord dans un champ de texte du panneau, ou sélectionnez-y un passage.', 'info', 4000); return; }
    const v = zone.value;
    let [a, b] = [zone.selectionStart, zone.selectionEnd];
    if (a === b) [a, b] = [0, v.length];
    // Les espaces en bord de sélection restent hors des marques
    while (a < b && /\s/.test(v[a])) a += 1;
    while (b > a && /\s/.test(v[b - 1])) b -= 1;
    if (a === b) return;
    zone.value = v.slice(0, a) + avant + v.slice(a, b) + apres + v.slice(b);
    zone.dispatchEvent(new Event('change'));
}
function barreMiseEnForme() {
    const garder = (e) => e.preventDefault(); // le champ garde sa sélection
    const outil = (libelle, titre, avant, apres) => bouton(libelle, { titre, onmousedown: garder, onclick: () => entourer(avant, apres) });
    return h('div', { class: 'fusain-mise-en-forme', role: 'group', 'aria-label': 'Mise en forme du texte' },
        h('span', { class: 'fr-label' }, 'Mise en forme', h('span', { class: 'fr-hint-text' }, 'Du passage sélectionné dans un champ, ou de tout le champ.')),
        h('div', { class: 'fusain-actions' },
            outil('Gras', 'Gras : **texte**', '**', '**'),
            outil('Italique', 'Italique : *texte*', '*', '*'),
            outil('Barré', 'Barré : ~~texte~~', '~~', '~~')),
        h('div', { class: 'fusain-ligne' },
            champSelect('Couleur du texte', [['', 'Choisir…'], ...COULEURS_TEXTE.map(([n, , nom]) => [n, nom])], '', (v) => { if (v) entourer('[', `]{${v}}`); }),
            champSelect('Stabilo', [['', 'Choisir…'], ...COULEURS_STABILO.map(([n, , nom]) => [n, nom])], '', (v) => { if (v === 'jaune') entourer('==', '=='); else if (v) entourer('[', `]{stabilo-${v}}`); })));
}

function controlesTypographie(modele, cible, appliquer, intitule = 'Taille et alignement') {
    const st = lireStyle(modele, cible);
    const valeurTaille = st.taille ? String(st.taille) : '';
    const optionsTaille = TAILLES_POLICE.some(([v]) => v === valeurTaille)
        ? TAILLES_POLICE
        : [...TAILLES_POLICE, [valeurTaille, `${valeurTaille} px`]];
    const btnAlign = (code, libelle, titre) => h('button', {
        type: 'button',
        class: 'fr-btn fr-btn--sm fr-btn--tertiary-no-outline',
        title: titre,
        'aria-pressed': String(st.align === code),
        onclick: () => appliquer((m) => definirStyle(m, cible, { align: st.align === code ? '' : code })),
    }, libelle);

    return h('div', { class: 'fusain-typographie' },
        h('div', { class: 'fusain-ligne' },
            champSelect(intitule, optionsTaille, valeurTaille, (val) => appliquer((m) => definirStyle(m, cible, { taille: val ? Number(val) : null }))),
            champTexte('Taille (px)', valeurTaille, (val) => {
                const v = val.trim();
                appliquer((m) => definirStyle(m, cible, { taille: v ? Math.max(8, Math.min(120, Number(v) || 16)) : null }));
            }, { type: 'number', min: 8, max: 120, step: 1, placeholder: 'Auto' })),
        h('div', { class: 'fusain-champ' },
            h('span', { class: 'fr-label' }, 'Alignement du texte'),
            h('div', { class: 'fusain-bascule', role: 'group', 'aria-label': 'Alignement du texte' },
                btnAlign('gauche', 'Gauche', 'Aligner à gauche'),
                btnAlign('centre', 'Centrer', 'Centrer le texte'),
                btnAlign('droite', 'Droite', 'Aligner à droite'),
                btnAlign('justifie', 'Justifier', 'Justifier le texte sur toute la largeur de la colonne'))));
}

const suivreChamp = (e) => { if (e.target.localName === 'textarea') champActif = e.target; };

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const d = DISPOSITIONS[modele.disposition];
    const v = selection ? viser(modele, selection) : {};
    const saisie = (libelle, cle, attrs = {}) => champTexte(libelle, texte(modele, cle), (val) => appliquer((m) => renommer(m, cle, val)), { multiligne: true, rows: 2, ...attrs, ...(cle === selection ? { id: 'fusain-champ-texte' } : {}) });
    const cibleChamp = selection?.startsWith('c:') && v.existe ? selection : 'defaut';
    const nomCibleChamp = cibleChamp === 'defaut'
        ? 'Police par défaut des textes'
        : `Police de « ${(d.champs || []).find(([c]) => `c:${c}` === cibleChamp)?.[1] || cibleChamp} »`;

    const blocs = [h('div', { class: 'fusain-bloc', onfocusin: suivreChamp },
        h('h2', {}, 'Diapositive de texte'),
        champSelect('Mise en page', Object.entries(DISPOSITIONS).map(([id, x]) => [id, x.nom]), modele.disposition, (val) => appliquer((m) => changerDisposition(m, val), () => null)),
        (d.champs || []).map(([cle, nom]) => saisie(nom, `c:${cle}`)),
        controlesTypographie(modele, cibleChamp, appliquer, nomCibleChamp),
        barreMiseEnForme(),
        h('p', { class: 'fusain-aide' }, 'Cliquez sur un texte de la diapositive pour l\'écrire directement à sa place : la mise en forme se voit en direct. Entrée : nouvelle ligne ; Ctrl+B : gras ; Ctrl+I : italique ; Ctrl+Maj+X : barré ; Ctrl+Maj+H : stabilo ; Tab : texte suivant ; Échap : terminer. La barre au-dessus du texte change aussi sa couleur et son stabilo.'),
        h('p', { class: 'fusain-aide' }, 'Dans les champs du panneau : **gras**, *italique*, ~~barré~~, ==stabilo jaune==, [texte]{rouge} pour une couleur, [texte]{stabilo-vert} pour un autre stabilo, [texte]{bleu stabilo-rose gras} pour plusieurs réglages. Une barre oblique inverse écrit le caractère tel quel : \\*.'))];

    if (d.item) {
        const n = selection?.startsWith('e:') && v.existe ? v.n : -1;
        const ajout = () => appliquer((m) => {
            const nouvel = d.item.map((nom) => nom.split(' (')[0]);
            nouvel.styles = [];
            m.items.splice(n < 0 ? m.items.length : n + 1, 0, nouvel);
        }, (m) => `e:${n < 0 ? m.items.length - 1 : n + 1}.0`);
        blocs.push(h('div', { class: 'fusain-bloc', onfocusin: suivreChamp },
            h('h2', {}, n >= 0 ? `Élément ${n + 1} sur ${modele.items.length}` : `Éléments (${modele.items.length})`),
            n >= 0 ? [
                d.item.flatMap((nom, k) => [
                    saisie(nom, `e:${n}.${k}`),
                    controlesTypographie(modele, `e:${n}.${k}`, appliquer, `Police de « ${nom} »`),
                ]),
                d.icones ? h('div', { class: 'fusain-actions' },
                    bouton(modele.items[n].icone ? `Icône : ${modele.items[n].icone.split(':')[1]}…` : 'Ajouter une icône…', { icone: 'layout-grid-line', onclick: () => choisirIcone(modele.items[n].icone || '', (val) => appliquer((m) => { m.items[n].icone = val; })).catch((e) => message('Icônes indisponibles', e.message, 'error')) }),
                    modele.items[n].icone ? bouton('Retirer l\'icône', { icone: 'close-line', onclick: () => appliquer((m) => { m.items[n].icone = ''; }) }) : null) : null,
                actionsListe({
                    monter: () => appliquer(() => {}, (m) => `e:${deplacer(m.items, n, -1)}.${v.k}`),
                    descendre: () => appliquer(() => {}, (m) => `e:${deplacer(m.items, n, 1)}.${v.k}`),
                    supprimer: modele.items.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
                }),
            ] : h('p', { class: 'fusain-aide' }, 'Cliquez sur une colonne ou un élément de la diapositive pour modifier son texte, sa taille de police et son alignement.'),
            modele.items.length < ITEMS_MAX ? h('div', { class: 'fusain-actions' }, bouton('Ajouter un élément', { icone: 'add-line', variante: 'secondary', onclick: ajout })) : null));
    }

    if (d.blocs) {
        const n = selection?.startsWith('b:') && v.existe ? v.n : -1;
        const ajout = (t, defaut) => bouton(BLOCS.find(([g]) => g === t)[1], { icone: 'add-line', onclick: () => appliquer((m) => { m.blocs.splice(n < 0 ? m.blocs.length : n + 1, 0, { t, texte: defaut }); }, (m) => `b:${n < 0 ? m.blocs.length - 1 : n + 1}`) });
        blocs.push(h('div', { class: 'fusain-bloc', onfocusin: suivreChamp },
            h('h2', {}, n >= 0 ? 'Bloc de texte sélectionné' : 'Blocs de texte'),
            n >= 0 ? [
                champSelect('Nature', BLOCS.map(([g, nom]) => [g, nom]), modele.blocs[n].t, (val) => appliquer((m) => { if (val === 'icone') m.blocs[n].texte = ICONE_DEPART; else if (m.blocs[n].t === 'icone') m.blocs[n].texte = 'Nouveau texte'; m.blocs[n].t = val; })),
                modele.blocs[n].t === 'icone'
                    ? h('div', { class: 'fusain-actions' }, bouton(`Icône : ${modele.blocs[n].texte.split(':')[1]}…`, { icone: 'layout-grid-line', variante: 'secondary', onclick: () => choisirIcone(modele.blocs[n].texte, (val) => appliquer((m) => { m.blocs[n].texte = val; })).catch((e) => message('Icônes indisponibles', e.message, 'error')) }))
                    : [
                        saisie(modele.blocs[n].t === 'ligne' ? 'Cellules, séparées par une barre « | »' : 'Texte', `b:${n}`, { rows: 3 }),
                        controlesTypographie(modele, `b:${n}`, appliquer, 'Taille et alignement du bloc'),
                    ],
                actionsListe({
                    monter: () => appliquer(() => {}, (m) => `b:${deplacer(m.blocs, n, -1)}`),
                    descendre: () => appliquer(() => {}, (m) => `b:${deplacer(m.blocs, n, 1)}`),
                    supprimer: modele.blocs.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
                }),
            ] : null,
            h('div', { class: 'fusain-actions' }, ajout('h2', 'Titre'), ajout('h3', 'Sous-titre'), ajout('p', 'Nouveau paragraphe'), ajout('li', 'Nouveau point'), ajout('ligne', 'Colonne 1 | Colonne 2 | Colonne 3'), ajout('icone', ICONE_DEPART)),
            h('p', { class: 'fusain-aide' }, 'Des lignes de tableau qui se suivent forment un tableau ; la première en est l\'en-tête.')));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'diapo', nom: 'Diapositive de texte', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau, lireStyle, definirStyle };

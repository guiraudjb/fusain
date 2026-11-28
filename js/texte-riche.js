// Mise en forme d'un texte de diapositive, dans le code « clé: valeur » : une syntaxe proche de Markdown, lisible
// telle quelle et sans HTML. Logique pure (sans DOM), lue par le dessin (js/diapo.js), la saisie directe (js/app.js)
// et le panneau (js/diagrammes/diapo.js) ; testée sous bun ou node.
//
//   **gras**   *italique*   ~~barré~~   ==surligné (stabilo jaune)==
//   [texte]{rouge}            couleur du texte : nom de la palette ou #rrggbb
//   [texte]{stabilo-vert}     surligneur d'une autre couleur
//   [texte]{bleu stabilo-rose gras italique barre}   plusieurs réglages à la fois
//   \*  \[  \=  …             caractère écrit tel quel
//
// Les marques s'imbriquent (« **gras [rouge]{rouge}** ») et peuvent couvrir plusieurs lignes (<br>). « ** » non fermé
// met en gras jusqu'à la fin (comme avant cette syntaxe) ; « * », « ~~ » et « == » non fermés, ou entourés d'espaces
// (« 5 * 3 », « a == b »), restent du texte.

export const COULEURS_TEXTE = [
    ['bleu', '#000091', 'Bleu France'],
    ['rouge', '#e1000f', 'Rouge Marianne'],
    ['vert', '#18753c', 'Vert'],
    ['orange', '#b34000', 'Orange'],
    ['violet', '#6e445a', 'Violet'],
    ['turquoise', '#009099', 'Turquoise'],
    ['gris', '#666666', 'Gris'],
    ['noir', '#161616', 'Noir'],
    ['blanc', '#ffffff', 'Blanc'],
];
export const COULEURS_STABILO = [
    ['jaune', '#fff200', 'Jaune fluo'],
    ['vert', '#8cf58c', 'Vert fluo'],
    ['rose', '#ff99dd', 'Rose fluo'],
    ['bleu', '#8fdcff', 'Bleu fluo'],
    ['orange', '#ffbf66', 'Orange fluo'],
];
const PAR_NOM_TEXTE = new Map(COULEURS_TEXTE.map(([n, c]) => [n, c]));
const PAR_NOM_STABILO = new Map(COULEURS_STABILO.map(([n, c]) => [n, c]));
const RE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ECHAPPABLES = new Set(['\\', '*', '~', '=', '[', ']', '{', '}']);

export const STYLE_VIDE = Object.freeze({ gras: false, italique: false, barre: false, couleur: '', stabilo: '' });

// « #ABC » → « #aabbcc » ; null si ce n'est pas une couleur hexadécimale
export function hexNormalise(c) {
    const t = String(c ?? '').trim().toLowerCase();
    if (!RE_HEX.test(t)) return null;
    return t.length === 4 ? `#${[...t.slice(1)].map((x) => x + x).join('')}` : t;
}
export const couleurTexte = (v) => PAR_NOM_TEXTE.get(String(v).toLowerCase()) || hexNormalise(v) || '';
export const couleurStabilo = (v) => PAR_NOM_STABILO.get(String(v).toLowerCase()) || hexNormalise(v) || '';
// Nom de la palette d'une couleur (pour écrire « rouge » plutôt que « #e1000f »), sinon la couleur elle-même
const nomTexte = (hex) => COULEURS_TEXTE.find(([, c]) => c === hex)?.[0] || hex;
const nomStabilo = (hex) => COULEURS_STABILO.find(([, c]) => c === hex)?.[0] || hex;

// « {rouge stabilo-vert gras} » → réglages, ou null si un mot n'est pas reconnu (le texte reste alors tel quel)
function lireReglages(t) {
    const r = {};
    const mots = t.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!mots.length) return null;
    for (const m of mots) {
        if (m === 'gras') r.gras = true;
        else if (m === 'italique') r.italique = true;
        else if (m === 'barre' || m === 'barré') r.barre = true;
        else if (m === 'stabilo' || m === 'surligne' || m === 'surligné') r.stabilo = PAR_NOM_STABILO.get('jaune');
        else if (/^(stabilo|surligne|surligné)-/.test(m)) { const c = couleurStabilo(m.replace(/^[^-]+-/, '')); if (!c) return null; r.stabilo = c; }
        else { const c = couleurTexte(m); if (!c) return null; r.couleur = c; }
    }
    return r;
}

const espace = (c) => c === undefined || /\s/.test(c);
const echappe = (s, i) => { let n = 0; for (let k = i - 1; k >= 0 && s[k] === '\\'; k -= 1) n += 1; return n % 2 === 1; };

// Fermeture d'une marque « * », « ~~ » ou « == » : précédée d'un caractère visible ; « * » ne doit pas faire partie de « ** »
function fermeture(s, debut, marque) {
    for (let j = debut; j <= s.length - marque.length; j += 1) {
        if (s[j] === '\\') { j += 1; continue; }
        if (marque === '*' && s.startsWith('**', j)) { j += 1; continue; }
        if (s.startsWith(marque, j) && !espace(s[j - 1]) && j > debut) return j;
    }
    return -1;
}
function fermetureGras(s, debut) {
    for (let j = debut; j < s.length - 1; j += 1) {
        if (s[j] === '\\') { j += 1; continue; }
        // « *ital*** » : dans une suite de trois astérisques ou plus, les deux derniers ferment le gras
        if (s.startsWith('**', j)) { while (s[j + 2] === '*') j += 1; return j; }
    }
    return -1;
}
// « ] » qui ferme le « [ » ouvert en i (crochets imbriqués comptés), suivi de « {réglages} » reconnus
function crochet(s, i) {
    let n = 0;
    for (let j = i; j < s.length; j += 1) {
        if (s[j] === '\\') { j += 1; continue; }
        if (s[j] === '[') n += 1;
        else if (s[j] === ']' && --n === 0) {
            if (s[j + 1] !== '{') return null;
            const fin = s.indexOf('}', j + 2);
            if (fin < 0) return null;
            const reglages = lireReglages(s.slice(j + 2, fin));
            return reglages ? { fin: j, apres: fin + 1, reglages } : null;
        }
    }
    return null;
}

// Texte marqué → morceaux [{ t, gras, italique, barre, couleur, stabilo }] ; « <br> » reste dans le texte des morceaux
export function analyserTexteRiche(texte, base = STYLE_VIDE) {
    const morceaux = [];
    const pousser = (t, st) => {
        if (!t) return;
        const d = morceaux[morceaux.length - 1];
        if (d && memeStyle(d, st)) d.t += t; else morceaux.push({ t, ...st });
    };
    const parcourir = (s, st) => {
        let tampon = '';
        const vider = () => { pousser(tampon, st); tampon = ''; };
        for (let i = 0; i < s.length;) {
            const c = s[i];
            if (c === '\\' && ECHAPPABLES.has(s[i + 1])) { tampon += s[i + 1]; i += 2; continue; }
            if (s.startsWith('**', i)) {
                const j = fermetureGras(s, i + 2);
                vider();
                if (j < 0) { parcourir(s.slice(i + 2), { ...st, gras: true }); return; }
                parcourir(s.slice(i + 2, j), { ...st, gras: true });
                i = j + 2;
                continue;
            }
            const marque = c === '*' ? '*' : s.startsWith('~~', i) ? '~~' : s.startsWith('==', i) ? '==' : '';
            if (marque && !espace(s[i + marque.length])) {
                const j = fermeture(s, i + marque.length, marque);
                if (j > 0) {
                    vider();
                    const suite = marque === '*' ? { italique: true } : marque === '~~' ? { barre: true } : { stabilo: PAR_NOM_STABILO.get('jaune') };
                    parcourir(s.slice(i + marque.length, j), { ...st, ...suite });
                    i = j + marque.length;
                    continue;
                }
            }
            if (c === '[') {
                const k = crochet(s, i);
                if (k) {
                    vider();
                    parcourir(s.slice(i + 1, k.fin), { ...st, ...k.reglages });
                    i = k.apres;
                    continue;
                }
            }
            tampon += c;
            i += 1;
        }
        vider();
    };
    parcourir(String(texte ?? ''), { ...STYLE_VIDE, ...base });
    return morceaux;
}

export const memeStyle = (a, b) => a.gras === b.gras && a.italique === b.italique && a.barre === b.barre && a.couleur === b.couleur && a.stabilo === b.stabilo;
export const texteSansMarques = (texte) => analyserTexteRiche(texte).map((m) => m.t).join('');
export const aDesMarques = (texte) => analyserTexteRiche(texte).some((m) => !memeStyle(m, STYLE_VIDE));

// Échappe ce qui serait lu comme une marque dans un texte écrit tel quel
export const echapperTexte = (t) => String(t).replace(/[\\*[\]{}]|~~|==/g, (m) => [...m].map((c) => `\\${c}`).join(''));

// Morceaux → texte marqué. Seul, un réglage s'écrit par sa marque courte (**gras**, *italique*, ~~barré~~, ==stabilo==) ;
// dès qu'il y a une couleur, un autre stabilo ou gras et italique ensemble, par « [texte]{…} ». Les espaces en bord de
// morceau restent hors des marques (« mot **gras** suite »).
// echapper : false pour une saisie au clavier (« **2027** » tapé reste une marque, comme avant) ; true pour un texte
// qui doit rester tel quel.
export function ecrireTexteRiche(morceaux, { echapper = false } = {}) {
    const jaune = PAR_NOM_STABILO.get('jaune');
    const fusion = [];
    for (const m of morceaux) {
        if (!m.t) continue;
        const d = fusion[fusion.length - 1];
        if (d && memeStyle(d, m)) d.t += m.t; else fusion.push({ ...m });
    }
    return fusion.map((m) => {
        const [, avant, coeur, apres] = m.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
        if (!coeur) return m.t;
        const t = echapper ? echapperTexte(coeur) : coeur;
        const longs = Boolean(m.couleur || (m.stabilo && m.stabilo !== jaune) || (m.gras && m.italique));
        if (!longs) {
            let c = t;
            if (m.stabilo) c = `==${c}==`;
            if (m.barre) c = `~~${c}~~`;
            if (m.italique) c = `*${c}*`;
            if (m.gras) c = `**${c}**`;
            return avant + c + apres;
        }
        const reglages = [m.gras && 'gras', m.italique && 'italique', m.barre && 'barre', m.couleur && nomTexte(m.couleur),
            m.stabilo && (m.stabilo === jaune ? 'stabilo' : `stabilo-${nomStabilo(m.stabilo)}`)].filter(Boolean);
        return `${avant}[${t}]{${reglages.join(' ')}}${apres}`;
    }).join('');
}

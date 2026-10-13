// Sécurité : filtrage du code Mermaid et assainissement du SVG (cahier des charges §7.2 et §7.3)

export const TAILLE_MAX_CODE = 50000;
export const LIENS_MAX = 500;

const CLES_INTERDITES = new Set([
    '__proto__', 'constructor', 'prototype',
    'securityLevel', 'secure', 'startOnLoad', 'maxTextSize', 'maxEdges', 'htmlLabels',
    'themeCSS', 'dompurifyConfig', 'suppressErrorRendering', 'logLevel', 'arrowMarkerAbsolute',
    'fontFamily', 'altFontFamily', 'deterministicIds', 'deterministicIDSeed', 'legacyMathML', 'forceLegacyMathML',
]);
const VALEUR_SURE = /^[\p{L}\p{N} #.,%()_+\-:]{0,100}$/u;

function filtrerConfiguration(valeur, profondeur = 0) {
    if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : undefined;
    if (typeof valeur === 'boolean') return valeur;
    if (typeof valeur === 'string') return VALEUR_SURE.test(valeur) && !/url\s*\(/i.test(valeur) ? valeur : undefined;
    if (Array.isArray(valeur) || valeur === null || typeof valeur !== 'object' || profondeur > 3) return undefined;
    const propre = {};
    for (const cle of Object.keys(valeur)) {
        if (CLES_INTERDITES.has(cle) || !/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(cle)) continue;
        const v = filtrerConfiguration(valeur[cle], profondeur + 1);
        if (v !== undefined) propre[cle] = v;
    }
    return propre;
}

// Les directives acceptent une écriture proche de JSON (apostrophes, clés nues) : elle est ramenée
// à du JSON strict caractère par caractère, sans jamais toucher au contenu des chaînes.
function lireDirective(texte) {
    let json = '';
    let i = 0;
    while (i < texte.length) {
        const c = texte[i];
        if (c === '"' || c === "'") {
            let contenu = '';
            i += 1;
            while (i < texte.length && texte[i] !== c) {
                if (texte[i] === '\\' && i + 1 < texte.length) i += 1;
                contenu += texte[i];
                i += 1;
            }
            i += 1;
            json += JSON.stringify(contenu);
        } else if (/[A-Za-z_]/.test(c)) {
            const mot = texte.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)[0];
            i += mot.length;
            json += ['true', 'false', 'null'].includes(mot) ? mot : JSON.stringify(mot);
        } else {
            json += c;
            i += 1;
        }
    }
    return JSON.parse(json);
}

// Rend un code dont les directives de configuration sont réduites à une liste blanche.
// Le code enregistré n'est pas modifié : le filtrage s'applique au moment du rendu.
export function nettoyerCode(code) {
    let texte = String(code).replace(/\r\n?/g, '\n');
    if (texte.length > TAILLE_MAX_CODE) throw new Error(`Le code dépasse la taille maximale autorisée (${TAILLE_MAX_CODE} caractères).`);

    // Bloc de configuration en tête : seul le titre est conservé
    const tete = texte.match(/^\s*---\n([\s\S]*?)\n---[ \t]*(\n|$)/);
    if (tete) {
        const titre = tete[1].match(/^title:[ \t]*([^\n]*)$/m);
        const valeur = titre ? titre[1].trim().replace(/^["']|["']$/g, '') : '';
        const garde = valeur && VALEUR_SURE.test(valeur) ? `---\ntitle: ${valeur}\n---\n` : '';
        texte = garde + texte.slice(tete[0].length);
    }

    // Formes étendues « @{ img: "…" } » : Mermaid chargerait l'image dès le rendu, avant tout assainissement
    texte = texte.replace(/@\{[^}]*\}/g, (bloc) => bloc.replace(/\b(img|icon)\s*:\s*("[^"]*"|'[^']*'|[^,}\s]+)\s*,?/g, ''));

    // Directives %%{ ... }%%
    return texte.replace(/%%\{([\s\S]*?)\}%%/g, (_, contenu) => {
        const m = contenu.match(/^\s*(init|initialize)\s*:\s*([\s\S]*)$/);
        if (!m) return '';
        try {
            const config = filtrerConfiguration(lireDirective(m[2]));
            return config && Object.keys(config).length ? `%%{init: ${JSON.stringify(config)}}%%` : '';
        } catch {
            return '';
        }
    });
}

// Type de diagramme : premier mot utile du code
const SYNONYMES = { graph: 'flowchart', 'flowchart-elk': 'flowchart', sequenceDiagram: 'sequence', 'stateDiagram-v2': 'stateDiagram', 'classDiagram-v2': 'classDiagram' };

export function typeDiagramme(code) {
    const texte = String(code).replace(/^\s*---\n[\s\S]*?\n---[ \t]*\n?/, '').replace(/%%\{[\s\S]*?\}%%/g, '');
    for (const ligne of texte.split('\n')) {
        const l = ligne.trim();
        if (!l || l.startsWith('%%')) continue;
        const mot = l.match(/^[A-Za-z0-9-]+/)?.[0] || '';
        return SYNONYMES[mot] || mot.replace(/-beta$/, '');
    }
    return '';
}

// ---------- Assainissement du SVG produit par Mermaid ----------

let crochetsPoses = false;

function poserCrochets(DOMPurify) {
    if (crochetsPoses) return;
    crochetsPoses = true;
    DOMPurify.addHook('uponSanitizeAttribute', (noeud, donnees) => {
        const nom = donnees.attrName;
        const valeur = String(donnees.attrValue || '');
        // Aucun lien ni ressource hors du document : seules les ancres internes subsistent
        if ((nom === 'href' || nom === 'xlink:href' || nom === 'src') && !valeur.startsWith('#')) donnees.keepAttr = false;
        if (/url\s*\(\s*['"]?(?!#)/i.test(valeur) || /javascript:/i.test(valeur)) donnees.keepAttr = false;
    });
}

export function assainirSvg(chaineSvg) {
    const DOMPurify = window.DOMPurify;
    poserCrochets(DOMPurify);
    const corps = DOMPurify.sanitize(chaineSvg, {
        USE_PROFILES: { svg: true, svgFilters: true, html: true },
        ADD_TAGS: ['foreignObject'],
        ADD_ATTR: ['dominant-baseline', 'data-id', 'data-look', 'data-et', 'data-node', 'data-edge', 'data-points'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'a', 'img', 'image', 'audio', 'video', 'use'],
        FORBID_ATTR: ['srcset', 'action', 'formaction', 'ping'],
        ALLOW_DATA_ATTR: true,
        RETURN_DOM: true,
    });
    const svg = corps.querySelector('svg');
    if (!svg) throw new Error('Le rendu n\'a produit aucun schéma.');
    for (const style of svg.querySelectorAll('style')) {
        style.textContent = style.textContent
            .replace(/@import[^;]*;?/gi, '')
            .replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, 'none');
    }
    return document.importNode(svg, true);
}

export function nomFichierSur(nom, repli = 'document') {
    const propre = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return propre || repli;
}

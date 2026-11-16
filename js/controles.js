// Contrôles d'aide au débogage du code (logique pure, sans DOM). Ils signalent des écritures que Mermaid accepte mais
// qui trahissent souvent une erreur : lignes orphelines (en rouge) et énoncés découpés sur plusieurs lignes (en jaune).
// Chaque constat : { debut, fin, niveau: 'orpheline' | 'decoupee', message } (lignes numérotées à partir de 1).
import logigramme from './diagrammes/logigramme.js';

const RE_ENTETE = /^\s*(flowchart|graph|swimlane-beta|agentflow-beta)\b/;
const RE_ID_LIEN = /(?:^|\s)([\p{L}\p{N}_]+)@(?=[<ox]?[-=~.])/gu;
const RE_PROPRIETES = /^\s*([\p{L}\p{N}_]+)@\{([^{}]*)\}\s*;?\s*$/u;
const CLES_NOEUD = /(^|,)\s*(shape|icon|img|label|pos|h|w|form|constraint)\s*:/;
const MOTS = /^\s*(subgraph|end|direction|style|classDef|class|linkStyle|click|flow|global|accTitle|accDescr)\b/;

const guillemets = (t) => (t.match(/"/g) || []).length;

export function controlerCode(code) {
    const lignes = String(code ?? '').replace(/\r\n?/g, '\n').split('\n');
    const entete = lignes.findIndex((l) => RE_ENTETE.test(l));
    if (entete < 0) return [];
    const constats = [];

    // Énoncés : un libellé entre guillemets peut continuer sur les lignes suivantes
    const enonces = [];
    for (let i = entete + 1; i < lignes.length; i += 1) {
        const t = lignes[i];
        if (!t.trim() || t.trim().startsWith('%%')) continue;
        let j = i;
        let texte = t;
        while (guillemets(texte) % 2 === 1 && j + 1 < lignes.length) { j += 1; texte += `\n${lignes[j]}`; }
        if (guillemets(texte) % 2 === 1) {
            constats.push({ debut: i + 1, fin: lignes.length, niveau: 'orpheline', message: `Guillemet ouvert ligne ${i + 1} et jamais refermé : tout le code qui suit est lu comme un texte. Ajoutez le guillemet fermant.` });
            break;
        }
        if (j > i) {
            constats.push({ debut: i + 1, fin: j + 1, niveau: 'decoupee', message: `Énoncé découpé sur ${j - i + 1} lignes : le texte entre guillemets continue à la ligne suivante. Mermaid l'accepte (le retour à la ligne apparaît dans le libellé) ; pour garder une déclaration par ligne, écrivez « <br/> » à la place du retour à la ligne.` });
        }
        enonces.push({ debut: i + 1, fin: j + 1, texte });
        i = j;
    }

    // Propriétés de lien qui ne visent aucun lien : Mermaid en fait une boîte portant l'identifiant
    const idsLiens = new Set();
    for (const e of enonces) if (!RE_PROPRIETES.test(e.texte)) for (const m of e.texte.matchAll(RE_ID_LIEN)) idsLiens.add(m[1]);
    for (const e of enonces) {
        const m = e.texte.match(RE_PROPRIETES);
        if (m && !CLES_NOEUD.test(m[2]) && !idsLiens.has(m[1])) {
            constats.push({ debut: e.debut, fin: e.fin, niveau: 'orpheline', message: `« ${m[1]}@{ ${m[2].trim()} } » ne vise aucun lien : aucun lien ne s'appelle « ${m[1]} », et Mermaid dessine à la place une boîte « ${m[1]} ». Supprimez la ligne, ou rétablissez le lien (« A ${m[1]}@--> B »).` });
        }
    }

    // Nœuds reliés à rien : ils flottent seuls sur le schéma (lu seulement si le code est complet)
    let modele = null;
    try { modele = logigramme.analyser(lignes.join('\n')); } catch { /* code incomplet ou hors édition visuelle */ }
    if (modele) {
        const relies = new Set(modele.liens.flatMap((l) => [l.de, l.vers]));
        const groupesRelies = new Set(modele.groupes.filter((g) => relies.has(g.id)).map((g) => g.id));
        for (const n of modele.noeuds) {
            // Un nœud rangé dans un groupe relié (« A --> groupe ») participe au lien du groupe
            if (relies.has(n.id) || (n.groupe && groupesRelies.has(n.groupe))) continue;
            const declaration = enonces.find((e) => !MOTS.test(e.texte) && new RegExp(`^\\s*${n.id}(?![\\p{L}\\p{N}_])`, 'u').test(e.texte));
            if (!declaration) continue;
            const nom = n.texte && n.texte !== n.id ? `« ${n.texte.replace(/\n/g, ' ')} » (${n.id})` : `« ${n.id} »`;
            constats.push({ debut: declaration.debut, fin: declaration.fin, niveau: 'orpheline', message: `${nom} n'est relié à aucun élément : il flotte seul sur le schéma. Reliez-le (« ${n.id} --> autre ») ou supprimez sa déclaration.` });
        }
    }
    return constats.sort((a, b) => a.debut - b.debut);
}

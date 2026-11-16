// Prise en charge de PlantUML (@startuml, @startmindmap, @startwbs, @startgantt) sans bibliothèque externe :
// analyse locale et traduction vers le moteur graphique embarqué de FUSAIN, avec conversion vers l'édition visuelle.

function echapperGuillemets(texte) {
    return String(texte || '').replace(/"/g, '#quot;').trim();
}

export function nettoyerId(brut, defaut = 'n') {
    const propre = String(brut || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!propre) return defaut;
    return /^[0-9]/.test(propre) ? `n_${propre}` : propre;
}

// Découpe le code PlantUML en lignes numérotées (1..N), en retirant les commentaires (' et /' ... '/)
function pretraiter(code) {
    const brutes = String(code ?? '').replace(/\r\n?/g, '\n').split('\n');
    const lignes = [];
    let dansCommentaireBloc = false;
    let dansSkinparamBloc = false;
    let dansNoteBloc = null;
    let debutLigne = 0;
    let finLigne = 0;
    let genre = '';
    let titre = '';

    for (let i = 0; i < brutes.length; i += 1) {
        const num = i + 1;
        let t = brutes[i].trim();
        if (!t) continue;

        if (dansCommentaireBloc) {
            if (t.includes("'/")) dansCommentaireBloc = false;
            continue;
        }
        if (t.startsWith("/'")) {
            if (!t.includes("'/")) dansCommentaireBloc = true;
            continue;
        }
        if (t.startsWith("'")) continue;

        const mDebut = t.match(/^@start(uml|mindmap|wbs|gantt)\b/i);
        if (mDebut && !debutLigne) {
            debutLigne = num;
            genre = mDebut[1].toLowerCase();
            continue;
        }
        const mFin = t.match(/^@end(uml|mindmap|wbs|gantt)\b/i);
        if (mFin && debutLigne) {
            const gFin = mFin[1].toLowerCase();
            if (gFin !== genre) {
                throw new Error(`Ligne ${num} : fermeture « @end${gFin} » ne correspondant pas à « @start${genre} » (ligne ${debutLigne}).`);
            }
            finLigne = num;
            break;
        }

        if (!debutLigne) {
            throw new Error(`Ligne ${num} : un schéma PlantUML doit commencer par « @startuml », « @startmindmap », « @startwbs » ou « @startgantt ».`);
        }

        if (dansSkinparamBloc) {
            if (t.includes('}')) dansSkinparamBloc = false;
            continue;
        }
        if (/^(skinparam|style)\b/i.test(t)) {
            if (t.endsWith('{')) dansSkinparamBloc = true;
            continue;
        }
        if (/^(!theme|!pragma|!include|!includeurl|!define|!definelong|!option|hide\b|scale\b| header\b|footer\b|caption\b|legend\b|end\s*legend)/i.test(t)) {
            continue;
        }
        const mTitre = t.match(/^title\s+(.+)$/i);
        if (mTitre) {
            titre = mTitre[1].replace(/^["']|["']$/g, '').trim();
            continue;
        }

        // Regroupement des notes multilignes : note left / right / over ... end note
        if (dansNoteBloc) {
            if (/^end\s*note\b/i.test(t)) {
                lignes.push({ num: dansNoteBloc.num, texte: `${dansNoteBloc.entete} : ${dansNoteBloc.contenu.join(' - ')}` });
                dansNoteBloc = null;
            } else {
                dansNoteBloc.contenu.push(t);
            }
            continue;
        }
        const mNoteOuv = t.match(/^(note\s+(?:left|right|over)(?:\s+of)?(?:\s+[^:]+)?)$/i);
        if (mNoteOuv) {
            dansNoteBloc = { num, entete: mNoteOuv[1].trim(), contenu: [] };
            continue;
        }

        lignes.push({ num, texte: t, brut: brutes[i] });
    }

    if (!debutLigne) {
        throw new Error('Ligne 1 : en-tête « @startuml » manquant.');
    }
    if (dansNoteBloc) {
        throw new Error(`Ligne ${dansNoteBloc.num} : bloc « note » non fermé (il manque « end note »).`);
    }
    if (!finLigne) {
        throw new Error(`Ligne ${brutes.length} : bloc PlantUML non fermé (ajoutez « @end${genre} » à la fin du code).`);
    }
    return { genre, titre, lignes, debutLigne, finLigne };
}

// ---------- Carte mentale (@startmindmap / @startwbs) ----------

function traduireMindmap(lignes, enteteTitre) {
    const sortie = ['mindmap'];
    let racineVue = false;
    let niveauMax = 1;
    for (const { num, texte } of lignes) {
        const m = texte.match(/^([*+-]+)_?\s+(.+)$/);
        if (!m) {
            throw new Error(`Ligne ${num} : chaque branche d'une carte mentale PlantUML doit commencer par « * », « ** », « *** » (ou « + » / « - ») suivi d'un espace.`);
        }
        const niv = m[1].length;
        const libelle = m[2].replace(/^\[|\]$/g, '').replace(/^:|;$/g, '').trim();
        if (!libelle) throw new Error(`Ligne ${num} : texte de la branche vide.`);
        if (niv === 1) {
            if (racineVue) throw new Error(`Ligne ${num} : une carte mentale ne peut avoir qu'une seule racine de niveau 1 (« * »). Utilisez « ** » pour une sous-branche.`);
            racineVue = true;
            niveauMax = 1;
        } else if (!racineVue) {
            throw new Error(`Ligne ${num} : la première branche doit être de niveau 1 (« * Racine »).`);
        } else if (niv > niveauMax + 1) {
            throw new Error(`Ligne ${num} : saut de niveau hiérarchique (« ${m[1]} » après le niveau ${niveauMax}).`);
        } else {
            niveauMax = niv;
        }
        sortie.push(`${'  '.repeat(niv)}${libelle.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()}`);
    }
    if (!racineVue) throw new Error('Ligne 1 : la carte mentale ne contient aucune branche.');
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Diagramme de Gantt (@startgantt) ----------

function ajouterJours(dateIso, jours) {
    const d = new Date(`${dateIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + jours);
    return d.toISOString().slice(0, 10);
}

function traduireGantt(lignes, enteteTitre) {
    let debutProjet = '2026-01-05';
    const sortie = ['gantt', '    dateFormat YYYY-MM-DD'];
    const taches = new Map();
    const ordre = [];
    let compteur = 0;

    const obtenirTache = (nomBrut, aliasBrut) => {
        const nom = nomBrut.trim();
        const cle = (aliasBrut || nom).trim();
        let t = taches.get(cle) || [...taches.values()].find((x) => x.nom === nom);
        if (!t) {
            compteur += 1;
            const id = nettoyerId(aliasBrut || `t${compteur}`, `t${compteur}`);
            t = { id, nom, alias: cle, debut: '', apres: '', duree: '5d', jalon: false, etat: '', section: '' };
            taches.set(cle, t);
            if (aliasBrut) taches.set(nom, t);
            ordre.push(t);
        }
        return t;
    };

    let sectionCourante = '';
    for (const { num, texte } of lignes) {
        let m = texte.match(/^Project\s+starts\s+(?:the\s+)?(\d{4}-\d{2}-\d{2})$/i);
        if (m) { debutProjet = m[1]; continue; }

        m = texte.match(/^--\s*(.+?)\s*--$/);
        if (m) { sectionCourante = m[1].trim(); continue; }

        m = texte.match(/^\[([^\]]+)\](?:\s+as\s+\[([^\]]+)\])?\s+(?:requires|lasts)\s+(\d+)\s*(day|days|week|weeks|d|w)\b/i);
        if (m) {
            const t = obtenirTache(m[1], m[2]);
            if (sectionCourante && !t.section) t.section = sectionCourante;
            const n = Number(m[3]);
            const u = /^w/i.test(m[4]) ? 'w' : 'd';
            t.duree = `${n}${u}`;
            continue;
        }

        m = texte.match(/^\[([^\]]+)\](?:\s+as\s+\[([^\]]+)\])?\s+happens\s+(?:at|on)\s+(\d{4}-\d{2}-\d{2}|\[[^\]]+\]'s\s+(?:end|start))$/i);
        if (m) {
            const t = obtenirTache(m[1], m[2]);
            if (sectionCourante && !t.section) t.section = sectionCourante;
            t.jalon = true;
            t.duree = '0d';
            const cible = m[3];
            if (/^\d{4}-\d{2}-\d{2}$/.test(cible)) t.debut = cible;
            else {
                const ref = obtenirTache(cible.match(/^\[([^\]]+)\]/)[1]);
                t.apres = ref.id;
            }
            continue;
        }

        m = texte.match(/^\[([^\]]+)\]\s+starts\s+(?:at\s+)?(\d{4}-\d{2}-\d{2}|\[[^\]]+\]'s\s+(?:end|start))$/i);
        if (m) {
            const t = obtenirTache(m[1]);
            if (sectionCourante && !t.section) t.section = sectionCourante;
            const cible = m[2];
            if (/^\d{4}-\d{2}-\d{2}$/.test(cible)) t.debut = cible;
            else {
                const ref = obtenirTache(cible.match(/^\[([^\]]+)\]/)[1]);
                t.apres = ref.id;
            }
            continue;
        }

        m = texte.match(/^\[([^\]]+)\]\s*-+>\s*\[([^\]]+)\]$/);
        if (m) {
            const de = obtenirTache(m[1]);
            const vers = obtenirTache(m[2]);
            if (sectionCourante && !vers.section) vers.section = sectionCourante;
            vers.apres = de.id;
            continue;
        }

        m = texte.match(/^\[([^\]]+)\]\s+is\s+(\d+)\s*%\s*completed$/i);
        if (m) {
            const t = obtenirTache(m[1]);
            const pct = Number(m[2]);
            t.etat = pct >= 100 ? 'done' : pct > 0 ? 'active' : '';
            continue;
        }

        if (/^(saturday|sunday|printscale|language|today|closed)\b/i.test(texte)) continue;
        throw new Error(`Ligne ${num} : instruction Gantt PlantUML non reconnue (« ${texte} »).`);
    }

    if (!ordre.length) throw new Error('Ligne 1 : le diagramme de Gantt ne contient aucune tâche.');
    let derniereSection = null;
    let curseurDate = debutProjet;
    for (const t of ordre) {
        const sec = t.section || 'Planning';
        if (sec !== derniereSection) {
            sortie.push(`    section ${sec.replace(/:/g, ' -')}`);
            derniereSection = sec;
        }
        const parties = [];
        if (t.jalon) parties.push('milestone');
        else if (t.etat) parties.push(t.etat);
        parties.push(t.id);
        if (t.apres) parties.push(`after ${t.apres}`);
        else if (t.debut) { parties.push(t.debut); curseurDate = t.debut; }
        else { parties.push(curseurDate); }
        parties.push(t.duree);
        sortie.push(`    ${t.nom.replace(/:/g, ' -')} :${parties.join(', ')}`);
        if (!t.apres && !t.jalon) {
            const nb = parseInt(t.duree, 10) || 5;
            curseurDate = ajouterJours(curseurDate, t.duree.endsWith('w') ? nb * 7 : nb);
        }
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- C4-PlantUML ----------

function traduireC4(lignes, enteteTitre) {
    const textes = lignes.map((l) => l.texte);
    let typeC4 = 'C4Context';
    if (textes.some((t) => /^(Deployment_Node|Node|Node_L|Node_R)\s*\(/.test(t))) typeC4 = 'C4Deployment';
    else if (textes.some((t) => /^RelIndex\s*\(/.test(t))) typeC4 = 'C4Dynamic';
    else if (textes.some((t) => /^Component(Db|Queue|_Ext)?\s*\(/.test(t))) typeC4 = 'C4Component';
    else if (textes.some((t) => /^Container(Db|Queue|_Ext)?\s*\(/.test(t))) typeC4 = 'C4Container';

    const sortie = [typeC4];
    let niveau = 1;
    for (const { num, texte } of lignes) {
        if (/^(LAYOUT_|SHOW_|HIDE_|SET_|UpdateElementStyle|UpdateRelStyle)/i.test(texte)) continue;
        if (texte === '}') {
            niveau = Math.max(1, niveau - 1);
            sortie.push(`${'    '.repeat(niveau)}}`);
            continue;
        }
        let ligne = texte
            .replace(/^Node(_L|_R)?\s*\(/, 'Deployment_Node(')
            .replace(/^Rel_(U|Up|D|Down|L|Left|R|Right|Neighbor|Back)\s*\(/, 'Rel(');
        if (/^(Person|System|Container|Component|Deployment_Node|Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary|Rel|BiRel|RelIndex)/.test(ligne)) {
            sortie.push(`${'    '.repeat(niveau)}${ligne}`);
            if (ligne.endsWith('{')) niveau += 1;
            continue;
        }
        throw new Error(`Ligne ${num} : macro C4-PlantUML non reconnue (« ${texte} »).`);
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Diagramme de séquence (@startuml) ----------

export function extraireParticipantSequence(texte) {
    // Supporte : actor "Nom long" as id   OU   actor id as "Nom long"   OU   actor "Nom"   OU   actor id
    const m = texte.match(/^(actor|participant|boundary|control|entity|database|collections|queue)\s+(.+?)(?:\s+#[0-9A-Za-z]+)?$/i);
    if (!m) return null;
    const role = m[1].toLowerCase() === 'actor' ? 'actor' : 'participant';
    const reste = m[2].trim().replace(/\s+order\s+\d+$/i, '');
    const mAs1 = reste.match(/^"([^"]+)"\s+as\s+([A-Za-z0-9_.-]+)$/i);
    if (mAs1) return { role, id: nettoyerId(mAs1[2]), libelle: mAs1[1] };
    const mAs2 = reste.match(/^([A-Za-z0-9_.-]+)\s+as\s+"?([^"]+)"?$/i);
    if (mAs2) return { role, id: nettoyerId(mAs2[1]), libelle: mAs2[2] };
    const mSeulG = reste.match(/^"([^"]+)"$/);
    if (mSeulG) return { role, id: nettoyerId(mSeulG[1]), libelle: mSeulG[1] };
    const mSeul = reste.match(/^([A-Za-z0-9_.-]+)$/);
    if (mSeul) return { role, id: nettoyerId(mSeul[1]), libelle: mSeul[1] };
    return null;
}

function traduireSequence(lignes, enteteTitre) {
    const sortie = ['sequenceDiagram'];
    const aliasMap = new Map();
    const participants = [];
    const pileBlocs = [];
    const pileActivations = [];
    let niveau = 1;

    const resoudre = (nomBrut) => {
        const propre = nomBrut.trim().replace(/^"|"$/g, '');
        if (aliasMap.has(propre)) return aliasMap.get(propre);
        const id = nettoyerId(propre);
        aliasMap.set(propre, id);
        if (!participants.includes(id)) participants.push(id);
        return id;
    };

    for (const { num, texte } of lignes) {
        if (/^autonumber\b/i.test(texte)) {
            sortie.push(`${'    '.repeat(niveau)}autonumber`);
            continue;
        }
        const p = extraireParticipantSequence(texte);
        if (p) {
            aliasMap.set(p.id, p.id);
            aliasMap.set(p.libelle, p.id);
            if (!participants.includes(p.id)) participants.push(p.id);
            const decl = p.libelle && p.libelle !== p.id ? `${p.role} ${p.id} as ${p.libelle.replace(/:/g, ' -')}` : `${p.role} ${p.id}`;
            sortie.push(`${'    '.repeat(niveau)}${decl}`);
            continue;
        }

        const mDiv = texte.match(/^==\s*(.+?)\s*==$/);
        if (mDiv) {
            const p1 = participants[0] || 'A';
            const p2 = participants[participants.length - 1] || p1;
            sortie.push(`${'    '.repeat(niveau)}Note over ${p1}${p2 !== p1 ? `,${p2}` : ''}: ${mDiv[1].replace(/:/g, ' -')}`);
            continue;
        }

        const mAct = texte.match(/^(activate|deactivate)\s+("[^"]+"|[^\s#]+)(?:\s+#\w+)?$/i);
        if (mAct) {
            const op = mAct[1].toLowerCase();
            const cible = resoudre(mAct[2]);
            sortie.push(`${'    '.repeat(niveau)}${op} ${cible}`);
            continue;
        }

        const mRet = texte.match(/^return\s*(.*)$/i);
        if (mRet) {
            const dernier = pileActivations.pop();
            if (dernier) {
                sortie.push(`${'    '.repeat(niveau)}${dernier.vers}-->>${dernier.de}: ${mRet[1].trim() || 'retour'}`);
                sortie.push(`${'    '.repeat(niveau)}deactivate ${dernier.vers}`);
            }
            continue;
        }

        const mBloc = texte.match(/^(alt|opt|loop|par|break|critical|group)\b\s*(.*)$/i);
        if (mBloc) {
            const mot = mBloc[1].toLowerCase();
            const lib = (mBloc[2] || mot).trim();
            const kw = mot === 'group' ? 'opt' : mot;
            pileBlocs.push({ kw, num });
            sortie.push(`${'    '.repeat(niveau)}${kw} ${lib}`);
            niveau += 1;
            continue;
        }
        const mElse = texte.match(/^else\b\s*(.*)$/i);
        if (mElse) {
            if (!pileBlocs.length) throw new Error(`Ligne ${num} : « else » sans bloc « alt » ou « par » ouvert.`);
            const sommet = pileBlocs[pileBlocs.length - 1];
            const kwElse = sommet.kw === 'par' ? 'and' : 'else';
            sortie.push(`${'    '.repeat(Math.max(1, niveau - 1))}${kwElse} ${mElse[1].trim()}`);
            continue;
        }
        if (/^end$/i.test(texte)) {
            if (!pileBlocs.length) throw new Error(`Ligne ${num} : « end » ferme un bloc qui n'a pas été ouvert.`);
            pileBlocs.pop();
            niveau = Math.max(1, niveau - 1);
            sortie.push(`${'    '.repeat(niveau)}end`);
            continue;
        }

        const mNote = texte.match(/^note\s+(left|right|over)(?:\s+of)?\s+([^:]+?)\s*:\s*(.+)$/i);
        if (mNote) {
            const pos = mNote[1].toLowerCase();
            const cibles = mNote[2].split(',').map((c) => resoudre(c)).join(',');
            const loc = pos === 'over' ? `over ${cibles}` : `${pos} of ${cibles}`;
            sortie.push(`${'    '.repeat(niveau)}Note ${loc}: ${mNote[3].trim()}`);
            continue;
        }

        // Message : A -> B : texte  (ou <--, -->, ->>, -->>, ->x, avec ++ / -- optionnels)
        const mMsg = texte.match(/^("[^"]+"|[^\s\->:<]+)\s*(<--|<--|<-|-->>|->>|-->|->x|->|--\\|-\/|\\--|\/--)\s*(\+\+|--)?\s*("[^"]+"|[^\s\->:<]+)\s*(\+\+|--)?\s*(?::\s*(.*))?$/);
        if (mMsg) {
            let de = resoudre(mMsg[1]);
            let vers = resoudre(mMsg[4]);
            const fl = mMsg[2];
            const mod = mMsg[3] || mMsg[5] || '';
            const msg = (mMsg[6] || '').trim();
            if (fl.startsWith('<')) {
                [de, vers] = [vers, de];
            }
            let op = '->>';
            if (fl.includes('--')) op = '-->>';
            else if (fl.endsWith('x')) op = '-x';
            sortie.push(`${'    '.repeat(niveau)}${de}${op}${vers}: ${msg}`);
            if (mod === '++') {
                sortie.push(`${'    '.repeat(niveau)}activate ${vers}`);
                pileActivations.push({ de, vers });
            } else if (mod === '--') {
                sortie.push(`${'    '.repeat(niveau)}deactivate ${de}`);
            }
            continue;
        }

        throw new Error(`Ligne ${num} : instruction de séquence PlantUML non reconnue (« ${texte} »).`);
    }

    if (pileBlocs.length) {
        const nonFerme = pileBlocs[pileBlocs.length - 1];
        throw new Error(`Ligne ${nonFerme.num} : bloc « ${nonFerme.kw} » non fermé (il manque « end »).`);
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Diagramme de classes (@startuml) ----------

function traduireClasses(lignes, enteteTitre) {
    const sortie = ['classDiagram'];
    const aliasMap = new Map();
    let dansClasse = null;

    const resoudre = (nomBrut) => {
        const propre = nomBrut.trim().replace(/^"|"$/g, '');
        if (aliasMap.has(propre)) return aliasMap.get(propre);
        const id = nettoyerId(propre);
        aliasMap.set(propre, id);
        return id;
    };

    for (const { num, texte } of lignes) {
        if (dansClasse) {
            if (texte === '}') {
                sortie.push('    }');
                dansClasse = null;
                continue;
            }
            if (/^(--|\.\.|==).*$/.test(texte)) continue;
            sortie.push(`        ${texte}`);
            continue;
        }

        if (/^(package|namespace|together)\b/i.test(texte) || texte === '}') continue;

        const mCls = texte.match(/^(abstract\s+class|abstract|interface|enum|class)\s+(?:"([^"]+)"\s+as\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+))(?:\s*<<([^>]+)>>)?\s*(\{)?$/i);
        if (mCls) {
            const genre = mCls[1].toLowerCase();
            const libelle = mCls[2] || '';
            const id = nettoyerId(mCls[3] || mCls[4]);
            const stereo = mCls[5] || (genre.startsWith('interface') ? 'interface' : genre.startsWith('enum') ? 'enumeration' : genre.startsWith('abstract') ? 'abstract' : '');
            if (libelle) aliasMap.set(libelle, id);
            aliasMap.set(id, id);
            if (mCls[6]) {
                sortie.push(`    class ${id} {`);
                if (stereo) sortie.push(`        <<${stereo}>>`);
                dansClasse = { id, num };
            } else if (stereo) {
                sortie.push(`    class ${id} {\n        <<${stereo}>>\n    }`);
            } else {
                sortie.push(`    class ${id}`);
            }
            continue;
        }

        // Relation de classes : A "1" *-- "0..*" B : libellé
        const mRel = texte.match(/^("[^"]+"|[A-Za-z0-9_]+)(?:\s+"([^"]+)")?\s*(<\|--|--\|>|\*--|--\*|o--|--o|<\|\.\.|\.\.\|>|<--|\.\.>|<--|-->|--|\.\.)\s*(?:"([^"]+)"\s+)?("[^"]+"|[A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/);
        if (mRel) {
            const a = resoudre(mRel[1]);
            const cardA = mRel[2] ? ` "${mRel[2]}"` : '';
            const op = mRel[3];
            const cardB = mRel[4] ? ` "${mRel[4]}"` : '';
            const b = resoudre(mRel[5]);
            const lib = mRel[6] ? ` : ${mRel[6].replace(/^<|>$/g, '').trim()}` : '';
            sortie.push(`    ${a}${cardA} ${op}${cardB} ${b}${lib}`);
            continue;
        }

        // Membre en ligne : Classe : +attribut
        const mMembre = texte.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
        if (mMembre) {
            sortie.push(`    ${resoudre(mMembre[1])} : ${mMembre[2].trim()}`);
            continue;
        }

        throw new Error(`Ligne ${num} : instruction de diagramme de classes PlantUML non reconnue (« ${texte} »).`);
    }

    if (dansClasse) {
        throw new Error(`Ligne ${dansClasse.num} : définition de la classe « ${dansClasse.id} » non fermée (il manque « } »).`);
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Diagramme d'états (@startuml) ----------

function traduireEtats(lignes, enteteTitre) {
    const sortie = ['stateDiagram-v2'];
    let niveau = 1;
    const pile = [];

    for (const { num, texte } of lignes) {
        if (texte === '}') {
            if (!pile.length) throw new Error(`Ligne ${num} : « } » ferme un état qui n'a pas été ouvert.`);
            pile.pop();
            niveau = Math.max(1, niveau - 1);
            sortie.push(`${'    '.repeat(niveau)}}`);
            continue;
        }

        const mEtat = texte.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z0-9_]+)(?:\s*<<[^>]+>>)?\s*(\{)?$/i);
        if (mEtat) {
            const id = nettoyerId(mEtat[2]);
            sortie.push(`${'    '.repeat(niveau)}state "${echapperGuillemets(mEtat[1])}" as ${id}${mEtat[3] ? ' {' : ''}`);
            if (mEtat[3]) { pile.push({ id, num }); niveau += 1; }
            continue;
        }

        const mEtatSimple = texte.match(/^state\s+([A-Za-z0-9_]+)\s*\{$/i);
        if (mEtatSimple) {
            const id = nettoyerId(mEtatSimple[1]);
            sortie.push(`${'    '.repeat(niveau)}state ${id} {`);
            pile.push({ id, num });
            niveau += 1;
            continue;
        }

        const mTrans = texte.match(/^(\[\*\]|[A-Za-z0-9_]+)\s*-[A-Za-z]*->\s*(\[\*\]|[A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/);
        if (mTrans) {
            const de = mTrans[1] === '[*]' ? '[*]' : nettoyerId(mTrans[1]);
            const vers = mTrans[2] === '[*]' ? '[*]' : nettoyerId(mTrans[2]);
            const lib = mTrans[3] ? ` : ${mTrans[3].trim()}` : '';
            sortie.push(`${'    '.repeat(niveau)}${de} --> ${vers}${lib}`);
            continue;
        }

        const mDesc = texte.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
        if (mDesc && !/^note\b/i.test(texte)) {
            sortie.push(`${'    '.repeat(niveau)}${nettoyerId(mDesc[1])} : ${mDesc[2].trim()}`);
            continue;
        }

        const mNote = texte.match(/^note\s+(left|right)\s+of\s+([A-Za-z0-9_]+)\s*:\s*(.+)$/i);
        if (mNote) {
            sortie.push(`${'    '.repeat(niveau)}note ${mNote[1].toLowerCase()} of ${nettoyerId(mNote[2])} : ${mNote[3].trim()}`);
            continue;
        }

        throw new Error(`Ligne ${num} : instruction d'états PlantUML non reconnue (« ${texte} »).`);
    }

    if (pile.length) {
        const ouvert = pile[pile.length - 1];
        throw new Error(`Ligne ${ouvert.num} : état composite « ${ouvert.id} » non fermé (il manque « } »).`);
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Entités-relations (@startuml) ----------

function traduireEntites(lignes, enteteTitre) {
    const sortie = ['erDiagram'];
    const aliasMap = new Map();
    let dansEntite = null;

    const resoudre = (nomBrut) => {
        const propre = nomBrut.trim().replace(/^"|"$/g, '');
        if (aliasMap.has(propre)) return aliasMap.get(propre);
        const id = nettoyerId(propre).toUpperCase();
        aliasMap.set(propre, id);
        return id;
    };

    for (const { num, texte } of lignes) {
        if (dansEntite) {
            if (texte === '}') {
                sortie.push('    }');
                dansEntite = null;
                continue;
            }
            if (/^(--|==|\.\.)/.test(texte)) continue;
            const propre = texte.replace(/^\*\s*/, '').replace(/<<[^>]+>>/g, '').trim();
            const mChamp = propre.match(/^([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)(.*)$/);
            if (mChamp) {
                const cle = /PK/i.test(texte) ? ' PK' : /FK/i.test(texte) ? ' FK' : '';
                sortie.push(`        ${mChamp[2]} ${mChamp[1]}${cle}`);
            } else {
                const mots = propre.split(/\s+/);
                if (mots.length >= 2) sortie.push(`        ${mots[0]} ${mots[1]}`);
                else if (mots[0]) sortie.push(`        string ${mots[0]}`);
            }
            continue;
        }

        const mEnt = texte.match(/^entity\s+(?:"([^"]+)"\s+as\s+([A-Za-z0-9_]+)|"([^"]+)"|([A-Za-z0-9_]+))\s*(\{)?$/i);
        if (mEnt) {
            const nom = mEnt[1] || mEnt[3] || mEnt[4];
            const id = nettoyerId(mEnt[2] || nom).toUpperCase();
            aliasMap.set(nom, id);
            aliasMap.set(id, id);
            if (mEnt[5]) {
                sortie.push(`    ${id} {`);
                dansEntite = { id, num };
            } else {
                sortie.push(`    ${id}`);
            }
            continue;
        }

        const mRel = texte.match(/^("[^"]+"|[A-Za-z0-9_]+)\s*([|o}{]{1,2}(?:--|\.\.)[|o}{]{1,2})\s*("[^"]+"|[A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/);
        if (mRel) {
            const a = resoudre(mRel[1]);
            const op = mRel[2];
            const b = resoudre(mRel[3]);
            const lib = (mRel[4] || '').replace(/^"|"$/g, '').trim();
            sortie.push(`    ${a} ${op} ${b} : "${echapperGuillemets(lib)}"`);
            continue;
        }

        throw new Error(`Ligne ${num} : instruction entités-relations PlantUML non reconnue (« ${texte} »).`);
    }

    if (dansEntite) {
        throw new Error(`Ligne ${dansEntite.num} : entité « ${dansEntite.id} » non fermée (il manque « } »).`);
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Diagramme d'activité (@startuml start / :Action; / if / stop) ----------

function traduireActivite(lignes, enteteTitre) {
    const sortie = ['flowchart TD'];
    let compteur = 0;
    let courants = []; // [{ id, etiquette }]
    const pileIf = [];
    const pileFork = [];
    let niveau = 1;

    const nouvelId = (prefixe = 'a') => {
        compteur += 1;
        return `${prefixe}${compteur}`;
    };

    const relierVers = (cibleId) => {
        for (const src of courants) {
            if (src.etiquette) sortie.push(`${'    '.repeat(niveau)}${src.id} -->|${src.etiquette}| ${cibleId}`);
            else sortie.push(`${'    '.repeat(niveau)}${src.id} --> ${cibleId}`);
        }
        courants = [{ id: cibleId, etiquette: '' }];
    };

    for (const { num, texte } of lignes) {
        if (/^start$/i.test(texte)) {
            const id = nouvelId('debut');
            sortie.push(`${'    '.repeat(niveau)}${id}(["Début"])`);
            courants = [{ id, etiquette: '' }];
            continue;
        }
        if (/^(stop|end)$/i.test(texte)) {
            const id = nouvelId('fin');
            sortie.push(`${'    '.repeat(niveau)}${id}(["Fin"])`);
            relierVers(id);
            courants = [];
            continue;
        }

        const mPart = texte.match(/^partition\s+"?([^"{]+)"?\s*\{$/i);
        if (mPart) {
            const id = nouvelId('grp');
            sortie.push(`${'    '.repeat(niveau)}subgraph ${id} ["${echapperGuillemets(mPart[1])}"]`);
            niveau += 1;
            continue;
        }
        if (texte === '}') {
            niveau = Math.max(1, niveau - 1);
            sortie.push(`${'    '.repeat(niveau)}end`);
            continue;
        }

        const mAct = texte.match(/^:(.+);$/);
        if (mAct) {
            const id = nouvelId('etape');
            sortie.push(`${'    '.repeat(niveau)}${id}["${echapperGuillemets(mAct[1])}"]`);
            relierVers(id);
            continue;
        }

        const mIf = texte.match(/^if\s*\(([^)]+)\)\s*then(?:\s*\(([^)]*)\))?$/i);
        if (mIf) {
            const id = nouvelId('choix');
            sortie.push(`${'    '.repeat(niveau)}${id}{"${echapperGuillemets(mIf[1])}"}`);
            relierVers(id);
            const oui = (mIf[2] || 'oui').trim();
            pileIf.push({ id, fins: [], num });
            courants = [{ id, etiquette: oui }];
            continue;
        }

        const mElse = texte.match(/^else(?:\s*\(([^)]*)\))?$/i);
        if (mElse) {
            if (!pileIf.length) throw new Error(`Ligne ${num} : « else » sans « if » correspondant.`);
            const sommet = pileIf[pileIf.length - 1];
            sommet.fins.push(...courants);
            courants = [{ id: sommet.id, etiquette: (mElse[1] || 'non').trim() }];
            continue;
        }

        if (/^endif$/i.test(texte)) {
            if (!pileIf.length) throw new Error(`Ligne ${num} : « endif » sans « if » ouvert.`);
            const sommet = pileIf.pop();
            courants = [...sommet.fins, ...courants];
            continue;
        }

        if (/^fork$/i.test(texte)) {
            const entrees = [...courants];
            pileFork.push({ entrees, sorties: [], num });
            continue;
        }
        if (/^fork\s+again$/i.test(texte)) {
            if (!pileFork.length) throw new Error(`Ligne ${num} : « fork again » sans « fork » ouvert.`);
            const sommet = pileFork[pileFork.length - 1];
            sommet.sorties.push(...courants);
            courants = [...sommet.entrees];
            continue;
        }
        if (/^end\s+fork$/i.test(texte)) {
            if (!pileFork.length) throw new Error(`Ligne ${num} : « end fork » sans « fork » ouvert.`);
            const sommet = pileFork.pop();
            courants = [...sommet.sorties, ...courants];
            continue;
        }

        throw new Error(`Ligne ${num} : instruction d'activité PlantUML non reconnue (« ${texte} »).`);
    }

    if (pileIf.length) throw new Error(`Ligne ${pileIf[pileIf.length - 1].num} : condition « if » non fermée (il manque « endif »).`);
    if (pileFork.length) throw new Error(`Ligne ${pileFork[pileFork.length - 1].num} : bloc « fork » non fermé (il manque « end fork »).`);
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Composants, déploiement et cas d'utilisation (@startuml) ----------

function traduireComposantsOuUsecase(lignes, enteteTitre) {
    let sens = 'TD';
    const textes = lignes.map((l) => l.texte);
    if (textes.some((t) => /^left\s+to\s+right\s+direction$/i.test(t) || /^\([^)]+\)/.test(t) || /^usecase\b/i.test(t))) {
        sens = 'LR';
    }
    const sortie = [`flowchart ${sens}`];
    const aliasMap = new Map();
    const declares = new Set();
    let niveau = 1;
    let compteurGrp = 0;

    const declarerNoeud = (id, libelle, forme = 'rect') => {
        if (declares.has(id)) return id;
        declares.add(id);
        const txt = echapperGuillemets(libelle);
        let expr = `${id}["${txt}"]`;
        if (forme === 'usecase' || forme === 'cloud') expr = `${id}(["${txt}"])`;
        else if (forme === 'database') expr = `${id}[("${txt}")]`;
        else if (forme === 'component') expr = `${id}[["${txt}"]]`;
        else if (forme === 'actor') expr = `${id}(["Acteur : ${txt}"])`;
        sortie.push(`${'    '.repeat(niveau)}${expr}`);
        return id;
    };

    const resoudreTerme = (termeBrut) => {
        const t = termeBrut.trim();
        const mComp = t.match(/^\[([^\]]+)\]$/);
        if (mComp) {
            const nom = mComp[1].trim();
            const id = aliasMap.get(nom) || nettoyerId(nom);
            aliasMap.set(nom, id);
            return declarerNoeud(id, nom, 'component');
        }
        const mUc = t.match(/^\(([^)]+)\)$/);
        if (mUc) {
            const nom = mUc[1].trim();
            const id = aliasMap.get(nom) || nettoyerId(nom);
            aliasMap.set(nom, id);
            return declarerNoeud(id, nom, 'usecase');
        }
        const mAct = t.match(/^:([^:]+):$/);
        if (mAct) {
            const nom = mAct[1].trim();
            const id = aliasMap.get(nom) || nettoyerId(nom);
            aliasMap.set(nom, id);
            return declarerNoeud(id, nom, 'actor');
        }
        const propre = t.replace(/^"|"$/g, '');
        if (aliasMap.has(propre)) return aliasMap.get(propre);
        const id = nettoyerId(propre);
        aliasMap.set(propre, id);
        return declarerNoeud(id, propre, 'rect');
    };

    for (const { num, texte } of lignes) {
        if (/^(left\s+to\s+right\s+direction|top\s+to\s+bottom\s+direction)$/i.test(texte)) continue;

        if (texte === '}') {
            niveau = Math.max(1, niveau - 1);
            sortie.push(`${'    '.repeat(niveau)}end`);
            continue;
        }

        // Conteneur ouvrant : package / node / cloud / database / rectangle / folder / frame "Nom" as id {
        const mGrp = texte.match(/^(package|node|cloud|database|rectangle|folder|frame|storage|artifact)\s+(?:"([^"]+)"\s+as\s+([A-Za-z0-9_]+)|"([^"]+)"|([A-Za-z0-9_]+))(?:\s*<<[^>]+>>)?\s*\{$/i);
        if (mGrp) {
            compteurGrp += 1;
            const nom = mGrp[2] || mGrp[4] || mGrp[5];
            const id = nettoyerId(mGrp[3] || nom, `grp_${compteurGrp}`);
            aliasMap.set(nom, id);
            sortie.push(`${'    '.repeat(niveau)}subgraph ${id} ["${echapperGuillemets(nom)}"]`);
            niveau += 1;
            continue;
        }

        // Déclaration d'élément : actor / usecase / component / database / node / cloud / interface / rectangle ...
        const mDecl = texte.match(/^(actor|usecase|component|database|node|cloud|interface|rectangle|artifact|storage|queue|collections)\s+(?:"([^"]+)"|\(([^)]+)\)|\[([^\]]+)\]|:([^:]+):|([A-Za-z0-9_]+))(?:\s+as\s+([A-Za-z0-9_]+))?(?:\s*<<[^>]+>>)?$/i);
        if (mDecl) {
            const genre = mDecl[1].toLowerCase();
            const libelle = mDecl[2] || mDecl[3] || mDecl[4] || mDecl[5] || mDecl[6];
            const id = nettoyerId(mDecl[7] || libelle);
            aliasMap.set(libelle, id);
            aliasMap.set(id, id);
            const forme = genre === 'database' ? 'database' : genre === 'component' ? 'component' : genre === 'usecase' ? 'usecase' : genre === 'actor' ? 'actor' : genre === 'cloud' ? 'cloud' : 'rect';
            declarerNoeud(id, libelle, forme);
            continue;
        }

        // Déclaration court-circuitée : [Nom] as id, (Cas) as id, :Acteur: as id
        const mCourt = texte.match(/^(?:\[([^\]]+)\]|\(([^)]+)\)|:([^:]+):)(?:\s+as\s+([A-Za-z0-9_]+))?$/);
        if (mCourt) {
            const libelle = mCourt[1] || mCourt[2] || mCourt[3];
            const id = nettoyerId(mCourt[4] || libelle);
            aliasMap.set(libelle, id);
            aliasMap.set(id, id);
            const forme = mCourt[1] ? 'component' : mCourt[2] ? 'usecase' : 'actor';
            declarerNoeud(id, libelle, forme);
            continue;
        }

        // Liaison : A --> B : texte  (ou ..>, ==>, --, ..)
        const mLien = texte.match(/^(\[[^\]]+\]|\([^)]+\)|:[^:]+:|"[^"]+"|[A-Za-z0-9_]+)\s*(<?[-.=]+[A-Za-z]*[-.=]*>?)\s*(\[[^\]]+\]|\([^)]+\)|:[^:]+:|"[^"]+"|[A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/);
        if (mLien) {
            const de = resoudreTerme(mLien[1]);
            const fl = mLien[2];
            const vers = resoudreTerme(mLien[3]);
            const lib = mLien[4] ? `|${echapperGuillemets(mLien[4])}|` : '';
            let op = '-->';
            if (fl.includes('.')) op = fl.endsWith('>') ? '-.->' : '-.-';
            else if (fl.includes('=')) op = '==>';
            else if (!fl.includes('>')) op = '---';
            sortie.push(`${'    '.repeat(niveau)}${de} ${op}${lib} ${vers}`);
            continue;
        }

        throw new Error(`Ligne ${num} : instruction PlantUML non reconnue (« ${texte} »).`);
    }

    if (niveau > 1) {
        throw new Error(`Ligne ${lignes[lignes.length - 1].num} : bloc conteneur non fermé (il manque « } »).`);
    }
    return `${enteteTitre}${sortie.join('\n')}\n`;
}

// ---------- Détection de la famille PlantUML et traduction ----------

export function detecterFamillePlantUml(code) {
    const { genre, lignes } = pretraiter(code);
    if (genre === 'mindmap' || genre === 'wbs') return 'mindmap';
    if (genre === 'gantt') return 'gantt';
    const textes = lignes.map((l) => l.texte);
    if (textes.some((t) => /^(Person|System|Container|Component|Deployment_Node|Node|Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary|Rel|BiRel)\s*\(/.test(t))) {
        return 'c4';
    }
    if (textes.some((t) => /^([|o}{]{1,2}(?:--|\.\.)[|o}{]{1,2})/.test(t) || /\s[|o}{]{1,2}(?:--|\.\.)[|o}{]{1,2}\s/.test(t) || /^entity\b/i.test(t))) {
        return 'erDiagram';
    }
    if (textes.some((t) => /^\[\*\]/.test(t) || /-->\s*\[\*\]/.test(t) || /^state\b/i.test(t))) {
        return 'stateDiagram';
    }
    if (textes.some((t) => /^(abstract\s+class|interface\s+"?[^"]+"?\s*\{|class\s+|enum\s+)/i.test(t) || /(<\|--|--\|>|\*--|--\*|o--|--o|<\|\.\.|\.\.\|>)/.test(t))) {
        return 'classDiagram';
    }
    if (textes.some((t) => /^(start|stop)$/i.test(t) || /^:[^:]+;$/.test(t) || /^if\s*\(.*\)\s*then/i.test(t))) {
        return 'activity';
    }
    if (textes.some((t) => /^(participant|boundary|control|collections|queue|autonumber|activate|deactivate|alt|opt|loop|par|return)\b/i.test(t) || /^==.+==$/.test(t))) {
        return 'sequence';
    }
    if (textes.some((t) => /^(usecase|component|database|node|cloud|package|folder|frame|artifact|storage)\b/i.test(t) || /^(\[[^\]]+\]|\([^)]+\))/.test(t))) {
        return 'component';
    }
    // Par défaut dans @startuml : si les flèches portent « : message » simples sans formes entre crochets/parenthèses, séquence
    if (textes.some((t) => /^("[^"]+"|[A-Za-z0-9_]+)\s*(?:<--|-->>|->>|-->|->)\s*("[^"]+"|[A-Za-z0-9_]+)\s*:/.test(t))) {
        return 'sequence';
    }
    return 'component';
}

export function traduirePlantUml(code) {
    const { genre, titre, lignes } = pretraiter(code);
    if (!lignes.length) {
        throw new Error('Ligne 1 : le bloc PlantUML est vide.');
    }
    const enteteTitre = titre ? `---\ntitle: ${titre.replace(/[\r\n]/g, ' ')}\n---\n` : '';
    if (genre === 'mindmap' || genre === 'wbs') return traduireMindmap(lignes, enteteTitre);
    if (genre === 'gantt') return traduireGantt(lignes, enteteTitre);

    const famille = detecterFamillePlantUml(code);
    if (famille === 'c4') return traduireC4(lignes, enteteTitre);
    if (famille === 'erDiagram') return traduireEntites(lignes, enteteTitre);
    if (famille === 'stateDiagram') return traduireEtats(lignes, enteteTitre);
    if (famille === 'classDiagram') return traduireClasses(lignes, enteteTitre);
    if (famille === 'activity') return traduireActivite(lignes, enteteTitre);
    if (famille === 'sequence') return traduireSequence(lignes, enteteTitre);
    return traduireComposantsOuUsecase(lignes, enteteTitre);
}

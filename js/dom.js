// Construction du DOM sans jamais interpréter de chaîne comme du HTML (cahier des charges §7.3)

const PROPRIETES = new Set(['checked', 'disabled', 'selected', 'hidden', 'readOnly']);

function remplir(el, attrs, enfants) {
    let valeur;
    for (const [cle, v] of Object.entries(attrs || {})) {
        if (v === null || v === undefined || v === false) continue;
        if (cle === 'class') el.setAttribute('class', v);
        else if (cle === 'text') el.textContent = v;
        else if (cle === 'value') valeur = v;
        else if (cle.startsWith('on') && typeof v === 'function') el.addEventListener(cle.slice(2), v);
        else if (PROPRIETES.has(cle)) el[cle] = Boolean(v);
        else el.setAttribute(cle, v === true ? '' : String(v));
    }
    for (const e of enfants.flat(Infinity)) {
        if (e === null || e === undefined || e === false) continue;
        el.append(e.nodeType ? e : document.createTextNode(String(e)));
    }
    if (valeur !== undefined) el.value = valeur;
    return el;
}

export function h(balise, attrs, ...enfants) {
    return remplir(document.createElement(balise), attrs, enfants);
}

export function s(balise, attrs, ...enfants) {
    return remplir(document.createElementNS('http://www.w3.org/2000/svg', balise), attrs, enfants);
}

export function vider(el) {
    el.replaceChildren();
    return el;
}

let compteur = 0;
export function idUnique(prefixe = 'f') {
    compteur += 1;
    return `${prefixe}-${compteur}`;
}

// ---------- Composants DSFR ----------

export function bouton(libelle, { icone, variante = 'tertiary', taille = 'sm', seulIcone = false, onclick, titre, ...attrs } = {}) {
    const classes = ['fr-btn', `fr-btn--${taille}`];
    if (variante !== 'primary') classes.push(`fr-btn--${variante}`);
    if (icone) classes.push(`fr-icon-${icone}`);
    if (icone && !seulIcone) classes.push('fr-btn--icon-left');
    return h('button', { type: 'button', class: classes.join(' '), title: titre || (seulIcone ? libelle : null), onclick, ...attrs }, libelle);
}

export function champ(libelle, controle) {
    const id = controle.id || idUnique('champ');
    controle.id = id;
    return h('div', { class: 'fusain-champ' }, h('label', { class: 'fr-label', for: id }, libelle), controle);
}

export function champTexte(libelle, valeur, surChangement, { multiligne = false, type = 'text', direct = false, ...attrs } = {}) {
    const evenement = direct ? 'input' : 'change';
    const controle = multiligne
        ? h('textarea', { class: 'fr-input', rows: 2, value: valeur ?? '', ...attrs })
        : h('input', { class: 'fr-input', type, value: valeur ?? '', ...attrs });
    controle.addEventListener(evenement, () => surChangement(controle.value));
    return champ(libelle, controle);
}

export function champSelect(libelle, options, valeur, surChangement, attrs = {}) {
    const controle = h('select', { class: 'fr-select', ...attrs },
        options.map(([v, nom]) => h('option', { value: v, selected: v === valeur }, nom)));
    controle.addEventListener('change', () => surChangement(controle.value));
    return champ(libelle, controle);
}

export function champCase(libelle, valeur, surChangement) {
    const id = idUnique('case');
    const controle = h('input', { type: 'checkbox', id, checked: valeur });
    controle.addEventListener('change', () => surChangement(controle.checked));
    return h('div', { class: 'fr-checkbox-group fr-checkbox-group--sm fusain-champ' }, controle, h('label', { class: 'fr-label', for: id }, libelle));
}

// ---------- Messages ----------

export function annoncer(texte) {
    const zone = document.getElementById('fusain-annonce');
    zone.textContent = '';
    requestAnimationFrame(() => { zone.textContent = texte; });
}

export function message(titre, texte = '', type = 'info', duree = 6000) {
    const zone = document.getElementById('fusain-messages');
    const alerte = h('div', { class: `fr-alert fr-alert--${type} fr-alert--sm`, role: type === 'error' ? 'alert' : 'status' },
        h('h3', { class: 'fr-alert__title' }, titre), texte ? h('p', {}, texte) : null,
        h('button', { type: 'button', class: 'fr-btn--close fr-btn', title: 'Masquer le message', onclick: () => alerte.remove() }, 'Masquer le message'));
    zone.append(alerte);
    if (duree) setTimeout(() => alerte.remove(), duree);
}

// ---------- Modales DSFR ----------

export function modale(id, titre, contenu, pied = []) {
    document.getElementById(id)?.remove();
    const idTitre = `${id}-titre`;
    const dialogue = h('dialog', { id, class: 'fr-modal', 'aria-labelledby': idTitre, 'aria-modal': 'true' },
        h('div', { class: 'fr-container fr-container--fluid fr-container-md' },
            h('div', { class: 'fr-grid-row fr-grid-row--center' },
                h('div', { class: 'fr-col-12 fr-col-md-10 fr-col-lg-8' },
                    h('div', { class: 'fr-modal__body' },
                        h('div', { class: 'fr-modal__header' },
                            h('button', { type: 'button', class: 'fr-btn--close fr-btn', 'aria-controls': id, title: 'Fermer' }, 'Fermer')),
                        h('div', { class: 'fr-modal__content' }, h('h1', { id: idTitre, class: 'fr-modal__title' }, titre), contenu),
                        pied.length ? h('div', { class: 'fr-modal__footer' }, h('div', { class: 'fr-btns-group fr-btns-group--right fr-btns-group--inline-lg' }, pied)) : null)))));
    document.getElementById('fusain-modales').append(dialogue);
    return dialogue;
}

export function ouvrirModale(dialogue) {
    // Le DSFR instancie ses composants de façon asynchrone après insertion dans le DOM
    const essayer = (reste) => {
        const instance = window.dsfr?.(dialogue)?.modal;
        if (instance) instance.disclose();
        else if (reste > 0) setTimeout(() => essayer(reste - 1), 30);
    };
    essayer(40);
}

export function fermerModale(dialogue) {
    window.dsfr?.(dialogue)?.modal?.conceal();
}

export function confirmer(titre, texte, libelleAction = 'Confirmer') {
    return new Promise((resoudre) => {
        let reponse = false;
        const dialogue = modale('fusain-confirmation', titre, h('p', {}, texte), [
            bouton(libelleAction, { variante: 'primary', taille: 'md', onclick: () => { reponse = true; fermerModale(dialogue); } }),
            bouton('Annuler', { variante: 'secondary', taille: 'md', onclick: () => fermerModale(dialogue) }),
        ]);
        dialogue.addEventListener('dsfr.conceal', () => resoudre(reponse), { once: true });
        ouvrirModale(dialogue);
    });
}

// Trusted Types (cahier des charges §7.1) — chargé avant toute bibliothèque.
// Là où le navigateur le permet, plus aucune chaîne ne peut être écrite comme du HTML sans passer par cette
// politique : tout ce qu'une bibliothèque insère dans la page est d'abord assaini par DOMPurify, et la création
// de script à partir de texte est refusée. C'est un filet de sécurité indépendant du reste du code.
(function () {
    'use strict';
    if (!window.trustedTypes || !window.trustedTypes.createPolicy || !window.DOMPurify) return;
    var reglages = {
        USE_PROFILES: { svg: true, svgFilters: true, html: true },
        ADD_TAGS: ['foreignObject'],
        ADD_ATTR: ['dominant-baseline', 'aria-controls', 'aria-labelledby', 'aria-modal', 'data-fr-opened', 'data-action'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link'],
        ALLOW_DATA_ATTR: true,
    };
    try {
        window.trustedTypes.createPolicy('default', {
            createHTML: function (html) { return window.DOMPurify.sanitize(String(html), reglages); },
            createScript: function () { throw new TypeError('FUSAIN : création de script à partir de texte refusée.'); },
            createScriptURL: function (url) {
                var cible = new URL(String(url), document.baseURI);
                if (cible.origin === location.origin && /\/sw\.js$/.test(cible.pathname)) return cible.href;
                throw new TypeError('FUSAIN : chargement de script refusé (' + cible.href + ').');
            },
        });
        document.documentElement.setAttribute('data-fusain-confiance', '1');
    } catch (e) {
        console.warn('FUSAIN : politique Trusted Types non installée', e);
    }
}());

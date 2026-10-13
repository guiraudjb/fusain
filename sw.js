// FUSAIN — service worker : cache pré-rempli et versionné, fonctionnement hors ligne (cahier des charges §4.4)
// La liste ci-dessous est produite par outils/generer.py : rien n'est mis en cache dynamiquement.

/* DEBUT-GENERE */
const VERSION_CACHE = 'fusain-0.3.1-41aee2e876';
const FICHIERS = [
    './',
    './Documentation/GUIDE_UTILISATEUR.md',
    './FUSAIN_cahier_des_charges.md',
    './JOURNAL_DES_VERSIONS.md',
    './NOMENCLATURE_LOGICIELLE_FUSAIN.md',
    './css/fusain.css',
    './icones/fusain-192.png',
    './icones/fusain-512.png',
    './icones/fusain.svg',
    './index.html',
    './js/app.js',
    './js/brouillon.js',
    './js/confiance.js',
    './js/diagrammes/camembert.js',
    './js/diagrammes/commun.js',
    './js/diagrammes/frise.js',
    './js/diagrammes/gantt.js',
    './js/diagrammes/index.js',
    './js/diagrammes/kanban.js',
    './js/diagrammes/logigramme.js',
    './js/diagrammes/mentale.js',
    './js/diagrammes/quadrant.js',
    './js/diagrammes/sequence.js',
    './js/dom.js',
    './js/etat.js',
    './js/export.js',
    './js/fichier.js',
    './js/formats.js',
    './js/modeles.js',
    './js/rendu.js',
    './js/securite.js',
    './js/version.js',
    './libs/dompurify-v3.4.17/LICENSE',
    './libs/dompurify-v3.4.17/purify.min.js',
    './libs/dsfr-v1.15.4/LICENSE.md',
    './libs/dsfr-v1.15.4/dsfr.min.css',
    './libs/dsfr-v1.15.4/dsfr.module.min.js',
    './libs/dsfr-v1.15.4/favicon/android-chrome-192x192.png',
    './libs/dsfr-v1.15.4/favicon/android-chrome-512x512.png',
    './libs/dsfr-v1.15.4/favicon/apple-touch-icon.png',
    './libs/dsfr-v1.15.4/favicon/favicon.ico',
    './libs/dsfr-v1.15.4/favicon/favicon.svg',
    './libs/dsfr-v1.15.4/favicon/manifest.webmanifest',
    './libs/dsfr-v1.15.4/fonts-ttf/Marianne-Bold.ttf',
    './libs/dsfr-v1.15.4/fonts-ttf/Marianne-Regular.ttf',
    './libs/dsfr-v1.15.4/fonts/Marianne-Bold.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Bold_Italic.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Light.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Light_Italic.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Medium.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Medium_Italic.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Regular.woff2',
    './libs/dsfr-v1.15.4/fonts/Marianne-Regular_Italic.woff2',
    './libs/dsfr-v1.15.4/fonts/Spectral-ExtraBold.woff2',
    './libs/dsfr-v1.15.4/fonts/Spectral-Regular.woff2',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-down-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-down-s-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-go-back-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-go-forward-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-left-right-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-left-s-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-right-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-right-s-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-up-down-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-up-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/arrow-up-s-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/fr--arrow-left-s-first-line.svg',
    './libs/dsfr-v1.15.4/icons/arrows/fr--arrow-right-s-last-line.svg',
    './libs/dsfr-v1.15.4/icons/business/briefcase-fill.svg',
    './libs/dsfr-v1.15.4/icons/business/links-fill.svg',
    './libs/dsfr-v1.15.4/icons/business/mail-line.svg',
    './libs/dsfr-v1.15.4/icons/business/stack-line.svg',
    './libs/dsfr-v1.15.4/icons/design/drag-move-2-line.svg',
    './libs/dsfr-v1.15.4/icons/design/layout-grid-line.svg',
    './libs/dsfr-v1.15.4/icons/development/code-s-slash-line.svg',
    './libs/dsfr-v1.15.4/icons/device/save-line.svg',
    './libs/dsfr-v1.15.4/icons/document/file-add-line.svg',
    './libs/dsfr-v1.15.4/icons/editor/align-left.svg',
    './libs/dsfr-v1.15.4/icons/editor/fr--quote-line.svg',
    './libs/dsfr-v1.15.4/icons/editor/translate-2.svg',
    './libs/dsfr-v1.15.4/icons/logo/bluesky-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/bluesky-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/facebook-circle-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/facebook-circle-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/fr--dailymotion-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/fr--tiktok-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/github-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/instagram-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/linkedin-box-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/linkedin-box-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/mastodon-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/mastodon-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/snapchat-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/telegram-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/threads-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/threads-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/twitch-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/twitter-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/twitter-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/twitter-x-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/twitter-x-line.svg',
    './libs/dsfr-v1.15.4/icons/logo/vimeo-fill.svg',
    './libs/dsfr-v1.15.4/icons/logo/youtube-fill.svg',
    './libs/dsfr-v1.15.4/icons/media/fullscreen-line.svg',
    './libs/dsfr-v1.15.4/icons/system/add-line.svg',
    './libs/dsfr-v1.15.4/icons/system/check-line.svg',
    './libs/dsfr-v1.15.4/icons/system/checkbox-circle-line.svg',
    './libs/dsfr-v1.15.4/icons/system/close-line.svg',
    './libs/dsfr-v1.15.4/icons/system/delete-bin-line.svg',
    './libs/dsfr-v1.15.4/icons/system/download-line.svg',
    './libs/dsfr-v1.15.4/icons/system/error-warning-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/external-link-line.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--alert-warning-2-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--alert-warning-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--error-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--info-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--success-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--theme-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/fr--warning-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/information-line.svg',
    './libs/dsfr-v1.15.4/icons/system/menu-2-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/menu-fill.svg',
    './libs/dsfr-v1.15.4/icons/system/question-line.svg',
    './libs/dsfr-v1.15.4/icons/system/search-line.svg',
    './libs/dsfr-v1.15.4/icons/system/upload-line.svg',
    './libs/dsfr-v1.15.4/icons/system/zoom-in-line.svg',
    './libs/dsfr-v1.15.4/icons/system/zoom-out-line.svg',
    './libs/dsfr-v1.15.4/icons/user/account-circle-fill.svg',
    './libs/dsfr-v1.15.4/icons/user/team-line.svg',
    './libs/dsfr-v1.15.4/icons/weather/flashlight-fill.svg',
    './libs/dsfr-v1.15.4/icons/weather/heavy-showers-fill.svg',
    './libs/dsfr-v1.15.4/icons/weather/moon-line.svg',
    './libs/dsfr-v1.15.4/icons/weather/sun-line.svg',
    './libs/dsfr-v1.15.4/icons/weather/typhoon-fill.svg',
    './libs/dsfr-v1.15.4/utility/icons/icons.min.css',
    './libs/jspdf-v4.2.1/LICENSE',
    './libs/jspdf-v4.2.1/jspdf.umd.min.js',
    './libs/mermaid-v12.1.0/LICENSE',
    './libs/mermaid-v12.1.0/mermaid.min.js',
    './libs/svg2pdf-v2.8.1/LICENSE',
    './libs/svg2pdf-v2.8.1/svg2pdf.umd.min.js',
    './manifest.webmanifest',
    './sbom/fusain-sbom-cyclonedx.json',
    './schema/fusain.schema.json',
];
/* FIN-GENERE */

self.addEventListener('install', (evenement) => {
    evenement.waitUntil(
        caches.open(VERSION_CACHE).then((cache) => cache.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))),
    );
});

self.addEventListener('activate', (evenement) => {
    evenement.waitUntil(
        caches.keys()
            .then((cles) => Promise.all(cles.filter((c) => c.startsWith('fusain-') && c !== VERSION_CACHE).map((c) => caches.delete(c))))
            .then(() => self.clients.claim()),
    );
});

// La nouvelle version ne prend la main que lorsque l'utilisateur l'accepte
self.addEventListener('message', (evenement) => {
    if (evenement.data === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (evenement) => {
    const requete = evenement.request;
    const url = new URL(requete.url);
    // Seules les lectures de la même origine sont servies : rien ne sort, rien d'extérieur n'entre
    if (requete.method !== 'GET' || url.origin !== self.location.origin) return;
    evenement.respondWith(
        caches.open(VERSION_CACHE).then(async (cache) => {
            const cle = requete.mode === 'navigate' ? './index.html' : requete;
            const enCache = await cache.match(cle, { ignoreSearch: true });
            return enCache || fetch(requete);
        }),
    );
});

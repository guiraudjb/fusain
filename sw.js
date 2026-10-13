// FUSAIN — service worker : cache pré-rempli et versionné, fonctionnement hors ligne (cahier des charges §4.4)
// La liste ci-dessous est produite par outils/generer.py : rien n'est mis en cache dynamiquement,
// et rien n'y entre sans que son empreinte ait été vérifiée (cahier des charges §7.6).

/* DEBUT-GENERE */
const VERSION_CACHE = 'fusain-0.9.0-490f9158f1';
// [chemin, empreinte SHA-256] de chaque fichier de la version
const FICHIERS = [
    ['./Documentation/GUIDE_UTILISATEUR.md', '75bee68bde8495282635c578e981946c1927b60ad95485cdade14fef8fcc011b'],
    ['./FUSAIN_cahier_des_charges.md', 'a7bea560e09324d86ec32d383e0653a93bd7c5a7c4ce2dd012fba2c2dc4a7fe8'],
    ['./JOURNAL_DES_VERSIONS.md', '2a06de719449fb80816b13350d33341874c8ed685a3c04b69f6163dd8e6a4b75'],
    ['./NOMENCLATURE_LOGICIELLE_FUSAIN.md', '317c5f4e56109f5c0dc6456b77a64a746d43b7b60fc80bfe44d52af942e02dc6'],
    ['./css/fusain.css', '77293c7e2b74fadb4636dc8d20a0fdc42dfdd1ff86a1928002f938f8946b3411'],
    ['./icones/fusain-192.png', '799ed7660947f98cd3dca9bc24c8471ed2be1fb186c544a1a2f40788930e5a64'],
    ['./icones/fusain-512.png', '5305d17891b39cef137db3273833527db43460ba67be57d569888016df709a1a'],
    ['./icones/fusain.svg', 'd08a962fa1876ac73c1d7991d1850d5673ea70bf960953c69b4d9f89c7dc01ef'],
    ['./', 'dd66988d831bb8e5f5833fb64bf8c5a149197b495b90150afeded520715bfb39'],
    ['./index.html', 'dd66988d831bb8e5f5833fb64bf8c5a149197b495b90150afeded520715bfb39'],
    ['./js/app.js', '59e42ce8de3bbcb1a6c6df7c88beee174837415f26c0f74f3fdc2bb4c7a30887'],
    ['./js/brouillon.js', '185d325849e3485aa8a62f91b66f3e504a5e4f34689d66fac892fb512b0a53f3'],
    ['./js/confiance.js', '9b6028042a8bd5274e3531a15e9728392772a718fbee6be2948478dc77885981'],
    ['./js/diagrammes/architecture.js', 'bc6f9efdef5e9c04589969144dfe72d38eaab8fab20c7dc04aafd2ab4b11dbbb'],
    ['./js/diagrammes/blocs.js', '9a977fc44de97533048a0105b1f5338d78ad0d3323d5b64cc728860f3b62ef45'],
    ['./js/diagrammes/c4.js', '00a5e84119055949f6a5a5eec422d0372cb900902153fac4104b475ac1b33afc'],
    ['./js/diagrammes/camembert.js', '34d80b782476682bafc9c1a7b4c3e3ac37a00f1c1d70b420d169367214d4a806'],
    ['./js/diagrammes/classes.js', '4ca44e5795d360ac03737f514316faae6ff76349cc960724810d6d2f9dfa04aa'],
    ['./js/diagrammes/commun.js', '5a6f1399ec1d6c451a4f985003115928095d2b478f9b6f147c5ce349da2366e6'],
    ['./js/diagrammes/diapo.js', '3b06ed29ac6c0277d7ccf6f4a6402f26744872bc978626a4d993fd82928b57d8'],
    ['./js/diagrammes/entites.js', '067f339a741e66a75e2911a9dc5f8430691d69e6380ef545fb090a25fbd390c6'],
    ['./js/diagrammes/etats.js', 'e4ac8c0a9d338cf9fe5deadb799bc71daec425bee102c014d0a9159b685d561e'],
    ['./js/diagrammes/exigences.js', 'a9af2099f7980f3620afc99e5e9c97573b240f128c33c3b466666239c89c2c5c'],
    ['./js/diagrammes/flux.js', 'b47a630674a815cced680a44ecc6b49ea52449e190dd3eae710e52860ecd3eb0'],
    ['./js/diagrammes/frise.js', '34223332b4b649593da06cc6d1741f54366edcb2d26ae88bbad80ea02474a8d4'],
    ['./js/diagrammes/gantt.js', 'b22c669088374d9de3bfe16b4cf2197bca5af9975abd58256d726c13f8ce1da5'],
    ['./js/diagrammes/graphique.js', 'a3578a4bea1d4963882ed23c4e778bae08c0edd782509549e05b067829660f97'],
    ['./js/diagrammes/index.js', '636f8d37872f1068ef1cb8db33689651e884dfcb6f2b2fafef3122d89e763710'],
    ['./js/diagrammes/kanban.js', 'c1f4995552f040f945d4cf45d3458b8299382ecb5c4bbd88e7aa16809a5b6fda'],
    ['./js/diagrammes/logigramme.js', 'db6414d2e8343755ec7f397159cfadc60dbaf1397fd09484f6aad1437bcceac7'],
    ['./js/diagrammes/mentale.js', 'd27e5699c65bc10e29d9c767da73038403d4356aa14a0fc192b1eb27cc4d5fed'],
    ['./js/diagrammes/paquet.js', '31432b507ad4b22170a58f7c37f94f9b20ccbc93f499e669130f860da6703602'],
    ['./js/diagrammes/parcours.js', 'bd3d62559f465a01bb2512b91999ece92dffdc292b142e476c22adbb4c0c680a'],
    ['./js/diagrammes/quadrant.js', '8250f0f45fc2d8bd700524a5f9bada4d650341630a9195bc5b5ad796fb692778'],
    ['./js/diagrammes/radar.js', 'c2738c483059db67c6b9fd4acf526bfc054bde59d432047fe7d1c4c154379c3d'],
    ['./js/diagrammes/sequence.js', '0e06abf428c810ed88520160011c7129374ab0ca318abbff9265d2d0021311c8'],
    ['./js/diagrammes/treemap.js', 'f61c53e054b4e2c2999da379518115ddd898bdda702833291b8814e4f5a75c90'],
    ['./js/diagrammes/versions.js', 'd7bd9c603d836a92f67c5b4d9a5897a28d123cdc748e6b4f05a042e0cd880166'],
    ['./js/diagrammes/zenuml.js', '2af815e497545725741b2ffbbc7eb38c821941c20d4a7c587cb9ae48f7ebc49f'],
    ['./js/diapo.js', '2f82c9fe1e7a18d7ec2e6079dca16c8e175170d5ea3a46c8789654e443ccf9cd'],
    ['./js/dom.js', '8c514120093236dcf7e843d2d073857f0bda91e5252e002be6ab29dbbfd9c957'],
    ['./js/etat.js', '76f6d4ff0f6299c2e6d64221e0a287dd4ab5bea73612031c3cdfe9e1770d0082'],
    ['./js/export.js', '8b932df21aa83c7822769968dc28404e3857e412ca710c03908dab69bc64bc04'],
    ['./js/fichier.js', '2a25b930069c412777c38d8e14e93af4ae9231817e9b1bbd99fa1bd589df6712'],
    ['./js/formats.js', 'a9fe7e27d095f75c0eab899f083747f0b9c24b53699f754d368b5d952f2a5687'],
    ['./js/modeles.js', '4b7786c951e11d083cebc085e98c30be5d63c4ae51ce881bd67b163728ace7e3'],
    ['./js/rendu.js', '8dea560fb9e5dc151a9da7a30657d44af9e7b5d62605843d18c2c2104b4b226d'],
    ['./js/securite.js', 'c572f2c6c34425f5fddfc88ab6d8701836a8b51c43bb6ba3f5fa130f37092921'],
    ['./js/version.js', '9506ff7af21773043cb8b4bd2f24276dc4b32784761093877db7bb3ae0c39fa2'],
    ['./libs/dompurify-v3.4.17/LICENSE', 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'],
    ['./libs/dompurify-v3.4.17/purify.min.js', 'cd37898f9782adf54820c413191b5691803f0f137c799d6edcfd38523b4c2c31'],
    ['./libs/dsfr-v1.15.4/LICENSE.md', 'f57c62e6a99a23ff58dbd7180586e4b89e24857a11b8052c3d55b1614a4e467c'],
    ['./libs/dsfr-v1.15.4/dsfr.min.css', 'bb265a569c57d8f299c12c3da9cff202c3771498eeafc4bd3d2bb0a1ca641907'],
    ['./libs/dsfr-v1.15.4/dsfr.module.min.js', 'd175528740a8aaa4dc9fa8bb7ad3b2fee406c9396eb7fdd1b19d18c0c5eb8a9f'],
    ['./libs/dsfr-v1.15.4/favicon/android-chrome-192x192.png', 'e098d117ce30de01cd0be16a1877dfb454c45b0f15e21892ebc577b3a766785f'],
    ['./libs/dsfr-v1.15.4/favicon/android-chrome-512x512.png', 'ad302dfb0b7f20f244a6c8cc677d1c9d374ff2ce5b1c4b3f723174fdc18ebb26'],
    ['./libs/dsfr-v1.15.4/favicon/apple-touch-icon.png', 'e3082a759b2a9039011915af1403d8063ef09903eb87743b5414bf2a32c65b46'],
    ['./libs/dsfr-v1.15.4/favicon/favicon.ico', '0e0a5e52d40c658c20a212c3c4ea998ad8f83860ff55c5339bd487b2a2f583d8'],
    ['./libs/dsfr-v1.15.4/favicon/favicon.svg', '43b3c67695e85c2cf766f07c5a6abb04ebbec4f76efd2f5d6be48e38f00000a3'],
    ['./libs/dsfr-v1.15.4/favicon/manifest.webmanifest', 'e70ffdb719c14392b75e6645e03628b3e493720477811c03bb666ae13f889928'],
    ['./libs/dsfr-v1.15.4/fonts-ttf/Marianne-Bold.ttf', '0f5d00140d035d33fb5fa8927a7fd124d2c6ff4eba8b683dfa72488cc42bfe50'],
    ['./libs/dsfr-v1.15.4/fonts-ttf/Marianne-Regular.ttf', 'e21f2ef744eb05a33d1414970c07c0849e8af592df86130ae3b83917e7067f70'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Bold.woff2', '03736567d99c2c360bad2c21026ca4741b15ca1e9ab533f272162a65f94cfbfb'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Bold_Italic.woff2', '88ef0db9fe03890ef6adc786894829a7b9c7461f7efcf2af86f3a1657e3509a4'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Light.woff2', '83dbbaae1c48d6c318c751ed49a2a683b83f78d305aaae0fddc46fae95079f49'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Light_Italic.woff2', '88d5f6f0ec08d795850feded6e028c04d5d7015e30d5a8767d7b69c9327fb7bf'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Medium.woff2', '04e63da6c3f525e8f39f3aeedcfabd85f9a6a48e33e35030cfa79c0987e577dc'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Medium_Italic.woff2', '5ee24277992f8a006323319c6d585a4de816ceb52c5b7e89d5050ee3d8b94632'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Regular.woff2', '812177facf2d71a85e7aa216f87fd46f5ce5189bee57171a0d0f654dba12b14f'],
    ['./libs/dsfr-v1.15.4/fonts/Marianne-Regular_Italic.woff2', '7c5db58e865103de356f28653298edc018a64d29ce4238e57b597124ce78c41e'],
    ['./libs/dsfr-v1.15.4/fonts/Spectral-ExtraBold.woff2', '28d8fc6af204f2d007524006636ef3f561a820c85e40aac54f385a44852050b0'],
    ['./libs/dsfr-v1.15.4/fonts/Spectral-Regular.woff2', '9c4f16b44fec4a8ca1c9f38d7a6f91645715945b0201ba9275fd5000197bee8e'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-down-line.svg', 'e76f6586d5b400ffb85bdc8639d9ae707bc41641cb6960a87f21131e04f7b73b'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-down-s-line.svg', 'fe793b4ca3825525eb6393308d7983821c149a2a01b1bae85a6b3f045bdaec25'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-go-back-line.svg', '4fd1b2de4b718ab03a090cacc20e22b00303a7197a5a6a38976765f6f967e9e8'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-go-forward-line.svg', 'da744a6f9d422370cfe8ec56b34d69969d3479992a9c9c4ef7d652506d74752c'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-left-right-line.svg', '25fa545f1c4c27dd9c87921d77d2f85bd3a3080a259ecea4d2c8d63d84912f6b'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-left-s-line.svg', 'c49a2a965c9c727579da90bfd4137fd287e7bb876e585b32d3e9956e93c725f9'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-right-line.svg', '2929a4704a947bad8f1bb7cd2e442b4df9f6cd201a86c5e38302586c9db5bbda'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-right-s-line.svg', '463f726e6247030b3975cb6ed2fae40f2a70a9a4af6d74a2729ff02671dc8939'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-up-down-line.svg', '457895476620d22dd211d3b6b18daac6c009ed922e06fe30f1caf695b77fd14c'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-up-line.svg', 'c3947a0b7f4b018baf72d2b9edd988f391bc8de9e3c03b24733747c4cd2b5cd1'],
    ['./libs/dsfr-v1.15.4/icons/arrows/arrow-up-s-line.svg', '2dc8b949dbc8e6678e461d010e77b395a9117d77cc3933ce862af7adc7b4dfd6'],
    ['./libs/dsfr-v1.15.4/icons/arrows/fr--arrow-left-s-first-line.svg', '7331cf73cabfa6a4e8c2c432976ef777b82615efb89bd19967dcac8d81e275b3'],
    ['./libs/dsfr-v1.15.4/icons/arrows/fr--arrow-right-s-last-line.svg', 'a629ae8ec7f1ab494b91dd410e5f6b9ca3f6fe0b236e66e6a4213cc5bab13c2f'],
    ['./libs/dsfr-v1.15.4/icons/business/briefcase-fill.svg', '42dcb7598d7df0fa2c8b7c911111bde76dc52af63829b0a7c475a42f8efd3f9e'],
    ['./libs/dsfr-v1.15.4/icons/business/links-fill.svg', 'b7eb38d044c1212219d2a962f613172c04ea1c1fb36dada645fbef927add3cc9'],
    ['./libs/dsfr-v1.15.4/icons/business/mail-line.svg', '1bb2cd61617c604d4d1095b277cc7b3af7b64dfdf14bec1e0be79deae8e45db1'],
    ['./libs/dsfr-v1.15.4/icons/business/stack-line.svg', 'bb254d59d9db21becce224ac53463ea07966532edef4e88d7f7e4e4c92d6ff7c'],
    ['./libs/dsfr-v1.15.4/icons/design/drag-move-2-line.svg', '12d9adb8cf3b31185cfd3e6fe8df25e02c186e9aaf42db58ea77f8cc0b3b0a90'],
    ['./libs/dsfr-v1.15.4/icons/design/layout-grid-line.svg', '00e3a66670b7c2bc780ab225e18de7a3f7034a41ecdd5adfa49ceb40ff2e8a66'],
    ['./libs/dsfr-v1.15.4/icons/development/code-s-slash-line.svg', '24d0114025006f9a6dea23efca7a5f26a8b4dab7bec99590a83523a0a7844acc'],
    ['./libs/dsfr-v1.15.4/icons/device/save-line.svg', '8060b2784c702754018950c221907e9e595547ea276f32b695d7df93aeb55a3e'],
    ['./libs/dsfr-v1.15.4/icons/document/file-add-line.svg', '46f6c0fd042d7fbb551ba7dc7884d820682220caa6009be80b20697629815fd4'],
    ['./libs/dsfr-v1.15.4/icons/editor/align-left.svg', '932f93531a97ef89086ee12de4e15eb13232019f18106053795fea283e0714bc'],
    ['./libs/dsfr-v1.15.4/icons/editor/fr--quote-line.svg', '0c4ddd62d7a843a779b1b4d12615cd4df9bd3fdabc8d0b3e8c1f90ff87b089f1'],
    ['./libs/dsfr-v1.15.4/icons/editor/translate-2.svg', '60e448fa1c27a6c877ef0b1bcc62da6d2561c03f0c5a53b7d6d60230369f0134'],
    ['./libs/dsfr-v1.15.4/icons/logo/bluesky-fill.svg', '8cb461fb076aaa9e170b0d6acf26373e2a0f0689c30a121d9bc5e165509b3b30'],
    ['./libs/dsfr-v1.15.4/icons/logo/bluesky-line.svg', 'ac14234e6c432c8ac468a706847de7ffdf11e96d1fb85fff31747d6706f939b1'],
    ['./libs/dsfr-v1.15.4/icons/logo/facebook-circle-fill.svg', '5904580648a1f585b6b6c787942971c95c071f0fa268342cfc25ec8a984fee52'],
    ['./libs/dsfr-v1.15.4/icons/logo/facebook-circle-line.svg', 'b49f738cf1e01fb51e892ac4f1e3f82805cc6c64663d9bbd23ce920c97077b46'],
    ['./libs/dsfr-v1.15.4/icons/logo/fr--dailymotion-fill.svg', 'e1cd797ad3ef3d2814ef4317e5bdcc229e5e74c168952fe63f6f9a47bad3fa2d'],
    ['./libs/dsfr-v1.15.4/icons/logo/fr--tiktok-fill.svg', 'e8dd4ea9aef84c14ca0a3565dba54bf8a32b56ea404fb8cddd395c0c1c20975f'],
    ['./libs/dsfr-v1.15.4/icons/logo/github-fill.svg', '12669cdd9398dfe820e8d8de94a2769ec6e72d5a0d998ad51a26d9e646f73893'],
    ['./libs/dsfr-v1.15.4/icons/logo/instagram-fill.svg', '6d1aa63e8b03dded021d24ae7483a095fb891485298ca02c294609fe14400c07'],
    ['./libs/dsfr-v1.15.4/icons/logo/linkedin-box-fill.svg', '816b040e570b60c1a1b6b35ad3a41687feb70bea751ab2ef2b2cef9f1bbf4ae8'],
    ['./libs/dsfr-v1.15.4/icons/logo/linkedin-box-line.svg', '9a75017f1236a9d07af69fb7099069c6a39d91594bb6e506522d468e03bed65a'],
    ['./libs/dsfr-v1.15.4/icons/logo/mastodon-fill.svg', '32767418278172894f8510bea21f94a872e94e121421b35a73dedd7beb3f2b9f'],
    ['./libs/dsfr-v1.15.4/icons/logo/mastodon-line.svg', 'd9da698b72cbc154aca3e8dcfb3ae04132f0e1f40179602d122c425332f9830f'],
    ['./libs/dsfr-v1.15.4/icons/logo/snapchat-fill.svg', '6033648b4ed35dcddfa99a17b0978bbbccee9eef3cb503df3125dfe77bd4f899'],
    ['./libs/dsfr-v1.15.4/icons/logo/telegram-fill.svg', 'a5ac234dd40157d533d7cc5665dec4db66080338e5e6f1d4a8d6823bf4b55009'],
    ['./libs/dsfr-v1.15.4/icons/logo/threads-fill.svg', '960b0c6f4340f4da7cb06cd98cabe7049b392094a1d5187eaa0077885d54db8c'],
    ['./libs/dsfr-v1.15.4/icons/logo/threads-line.svg', 'c94c4bc0c3b60736e415ce21cc9338f53af8a68b5ef632c8e139c6823900edb2'],
    ['./libs/dsfr-v1.15.4/icons/logo/twitch-fill.svg', '7818ec2f978753c7c13a67aab8198ecef55642c209bd630a9c3a2427a40e4cf9'],
    ['./libs/dsfr-v1.15.4/icons/logo/twitter-fill.svg', '14843b6a59005e81e96fed982289a721674f19a04e3f620b3caea966fcfce3d2'],
    ['./libs/dsfr-v1.15.4/icons/logo/twitter-line.svg', '3c31c70239eb5d058595545b0575bd34e5b3b49834c513255d5b1d49efb2a501'],
    ['./libs/dsfr-v1.15.4/icons/logo/twitter-x-fill.svg', '810e32e97342902c3f194f81955bbc00b319a0cf21d7a7ed38886ecd68f20fb5'],
    ['./libs/dsfr-v1.15.4/icons/logo/twitter-x-line.svg', '5e045451f8059154a162bc662b5b751e17d7fcb5d20e2a6e552037dabdd9b05c'],
    ['./libs/dsfr-v1.15.4/icons/logo/vimeo-fill.svg', '63bf8f5c214d08cbbd9ccdf66ca120babacf31bdc08c0fb7ac7fcc8b8e5ba83f'],
    ['./libs/dsfr-v1.15.4/icons/logo/youtube-fill.svg', '7785aadce1ac446e3ca08285a234d74090bf90bc4df7a0ae376ec23dc698672c'],
    ['./libs/dsfr-v1.15.4/icons/media/fullscreen-line.svg', 'ea359d0f8927113c92c8c2c90cb8108972cb64ae9c645adc053f2fdd0fee6f79'],
    ['./libs/dsfr-v1.15.4/icons/system/add-line.svg', '975f2a32fe531fe04f21ae4cb423a12c3f7e83686ae5e02ad4a23aa23a165115'],
    ['./libs/dsfr-v1.15.4/icons/system/check-line.svg', '48d8bc7fcf0384da161f00ff6ad311427d4c15606d1f3f0bd1674dc0df24824a'],
    ['./libs/dsfr-v1.15.4/icons/system/checkbox-circle-line.svg', '2468f84af7c0d7790beb5d383dd32a22b40db5a7288ddf72f8ce2470eb4656ba'],
    ['./libs/dsfr-v1.15.4/icons/system/close-line.svg', '0be127f1a5ee06cad6cc4dd668cfc27ee58d6f3e6841ad9dd0abfef3d9216b3a'],
    ['./libs/dsfr-v1.15.4/icons/system/delete-bin-line.svg', 'd400ad2c98a2903808944037b805b2452ae781c3a64e71a2de94249c5bd0f829'],
    ['./libs/dsfr-v1.15.4/icons/system/download-line.svg', 'c54611e93741549b5048d52731023d7837f0bd594b8cf1105606948efe97b896'],
    ['./libs/dsfr-v1.15.4/icons/system/error-warning-fill.svg', '74e7bea45e2e2dad4643d8aa920796bf914f89da63cab9eca1c9eff21b8e0fc4'],
    ['./libs/dsfr-v1.15.4/icons/system/external-link-line.svg', 'e6f54f5ea8ae2921980b307fa4b770105f9a607d055f88bbd8abc2207b5076c8'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--alert-warning-2-fill.svg', '7e41c29aea2545404006d26dd51289b6a45df585a281634607b0d88044395758'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--alert-warning-fill.svg', '7adadac583514d1e165e5211c292bdb2948531e5ce7838a74e0aa5f553759055'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--error-fill.svg', '86b989f89f360bca2c58f4dbeab64531af8bea9147a10f590fc3f7171b9579bf'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--info-fill.svg', '5cbeb3f6f593c75522d66f52a09b55c531fc48028d18aa13563c9bb574570004'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--success-fill.svg', '5f95ff9be7ee7e6baf914c9ce63896904a0c9cd7a0e9ee79ad6e1407d9cf305e'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--theme-fill.svg', 'e940c7c5ec9ff5caaad54af4217865a9a18ede167a6684baf084f64afca478e6'],
    ['./libs/dsfr-v1.15.4/icons/system/fr--warning-fill.svg', 'ad92b318a907668848ffb334b356248e00ae3c81d246e8a43901ba3d71aabc5d'],
    ['./libs/dsfr-v1.15.4/icons/system/information-line.svg', '8e956b48ad6c024714ce1ecebd72d7cc305ab96b833edb1feda0064231298177'],
    ['./libs/dsfr-v1.15.4/icons/system/menu-2-fill.svg', '9f3a66cbc3c1d8657b863150ce203d96c837d7683cdc6ac890d125c9715d91f3'],
    ['./libs/dsfr-v1.15.4/icons/system/menu-fill.svg', '58fea24bf69496215839f310e6297d93df3bfb7803766f3ad6bc42d798610690'],
    ['./libs/dsfr-v1.15.4/icons/system/question-line.svg', '410cb77b3065e98a443c0b51f7d3dc0f2c8ddeb3162ed2af25bde2769d77c8ef'],
    ['./libs/dsfr-v1.15.4/icons/system/search-line.svg', '76087cdca3df81def893a678bf5908c91f9c6ab3010c3bd303f9c3a72fa91e7b'],
    ['./libs/dsfr-v1.15.4/icons/system/upload-line.svg', '49e7696343c320139c0bac82ccc13dfd09937d02545892735b8dd24454d8c31a'],
    ['./libs/dsfr-v1.15.4/icons/system/zoom-in-line.svg', '65fb1437bbbaee2bf246761ae2e794cc944811a2bf09100f70cd58a5174f3da9'],
    ['./libs/dsfr-v1.15.4/icons/system/zoom-out-line.svg', 'fb74655147ae2d43e8ddbeb8a2b44c9655cbf620c74ccb3e1b8e5ebfae03f454'],
    ['./libs/dsfr-v1.15.4/icons/user/account-circle-fill.svg', 'f7dadd07638c7511ef04c8000aa0dbdcb5f544a69d1940841b56a904fd211da3'],
    ['./libs/dsfr-v1.15.4/icons/user/team-line.svg', '58f6e6f0d3bc13839b4031ab793eed0e1ce70780c7715686eea6178058501a1e'],
    ['./libs/dsfr-v1.15.4/icons/weather/flashlight-fill.svg', 'ae4ec0360a98adef902a6a2d25a90b4259dd94c56e6b7a8fa2e627d51f705864'],
    ['./libs/dsfr-v1.15.4/icons/weather/heavy-showers-fill.svg', 'ca20a6c6f2aab99c08d30bc1d2a22adf5379fca380d9b3ccdf7d4a574e5b5196'],
    ['./libs/dsfr-v1.15.4/icons/weather/moon-line.svg', '4c8c16657636d3b323f6cd0469c3aff9bb7cb14e96f47039458cd384e84b9366'],
    ['./libs/dsfr-v1.15.4/icons/weather/sun-line.svg', '4c9a08998c5014c8007cd608735954b445e73ce8f296e13bdb195d6bb956931b'],
    ['./libs/dsfr-v1.15.4/icons/weather/typhoon-fill.svg', '199ddb1f2383c0d705610e7bad4457c8893e4b42dc76c11f542820229e2c8188'],
    ['./libs/dsfr-v1.15.4/utility/icons/icons.min.css', '4932083897a9e000445734f6d39ff6e530edd1a7668fddfa1861f075767cefe6'],
    ['./libs/jspdf-v4.2.1/LICENSE', 'dc388ec35ff463288cdde3588a36fd4ed12a45deff053243b37309acc9ef583b'],
    ['./libs/jspdf-v4.2.1/jspdf.umd.min.js', 'e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54'],
    ['./libs/mermaid-v12.1.0/LICENSE', 'ec9fb67dcb25eccc416ed56e1aab819222c805a2a4bfe4cb19e7556bf2ffde80'],
    ['./libs/mermaid-v12.1.0/mermaid.min.js', '6484afc32872a3aa16cac9a76ba1816a1ed4cc870a6593cc2e17757750f518b2'],
    ['./libs/mermaid-zenuml-v1.0.1/LICENSE', 'ec9fb67dcb25eccc416ed56e1aab819222c805a2a4bfe4cb19e7556bf2ffde80'],
    ['./libs/mermaid-zenuml-v1.0.1/mermaid-zenuml.min.js', 'f75662869d22aac58870e52370fe4c46b89b9710bf4b03df93b3227b5e18e730'],
    ['./libs/svg2pdf-v2.8.1/LICENSE', '04db7fb792d065c8c9a0e3a7a8255cd36e32b263ca023cbea10daee4a45132b8'],
    ['./libs/svg2pdf-v2.8.1/svg2pdf.umd.min.js', '2f10c0d16959e9a0c4cfd8605cfce0830ddc384337f74fa0351a6eff1c1efb8b'],
    ['./manifest.webmanifest', 'db470640d46619c11c0e76cadd1b55f404bb2b1d11dba166d1079b51df7343c1'],
    ['./sbom/fusain-sbom-cyclonedx.json', 'b0c96275db57d888978c065a94ce655f919118970f243ae5a3eaa00b74f39b59'],
    ['./schema/fusain.schema.json', '839ce30901c0ab12e44e189d7d3dc27d593eab3185ab6eaabc0cc7dcb901eb17'],
];
/* FIN-GENERE */

// Chaque fichier est vérifié avant d'entrer dans le cache : si un seul ne correspond pas à son empreinte
// (fichier altéré, publication incomplète), l'installation échoue et la version précédente reste en service.
async function telechargerVerifie(cache, [chemin, attendue]) {
    const reponse = await fetch(new Request(chemin, { cache: 'reload' }));
    if (!reponse.ok) throw new Error(`FUSAIN : ${chemin} introuvable (${reponse.status})`);
    const condense = await crypto.subtle.digest('SHA-256', await reponse.clone().arrayBuffer());
    const empreinte = [...new Uint8Array(condense)].map((o) => o.toString(16).padStart(2, '0')).join('');
    if (empreinte !== attendue) throw new Error(`FUSAIN : intégrité non vérifiée pour ${chemin}`);
    await cache.put(chemin, reponse);
}

self.addEventListener('install', (evenement) => {
    evenement.waitUntil(
        caches.open(VERSION_CACHE)
            .then((cache) => Promise.all(FICHIERS.map((fichier) => telechargerVerifie(cache, fichier))))
            .catch((erreur) => caches.delete(VERSION_CACHE).then(() => { throw erreur; })),
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

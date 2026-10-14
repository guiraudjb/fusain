// FUSAIN — service worker : cache pré-rempli et versionné, fonctionnement hors ligne (cahier des charges §4.4)
// La liste ci-dessous est produite par outils/generer.py : rien n'est mis en cache dynamiquement,
// et rien n'y entre sans que son empreinte ait été vérifiée (cahier des charges §7.6).

/* DEBUT-GENERE */
const VERSION_CACHE = 'fusain-0.16.0-edd2b0551d';
// [chemin, empreinte SHA-256] de chaque fichier de la version
const FICHIERS = [
    ['./Documentation/GUIDE_UTILISATEUR.md', 'b3c67b1a5a6bfb54274ea90821a3439c3e5088ff0d2fddf2beefc895862c5538'],
    ['./FUSAIN_cahier_des_charges.md', '5790663ca747c4568b34ac4d80d57ca3c04ae1894f6a9bca0df5b0fcf29130ca'],
    ['./JOURNAL_DES_VERSIONS.md', '456925ac132f746a031d8efcc64fe3e39a3434d1b5ba4911897addc0c548f5db'],
    ['./NOMENCLATURE_LOGICIELLE_FUSAIN.md', 'c03ee569bf854a8480a2191915cee53c8e28032d4592ce478e23e417bed0ccec'],
    ['./cartes/LICENCE.txt', 'ffc9ae78a83508f23d6aa7fa76e688ceb53c1c17c5b4930c96b26b697ac766e9'],
    ['./cartes/departements.json', '571bd5e0d68df17c854ef892a6e6ecbb90d05837762c7b94329bcbaa8f49a9e6'],
    ['./cartes/epci.json', '70aae5470b7f9f1e94f8222cec912ee533ec88349d4fc5b27de3d9b1db257332'],
    ['./cartes/index.json', 'e5a8969f0db9d5c0852b9376c2cd67ea9bd0f783096769ce678d10546c4c7c21'],
    ['./cartes/monde.json', 'd3a4565c2e995afa458d4b2a71351295c9c391c068bdc6d10efc3177794d84e0'],
    ['./cartes/regions-du-monde.json', '5d5472cd7eb79f1538e61855cd14dbeef92e4d74497d3c1b5666ca72ecdce2a1'],
    ['./css/fusain.css', 'd381a150a1c86d89d868960313188330ca95aab0073384b2b3ac3bfbb0e96398'],
    ['./icones/fusain-192.png', '799ed7660947f98cd3dca9bc24c8471ed2be1fb186c544a1a2f40788930e5a64'],
    ['./icones/fusain-512.png', '5305d17891b39cef137db3273833527db43460ba67be57d569888016df709a1a'],
    ['./icones/fusain.svg', 'd08a962fa1876ac73c1d7991d1850d5673ea70bf960953c69b4d9f89c7dc01ef'],
    ['./icones/illustrees/LICENCE.txt', '51aa13a68ded691ac243c7c79af3506b8763d4af5e91a5584b5026d3b7438799'],
    ['./icones/illustrees/agriculture.json', '4b1f076ef42b3c0518e2d6b5f8ba3d0e7a5fd88f973ddcf2555cc6f13dea5852'],
    ['./icones/illustrees/cadastre.json', 'cb1e7457b87f67b85c37c718e41ea257167ed092c649d24fdb2e595ff76bfd91'],
    ['./icones/illustrees/economie.json', 'c0372bb665d2e2fc8bac8d445e236cc94c142a1c18a1ef8d198604bc91708c6f'],
    ['./icones/illustrees/education.json', '4066bd2038fcabd23674fcb187f47fa76aff80494c7d2c9430c603bd3123f3a5'],
    ['./icones/illustrees/energie.json', 'b79396c259ad9e36803642a8d948f538fb811238852a9262cc7f19a13a8cf12a'],
    ['./icones/illustrees/environnement.json', '5fa2db92f5b50427450cd6b5f02d5c35f61bf340800e48a3a561ba85dd44c17b'],
    ['./icones/illustrees/finances.json', 'dbbdf95621c07d7d540d59f0473407cd3c44a4694bc25056264076c9de8dc86e'],
    ['./icones/illustrees/guerre.json', '597f185899bab5f0925ded8e46437b60c65ef8571f3ac65dba321e399321ecc2'],
    ['./icones/illustrees/index.json', 'e815da6d4cd4f570aa58f66f19873bd5cfd058075e71ff496678c8a04d2c3cd7'],
    ['./icones/illustrees/informatique.json', 'f1e0adb37d3cff83d854af0f861260b110d6b6062e61414ea50348e24db16469'],
    ['./icones/illustrees/justice.json', '1730967dd195424d574e9c4a77030bbe60f7ada4fa40cc5f0182716fa71361fb'],
    ['./icones/illustrees/logiciel.json', '060e7bafa30f0ab66ce12b68a4289ee4be05bcb7a02adcc9815517aa961a790c'],
    ['./icones/illustrees/meteo.json', 'b1c5ae6f6ce125b9a0e3b54711914c727a04f9d1033d0ebf07074758673f23dd'],
    ['./icones/illustrees/projet.json', '7868414cfa3bf97d28a231706e8ab734ac0e6dce9f35b406d520b795378834b3'],
    ['./icones/illustrees/ressources-humaines.json', '5d935f576281b88e9288c98fd9ca484169e9069f11ca7ef8fd2ec675c43037d8'],
    ['./icones/illustrees/sante-social.json', 'df915b1849f7d03e956322ba0bbee460a7fd17f96b0df5eb172f93da71178f39'],
    ['./icones/illustrees/secours.json', 'c33d8495f55ae073a403533159ba1d0c7859989875600e5a3f46a70fb14a9a07'],
    ['./icones/illustrees/services-publics.json', 'a1643220153b4568a7105780a6db2d2281e1d8ae4b20b016614b752cc9de1d50'],
    ['./icones/illustrees/transports.json', '62cae57e6ce639d0107f47ef119087075ceab8816252cf6ec27309cbc4ea30d6'],
    ['./', '1d88a21fd67d93720531bb1ca1460a1a7e1cdf46b7693a937e698fe693f0739e'],
    ['./index.html', '1d88a21fd67d93720531bb1ca1460a1a7e1cdf46b7693a937e698fe693f0739e'],
    ['./js/app.js', 'cfe0dc2b50b58fd2392b906bc7a9c15f95a7b4001e7165759f3a74a139118389'],
    ['./js/brouillon.js', '185d325849e3485aa8a62f91b66f3e504a5e4f34689d66fac892fb512b0a53f3'],
    ['./js/carte.js', 'dddf1cca78f130628b837f0674da2d6177ccd893961f5af615f36bc8dacbef11'],
    ['./js/confiance.js', 'a91d39f62cbd5c1a01327929997e11db9368a94074c86f7bf36d10ace4ae22f6'],
    ['./js/diagrammes/arbre.js', '2de684eb0d7fdd3d98403e44ec614443b4020d8780067f8e75da0c4f6697ebec'],
    ['./js/diagrammes/architecture.js', '4b5b75f8a7ae0194fa90346006ca61e0b63a2fce3914283dd1be736ccae1f929'],
    ['./js/diagrammes/blocs.js', '9a977fc44de97533048a0105b1f5338d78ad0d3323d5b64cc728860f3b62ef45'],
    ['./js/diagrammes/c4.js', '00a5e84119055949f6a5a5eec422d0372cb900902153fac4104b475ac1b33afc'],
    ['./js/diagrammes/camembert.js', '34d80b782476682bafc9c1a7b4c3e3ac37a00f1c1d70b420d169367214d4a806'],
    ['./js/diagrammes/carte.js', '020b07f1e2d07703bacc8fefae033d33f5c65b42ba3c37ce5bc68a5f9efb0c8f'],
    ['./js/diagrammes/classes.js', '4ca44e5795d360ac03737f514316faae6ff76349cc960724810d6d2f9dfa04aa'],
    ['./js/diagrammes/commun.js', '5a6f1399ec1d6c451a4f985003115928095d2b478f9b6f147c5ce349da2366e6'],
    ['./js/diagrammes/diapo.js', '2c4c800a2603d6a7f9ec9692cb8e06fad3c4350ddbea50852b0b065119ad175e'],
    ['./js/diagrammes/entites.js', '067f339a741e66a75e2911a9dc5f8430691d69e6380ef545fb090a25fbd390c6'],
    ['./js/diagrammes/etats.js', 'e4ac8c0a9d338cf9fe5deadb799bc71daec425bee102c014d0a9159b685d561e'],
    ['./js/diagrammes/exigences.js', 'a9af2099f7980f3620afc99e5e9c97573b240f128c33c3b466666239c89c2c5c'],
    ['./js/diagrammes/flux.js', 'b47a630674a815cced680a44ecc6b49ea52449e190dd3eae710e52860ecd3eb0'],
    ['./js/diagrammes/frise.js', '34223332b4b649593da06cc6d1741f54366edcb2d26ae88bbad80ea02474a8d4'],
    ['./js/diagrammes/gantt.js', 'b22c669088374d9de3bfe16b4cf2197bca5af9975abd58256d726c13f8ce1da5'],
    ['./js/diagrammes/graphique.js', 'a3578a4bea1d4963882ed23c4e778bae08c0edd782509549e05b067829660f97'],
    ['./js/diagrammes/index.js', 'e0b15131106160c2f1e70d970df8e780a8e90dd0b605e5b2fae8d92e6736f8e6'],
    ['./js/diagrammes/kanban.js', 'c1f4995552f040f945d4cf45d3458b8299382ecb5c4bbd88e7aa16809a5b6fda'],
    ['./js/diagrammes/logigramme.js', 'a56452247d3cec6b867ba2a63f741910a3b9115720bf9978ff75a6c0cac56efd'],
    ['./js/diagrammes/mentale.js', 'd27e5699c65bc10e29d9c767da73038403d4356aa14a0fc192b1eb27cc4d5fed'],
    ['./js/diagrammes/paquet.js', '31432b507ad4b22170a58f7c37f94f9b20ccbc93f499e669130f860da6703602'],
    ['./js/diagrammes/parcours.js', 'bd3d62559f465a01bb2512b91999ece92dffdc292b142e476c22adbb4c0c680a'],
    ['./js/diagrammes/quadrant.js', '8250f0f45fc2d8bd700524a5f9bada4d650341630a9195bc5b5ad796fb692778'],
    ['./js/diagrammes/radar.js', 'c2738c483059db67c6b9fd4acf526bfc054bde59d432047fe7d1c4c154379c3d'],
    ['./js/diagrammes/sequence.js', '0e06abf428c810ed88520160011c7129374ab0ca318abbff9265d2d0021311c8'],
    ['./js/diagrammes/treemap.js', 'f61c53e054b4e2c2999da379518115ddd898bdda702833291b8814e4f5a75c90'],
    ['./js/diagrammes/venn.js', 'f47b8c8b035af4707211a1eaf755e834838f239f3853c0ac7e8bbb685d8a7cdf'],
    ['./js/diagrammes/versions.js', 'd7bd9c603d836a92f67c5b4d9a5897a28d123cdc748e6b4f05a042e0cd880166'],
    ['./js/diagrammes/zenuml.js', '2af815e497545725741b2ffbbc7eb38c821941c20d4a7c587cb9ae48f7ebc49f'],
    ['./js/diapo.js', 'ad2e583965e50443acc38b361d5d9e5216f73bec8f581fe394869b6e9bfb105b'],
    ['./js/dom.js', '5fcda744fa2c0fb3542c7f52b2c8c2274f90cf1e9645a9d3364d27900b4fd01c'],
    ['./js/etat.js', '76f6d4ff0f6299c2e6d64221e0a287dd4ab5bea73612031c3cdfe9e1770d0082'],
    ['./js/export.js', '8b932df21aa83c7822769968dc28404e3857e412ca710c03908dab69bc64bc04'],
    ['./js/fichier.js', '9f8be26e831b0338419583703e5a2b1b9c839195bbf238e672b0fc8a3f4fb0f6'],
    ['./js/formats.js', 'a9fe7e27d095f75c0eab899f083747f0b9c24b53699f754d368b5d952f2a5687'],
    ['./js/geo.js', '2410705abae5ad8ac66487d8f395b0f42f41d4e70f523bb969698d07f09d9c93'],
    ['./js/icones.js', '0659879af168a36cc8137d3a4901b5c91e34373751a7fa946d127b1ce7fc3bac'],
    ['./js/illustrations.js', '9fc9af6eb7298523b72ab66ee843eb6ef35c758ce27c230d7d5a043a9d133eec'],
    ['./js/markdown.js', '460de07eb055b1f3615b63649418f17c5ccc424fcaa9d37cf65b6f9033f0f601'],
    ['./js/modeles.js', 'a632b4074205815b3d0faf5c5b9e0599425f1cfac1043e8694bfceef78bab952'],
    ['./js/rendu.js', 'c7f545ef0fdefd8120c9f4eb03bd7b321877509e379955de85f57325b2e9ce37'],
    ['./js/securite.js', 'd76de55bb8fd6b4bce36d31af62d2fc811646318999eecae0d94e5173f0908fe'],
    ['./js/version.js', '56656fd040e8cfcdff9cc54ec8bd7815506ff0f1fc522439aecd859ac5fb458c'],
    ['./libs/d3-v7.9.0/LICENSE', '3e6849627f74ff73c257a3ae1efb574015d94fc1035c05ec3c15805165efcbc4'],
    ['./libs/d3-v7.9.0/d3.min.js', 'f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539'],
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
    ['./libs/dsfr-v1.15.4/icones-dsfr.json', 'c85a8d6a3f6f988748d8ee7a416fbe67ce24cb4adda23f8e2e519689f6dcfc2c'],
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
    ['./libs/topojson-client-v3.1.0/LICENSE', '4c4d15b635e04e691825a76db7d33f7f2033b55669a7430011694f31e6c65999'],
    ['./libs/topojson-client-v3.1.0/topojson-client.min.js', '25cd02ae486cc5063e0215a4e4cfb15de83700c87ac48bac4d57dc6aaf3ebb89'],
    ['./manifest.webmanifest', 'db470640d46619c11c0e76cadd1b55f404bb2b1d11dba166d1079b51df7343c1'],
    ['./sbom/fusain-sbom-cyclonedx.json', 'dfeeb89cf3358f273223030e0c8df335e4781e50f4058871cf446cb3df6aa38d'],
    ['./schema/fusain.schema.json', '839ce30901c0ab12e44e189d7d3dc27d593eab3185ab6eaabc0cc7dcb901eb17'],
];
// Fichiers lus seulement quand une page en a besoin : même contrôle, à leur premier téléchargement
const A_LA_DEMANDE = [
    ['./cartes/adresses/01.json', '2283eddbe6ce79d2a7efa954fe9f9c0b866459fd95e0e6f9c6a72871733aa7d2'],
    ['./cartes/adresses/02.json', '0a46b6de8ef5a70af8de7701757c7fa046c449bbd61f2c2ac605739579215976'],
    ['./cartes/adresses/03.json', '7d46af1c9de03a5247b431f93090ea71ef1302efff0f8a038c4ff771932e3fb3'],
    ['./cartes/adresses/04.json', '8e6b82711069e8f1e520cf2d2b2c8b983693c4ad3a7599e046912c95a0f3f044'],
    ['./cartes/adresses/05.json', '118dda4577de323f23db054e0b300e93e2eeb9df49a4d6abb436cc7289ec6d1b'],
    ['./cartes/adresses/06.json', '4afc5d6ce6aff30b48079a23e149ed7453d04f2d8dfe8c7e0c5b4383f3401cc5'],
    ['./cartes/adresses/07.json', 'b18db3dfce6ed0652bb077207ed98560f248290c7f7614526743d289d7f93a79'],
    ['./cartes/adresses/08.json', '722e8ff749ac8436eba25967d858480c72e16026d07bf908308d73f651fa4cab'],
    ['./cartes/adresses/09.json', '1a228f75c4909f3be8e767b70d3585b5cc88dec375f4e33fc371779ac7a5c579'],
    ['./cartes/adresses/10.json', '21a6675636d3c5131502a86c098c6a80851389c1d6c7d5edd4029774679cc520'],
    ['./cartes/adresses/11.json', 'b34de109be038a6bdf47a88a3fc9a4c12ab598f76e1e51e16350df54f34950ed'],
    ['./cartes/adresses/12.json', '38b87b8cdd130f097b2f69a7420dfc6cc3e8c1a10f65afa1aad3a3d4faa8d9a6'],
    ['./cartes/adresses/13.json', '8c4b8df4c839fead442003d35a90b2a781080c35471d69f6d7bf78ab4ba99041'],
    ['./cartes/adresses/14.json', '742e2dd3f12681df32be857c1393661aba519a1695be048f2cd5ccabf6a24ba1'],
    ['./cartes/adresses/15.json', '425c7a2f1a0f995d224386ed70baeeeab24cb3be6f3c3438c147342f7d162afc'],
    ['./cartes/adresses/16.json', '58f2ef0e671ab4fccdb58dd9d0729cb2ffd408fedbc03f0707f5e9008878f16f'],
    ['./cartes/adresses/17.json', 'f29ebb94ec5d5692316ec8fa50e10bcc192d0b98a312d68fcf90397de6b91eb0'],
    ['./cartes/adresses/18.json', '4a5871db46b67945cd274dad8a786f4706c3d47b7e59da50ace8356c27163070'],
    ['./cartes/adresses/19.json', 'da88078929baba718f7c649b34da029ede122afdf8000bc59a9bd7d95cacfeec'],
    ['./cartes/adresses/21.json', 'cc7afefb838650fde17d77f53d0ec346e2609a22c5c0bcec008fdad0eb385ea1'],
    ['./cartes/adresses/22.json', '0580b459b98942a696aec5b14b8fd2c67232d8a2e5e950b06f872b4c433b86b2'],
    ['./cartes/adresses/23.json', '54d50b76e836426bf8309183e6dedd9bab34dceab1431d9f2e4ca2851d28ebde'],
    ['./cartes/adresses/24.json', '01d27682da30ea27e0a68844284201bbf3ccc1089012ada7f39dd6947e506fc4'],
    ['./cartes/adresses/25.json', '9b4e041c7a7ced8e4bc6632f505deb7b8f27ba6708c5d48ec244192cbbc4b89b'],
    ['./cartes/adresses/26.json', '4b90958e4355efc2f9ca7c1b1c6b441c82b8c5d52e0e583718462b8d5bc1121c'],
    ['./cartes/adresses/27.json', '510f219919d31be60f9c8aa3d9a003b98f0084d599f9d8a5bb5fe5a9b0bbbe7f'],
    ['./cartes/adresses/28.json', '5c22db51b15a5c3b1764574912a205950f601eb3b48a3cc6074776aeee25d7bc'],
    ['./cartes/adresses/29.json', '754389b680668b94a26a19a7a15f6ef19d945dc40dd070f7a38c4f57a195aac2'],
    ['./cartes/adresses/2A.json', '6315b324eead8c13b2846c76c1994bb38683758bce6dc85e96dfc577f08cd0f1'],
    ['./cartes/adresses/2B.json', '3ddd7af0a0d06bc1582cd598e50425e494a103b9236b6d77d120b4c0e88b6c58'],
    ['./cartes/adresses/30.json', 'acd7ecc90754bb20498bee793d75cd0971bac1b5b9c9fa54293553d4b31e5140'],
    ['./cartes/adresses/31.json', '22f8e7a44cdde0668829d6171ac1abe829f02fc2bf662f100d81fa6a08e26acd'],
    ['./cartes/adresses/32.json', 'aef8ba1d66e01562ede33bc40de330303ca008cea9f5e44e8018d07fa1b7fdd3'],
    ['./cartes/adresses/33.json', '6ac97a1daa0452ecc6c1f29e971868ce9d69f055e8c4f8650eecd62901a19e70'],
    ['./cartes/adresses/34.json', '73e9d3d41808201a3874ade18a9e7cc22f51aeb763d1f1c92feaa7bac0aef817'],
    ['./cartes/adresses/35.json', '4aa91d6bd59ff2846cb610781b5e07e4a02575568ae090ad41bcf10c7e6327f6'],
    ['./cartes/adresses/36.json', '8a08857edda73f0fee30f27db7188d62bb3c9397a6e6cff95b6bdcce04ee3ddf'],
    ['./cartes/adresses/37.json', 'd27d516d2814b06cf1e909b63896493eb8bc5cf9ad8ebf52a8f0a97be47a856d'],
    ['./cartes/adresses/38.json', '6584b5145179606b584a7d0a4d782b8cab48393e7327baa64fe8e1f65819ed2d'],
    ['./cartes/adresses/39.json', 'fd7f55384fa79ae18d196ccf46f7bb119c82335661ee17bdbc99c8f8f8ac3c69'],
    ['./cartes/adresses/40.json', '8f5bc21c6a76867f309f1e7904732fdd67742c9edbcdb83f9e00818103c49b0b'],
    ['./cartes/adresses/41.json', '7ddafc244e5bcfe736d29e68d8b8f12bf853c6c5050de800703490ce244fa3fc'],
    ['./cartes/adresses/42.json', 'd9f9f14a4a3f5ff5cc476b551bc1db4997fbc84da40e47b455b827db7885957f'],
    ['./cartes/adresses/43.json', '44d98fa8254f386a427dda243f7b8e69010564c03ad968512f3c0da1f4e7a849'],
    ['./cartes/adresses/44.json', '170268bc7429305eb6f696ba7c957073f931259618c5c607d9d26944123d6259'],
    ['./cartes/adresses/45.json', 'c6e02597bba820573f4bcf77a231e3b92866f38ee9225d4b1b1f54885de27eb8'],
    ['./cartes/adresses/46.json', 'f35f614469250b6afd987f89274d5747e73e1fbf57ea25e885fc81f7267090ee'],
    ['./cartes/adresses/47.json', '630128fa8473c517a1c605dad047e9d0ff95ae096f096e982e710ae8d5fb8e2e'],
    ['./cartes/adresses/48.json', '8012885c82fd03ad121b53bbb40850476fa8490a64f9ef013fab3d25e2cab7e4'],
    ['./cartes/adresses/49.json', 'e201b76138116df9a0a20f372a5353ac600fbfb17bad5c04e072eb0dcf6e2221'],
    ['./cartes/adresses/50.json', '49a55f9e0068e9238a6faf97ec5bf9323335f66abd689a2613ad3c34c4d91dac'],
    ['./cartes/adresses/51.json', '9a3c90c8a238054f0f30ac10211c97a9f2d5f302d22a7323eaaedd2605432d1d'],
    ['./cartes/adresses/52.json', '0c87673d3012656dbd1a52c518a1eb1fb71c82262c2065a2fd3aabe80c0a72cb'],
    ['./cartes/adresses/53.json', '327f3aee2cfe8ddf49cd0f4938c0cbdd142cc91b1f399fc1c75d3dac027ef814'],
    ['./cartes/adresses/54.json', 'c51faa29292bb21749f0ada5ec19b98a6ff3fd36a20c00c2c599305fd198a06e'],
    ['./cartes/adresses/55.json', '529ca6e42a48eff95aa41e892781ca6c4fe00a9926e9025e01e67b4c3b37538d'],
    ['./cartes/adresses/56.json', 'e36e15853c53d464f46d7ec5235eb516a9b42f077d2c37b5e577c9dc3a1e8e30'],
    ['./cartes/adresses/57.json', 'b30a53ade7cac884fd216c60ba9f778d5371ae13147046236b55f6a5b7ce17ff'],
    ['./cartes/adresses/58.json', 'f3758debbfa4db3785ef8d94be476a2df360b7289400b6ba215789e931a0a994'],
    ['./cartes/adresses/59.json', 'd025db4c7b74a69b3d7f5b81429421170dd043050fe5640da7cc1fdd53c5fbe6'],
    ['./cartes/adresses/60.json', '0b5d49ba4192034729fddca7cb4d04f0606a7860b9b19537d84c2820bd88ff50'],
    ['./cartes/adresses/61.json', '6cce3a5f68fbd2176b2eaed106c0691f5de679938e4f209c3039b43fc6e3b094'],
    ['./cartes/adresses/62.json', 'c36c67a3fae30084ff7f598bceea6cb5fee96180b0912a67b114e981f48fe7da'],
    ['./cartes/adresses/63.json', 'cb21bdd26e13dabccd608c340d082664f3f460f71357d4b55d801d12e26e700f'],
    ['./cartes/adresses/64.json', 'feeed702ce5dafab94b625d517386b61dfc3cb717ab23f018632bb8cfad18823'],
    ['./cartes/adresses/65.json', 'fb8bc90e6e7899c0841754af301df053971b10705acd6163448a8da1322ad5f9'],
    ['./cartes/adresses/66.json', '39fc402c46c11d3f02f61174f6063c444988a560ead099e6c2a31ac62f54718d'],
    ['./cartes/adresses/67.json', 'e36dc25d107d31d58b59606efff419922d753f8f271fc3cec5c9240659b1ef63'],
    ['./cartes/adresses/68.json', '1a3ca73eca8eb565c81b657a599f53539dc950e5cce06a1a814e0d61d7423676'],
    ['./cartes/adresses/69.json', '6e4cecbcf6865421c9af92a1b472c6ab24364d9aeff802f3d0e829a7daa8dc22'],
    ['./cartes/adresses/70.json', '0e096228fdad146aa5c0b9e6517a1d6cee1319ad1a883d2b8983d0d1859e3623'],
    ['./cartes/adresses/71.json', '7833b05fa8c02b0775516cf30218add9b9fa23d19af4e89c3eb65235c1e7aab8'],
    ['./cartes/adresses/72.json', '0a1817667512e1a181b3dd57c8fb5325979a44dc26fd0b7039608357cc833c49'],
    ['./cartes/adresses/73.json', '08d84f34488acc3de75a06029c96bf7d67a68508fbde88e6b7bfcec102c647c5'],
    ['./cartes/adresses/74.json', '050571cbb29c6453cca16600c18f93b689ca069d321fd4cef434d8d997748f09'],
    ['./cartes/adresses/75.json', 'b3595b04eb46e7b64f53bf365d773416cfd6a9ed3d220836c33413f8d88d416e'],
    ['./cartes/adresses/76.json', 'd96d310c798095dd3b021d1fdf1c809c0bf11186116394c59c52307b8e276476'],
    ['./cartes/adresses/77.json', 'b15f8300b1b1a1dae59144eea013165e737b0b93f06c1cb735dec5c8b0f0986b'],
    ['./cartes/adresses/78.json', '66e10397e3340150cdd29e90c0e0e9fbba782600b3832940de482e59f7c7114f'],
    ['./cartes/adresses/79.json', '595c1bef3dff000db28f77acad3ca612710f4bc7bab5067956443949eed6d11a'],
    ['./cartes/adresses/80.json', '14f51ac251aff88156a41f2ef20e8b528685025d133e48f6cd6da58aa41881ff'],
    ['./cartes/adresses/81.json', '42911b02dd65f5523e3e41297ef6b305267d04785b868a8b8629a15f675bcd63'],
    ['./cartes/adresses/82.json', 'd431b511d1679fc8254b3f0f1292bebd77c253abe3e5ca85d4b3e302c46b0d90'],
    ['./cartes/adresses/83.json', 'fe8aa9f9cab46d5b800d1f2e355196eed8dce644cceb8918603dfa8fc908f787'],
    ['./cartes/adresses/84.json', '8d89816ade28fba3301b2feeb5172d57579c7e6595e0f905bc52db1cd6f80914'],
    ['./cartes/adresses/85.json', 'e03f062c16437d4f1198d9b49f3085f879493372972b442b694b1a6eb51a1ba0'],
    ['./cartes/adresses/86.json', 'aa9a186cca1a225bd5301142403c1d4b65acc1f37c87da5bad6b0f1d08710c14'],
    ['./cartes/adresses/87.json', '89badede868c573963a79a0f9be4a3f11d92371041aa51b5de27961c078aab7d'],
    ['./cartes/adresses/88.json', 'b1a968b7445aed626e68329c26db9460a3e0613b72d107c950f5e4dfdc11c590'],
    ['./cartes/adresses/89.json', '52ad91eb84b44b0639c366a43a6cc661f22fb193e213ab8e89cfcdef7b22f07b'],
    ['./cartes/adresses/90.json', 'c90e95d9a64f9bca790f6f133bc39fe314b721f4f5a71af724ec1a5bac765357'],
    ['./cartes/adresses/91.json', '3c3f7bdf219797b539badc876d934463e79bff7a247d959386481946637118bf'],
    ['./cartes/adresses/92.json', '72768d4c8d5352762e057f43153946df62b7e0bc45786c6e080cfcaaa6992a5c'],
    ['./cartes/adresses/93.json', '44f4b9d75817719c967d741e5d338e195a5636c12fae4c22f2dc7e8d24f8ded7'],
    ['./cartes/adresses/94.json', '513cfef54dbcd31641a6b52b5e696d6eb7b7127ceea865929b66681891fc1d67'],
    ['./cartes/adresses/95.json', 'a9de35d8e670b0b813cac5e9b0533ba022043431c1d7f6ce2977d1b06d8dd0f4'],
    ['./cartes/adresses/971.json', '84022790cccf004e4fbade4f1da33896413006bff82e389957a1291916d91246'],
    ['./cartes/adresses/972.json', '0a9c6f9463e61503f49ce6e245a44e0760e6d2c404171f5a1d5bdb3dc006a77a'],
    ['./cartes/adresses/973.json', '0e3eaf6fed0b58e378263afa542f602731b2caf4174d300720493a373056e975'],
    ['./cartes/adresses/974.json', '94c05ad6871a5b080f993e4674f34cd6ec0edeaba3ddbcf6d6c28f0a3c80c95e'],
    ['./cartes/adresses/975.json', '644fed2eca684771f36d61ef4bf447fe38917c296967f65b85704f8665c8cd01'],
    ['./cartes/adresses/976.json', '6314c1bc6e5afc4bc6f8bdf48132e19f4e2a1c78a3f47fb53e08a068198025a3'],
    ['./cartes/adresses/977.json', 'fbba16468a0cfc2722d4a3155547291baf39210fd7441c0b756cb7a00b6f81f7'],
    ['./cartes/adresses/978.json', '9170bcfef695f274c7f61a63530341bc79771ae9941620e66c4d7236c9b439d3'],
    ['./cartes/adresses/987.json', '37cdab6c001b57c4be1251ee5067372b88e7e1ddfbdf04293280ddad1f6ade3a'],
    ['./cartes/adresses/988.json', 'f618929ceec25562c610908d672db603db8a2aa815071fa3d0c56f065423dbd9'],
    ['./cartes/calques/hydro.json', '7577091d8eac0152b73c771faa2b73df22eef19ed57252e86c6fe212364e0549'],
    ['./cartes/calques/rail.json', 'c3ac8988dd84fbb70cf5a10b110aaeb2ecf8027dad56c7284395ba194adf790d'],
    ['./cartes/calques/relief.png', 'ec088ab9c14ba59917edd6f1c8f63d6201d9a921858350419dc47f589e27c185'],
    ['./cartes/calques/routes-autoroutes.json', 'f061cf35c2e9b2114b3fbcf5dc626638048cf03da97780c9f77021b77a46e34c'],
    ['./cartes/calques/routes-principales.json', '99ffe10a4166a8dabcb6d130f4154b7976e2596606a3733c5db75e96934cceeb'],
    ['./cartes/calques/routes-regionales.json', 'f37cccc0ccd8a19848e2cdf82d5c399a4246329c7a953f9a46832f3d52863c23'],
    ['./cartes/calques/routes.json', '1bbc6b7d19c5ad9f96d1f39a3aaee62d8c241a21dc23ea5f62b7638751d43580'],
    ['./cartes/communes/01.json', '71874784c40a254d8c63e06df2239b80c5edc5a4d174bfaab7024f1df2c3aab7'],
    ['./cartes/communes/02.json', '3eea38113a3daf3ac2f8c7445b2dd8c841c4935b32979896057d06e1a1d1aa12'],
    ['./cartes/communes/03.json', '3820a0d0a8a59b45cbb9a1b15644fc50f57d95d278610455c554b9877a449768'],
    ['./cartes/communes/04.json', 'eeadf552c854e732f7254a6c296f9879e29d01bbd22844012a84b3bbc90bfeb4'],
    ['./cartes/communes/06.json', '56c32d259b0b0c7418d99a03c74471493562a62f9510e9187698faa196e86606'],
    ['./cartes/communes/11.json', '39a9df850726ac3fd7d993dacc6854e7ad5c82754635e6b1a7810cc7943ce8d9'],
    ['./cartes/communes/24.json', 'b4135a2fc7aee9035ba4a1cdfa20028340206aa36b23977a028fea989031d622'],
    ['./cartes/communes/27.json', 'cac8b549409e4be8290bf966bbfb18aff4029c52da689d55254c703633d1be74'],
    ['./cartes/communes/28.json', '6aedf71c06d75b781ba5358a1c80c2ad3ce929fe3d4d42ba4946654a6ebded1f'],
    ['./cartes/communes/32.json', 'cbc9a61504e3dd1a774c4aceb1c7151c5d700ebd23c226b953696e8b5a101f81'],
    ['./cartes/communes/44.json', '9f5034ea1d415df0cded5814dcbefbb5afdd4db1fe81f8d97bb2998dc1cd8b94'],
    ['./cartes/communes/52.json', 'ba804068f89648cfb86acc8830cbb7640776c01f42b0c4e08dd2eef5405b2fe9'],
    ['./cartes/communes/53.json', 'efcf594529947654cbb8082b71ee8722de60466281717b5a23079d5d324143b6'],
    ['./cartes/communes/75.json', '0bcf1a8e4b328427700d3f445b6ed8411c3141499c948ba18d95a0d6acaae038'],
    ['./cartes/communes/76.json', '9d5c8a1786a867cdb2c0e9161169fbe958d15d17ad6966d2b6b646962b01b482'],
    ['./cartes/communes/84.json', 'e92b17ba4e893ee071783c34d4ecbf18a425ccd5eb9c9d15987097fe6b5b64ce'],
    ['./cartes/communes/93.json', '151d0dc3d83865c99be316daf565845e77fdf9e572db9253a312cf2ac6f43db6'],
    ['./cartes/communes/94.json', 'dc222e814599bf6f5a4523a4b2ed89bfa45e463d77a03f5988fc45c03458ee45'],
    ['./cartes/exemples/france-communes.csv', 'faefaa5cb6281870fa705c8fdae11bbb40943cd9c888afc1efefb4846678b12a'],
    ['./cartes/exemples/france-departements.csv', '72276930e321b54effe23724de5bcf79fa8d5a1f9bbbe8eae31f9f43ba1d3fc3'],
    ['./cartes/exemples/monde.csv', '54212ab768b41c88ecc6c8999c930bc4feae159d25815f89751da285bdc7c637'],
];
const CACHE_ADRESSES = 'fusain-adresses-a831bc5a2a';
/* FIN-GENERE */

const CACHE_DONNEES = 'fusain-donnees';
const EMPREINTES_A_LA_DEMANDE = new Map(A_LA_DEMANDE.map(([chemin, empreinte]) => [new URL(chemin, self.location).pathname, empreinte]));

// Chaque fichier est vérifié avant d'entrer dans le cache : si un seul ne correspond pas à son empreinte
// (fichier altéré, publication incomplète), l'installation échoue et la version précédente reste en service.
async function telechargerVerifie(cache, [chemin, attendue], cle = chemin) {
    const reponse = await fetch(new Request(chemin, { cache: 'reload' }));
    if (!reponse.ok) throw new Error(`FUSAIN : ${chemin} introuvable (${reponse.status})`);
    const condense = await crypto.subtle.digest('SHA-256', await reponse.clone().arrayBuffer());
    const empreinte = [...new Uint8Array(condense)].map((o) => o.toString(16).padStart(2, '0')).join('');
    if (empreinte !== attendue) throw new Error(`FUSAIN : intégrité non vérifiée pour ${chemin}`);
    await cache.put(cle, reponse.clone());
    return reponse;
}

// Fond de carte lu à la demande : rangé sous une clé qui porte son empreinte, il reste valable d'une version à l'autre
// tant que le fichier ne change pas
const cleDonnees = (chemin, empreinte) => `${chemin}?empreinte=${empreinte}`;
async function servirALaDemande(chemin, empreinte) {
    const cache = await caches.open(CACHE_DONNEES);
    const cle = cleDonnees(chemin, empreinte);
    return (await cache.match(cle)) || telechargerVerifie(cache, [chemin, empreinte], cle);
}

// Adresses d'une commune : leur empreinte n'est pas dans la liste ci-dessus mais dans l'index de leur département, déjà
// vérifié ; la page la transmet avec la requête (attribut integrity), et le fichier n'entre en cache que s'il y correspond
const ADRESSE = /^\/(?:.*\/)?cartes\/adresses\/[0-9AB]{2,3}\/[0-9AB]{5}\.json$/;
async function servirAdresse(requete) {
    const attendue = requete.integrity;
    const cache = await caches.open(CACHE_ADRESSES);
    const cle = `${requete.url}?integrite=${encodeURIComponent(attendue)}`;
    const enCache = await cache.match(cle);
    if (enCache) return enCache;
    const reponse = await fetch(new Request(requete.url, { cache: 'reload' }));
    if (!reponse.ok) return reponse;
    const condense = await crypto.subtle.digest('SHA-384', await reponse.clone().arrayBuffer());
    if (`sha384-${btoa(String.fromCharCode(...new Uint8Array(condense)))}` !== attendue) throw new Error(`FUSAIN : intégrité non vérifiée pour ${requete.url}`);
    await cache.put(cle, reponse.clone());
    return reponse;
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
            .then((cles) => Promise.all(cles.filter((c) => c.startsWith('fusain-') && c !== VERSION_CACHE && c !== CACHE_DONNEES && c !== CACHE_ADRESSES).map((c) => caches.delete(c))))
            // Les fonds de carte qui n'appartiennent plus à la version sont retirés
            .then(() => caches.open(CACHE_DONNEES))
            .then(async (cache) => {
                const valides = new Set([...EMPREINTES_A_LA_DEMANDE].map(([chemin, empreinte]) => new URL(cleDonnees(chemin, empreinte), self.location).href));
                await Promise.all((await cache.keys()).filter((r) => !valides.has(r.url)).map((r) => cache.delete(r)));
            })
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
    if (ADRESSE.test(url.pathname) && requete.integrity.startsWith('sha384-')) {
        evenement.respondWith(servirAdresse(requete));
        return;
    }
    const empreinte = EMPREINTES_A_LA_DEMANDE.get(url.pathname);
    if (empreinte) {
        evenement.respondWith(servirALaDemande(url.pathname, empreinte));
        return;
    }
    evenement.respondWith(
        caches.open(VERSION_CACHE).then(async (cache) => {
            // Seule l'adresse de l'application rend la page d'entrée : les documents joints (guide, cahier des charges,
            // nomenclature) ouverts depuis « À propos » sont des navigations vers leur propre fichier
            const racine = new URL('./', self.location).pathname;
            const cle = requete.mode === 'navigate' && (url.pathname === racine || url.pathname === `${racine}index.html`) ? './index.html' : requete;
            const enCache = await cache.match(cle, { ignoreSearch: true });
            return enCache || fetch(requete);
        }),
    );
});

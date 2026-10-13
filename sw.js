// FUSAIN — service worker : cache pré-rempli et versionné, fonctionnement hors ligne (cahier des charges §4.4)
// La liste ci-dessous est produite par outils/generer.py : rien n'est mis en cache dynamiquement,
// et rien n'y entre sans que son empreinte ait été vérifiée (cahier des charges §7.6).

/* DEBUT-GENERE */
const VERSION_CACHE = 'fusain-0.4.3-65f8c51a9c';
// [chemin, empreinte SHA-256] de chaque fichier de la version
const FICHIERS = [
    ['./Documentation/GUIDE_UTILISATEUR.md', '29857eb31978a2b0664acceb11ee73f9d88558d061b7da7457b48f2744af293a'],
    ['./FUSAIN_cahier_des_charges.md', '51f30086dbfbb240b6341a9bb2ec05013078a1c52529cd6507455ae4fad93188'],
    ['./JOURNAL_DES_VERSIONS.md', '7fedcc79a8b0174616aa7b1a67f1a601b1a056ef95de1a81f2172a6d3d1ea6ba'],
    ['./NOMENCLATURE_LOGICIELLE_FUSAIN.md', 'a0f9fe6e191a619a87dba4276cdf4761c7807169e933ef764726e9ec830cc5aa'],
    ['./css/fusain.css', '5091c5480f9e5994ad84ab3a8ff1468b386190a00942b632724bbf2c391f046c'],
    ['./icones/fusain-192.png', '799ed7660947f98cd3dca9bc24c8471ed2be1fb186c544a1a2f40788930e5a64'],
    ['./icones/fusain-512.png', '5305d17891b39cef137db3273833527db43460ba67be57d569888016df709a1a'],
    ['./icones/fusain.svg', 'd08a962fa1876ac73c1d7991d1850d5673ea70bf960953c69b4d9f89c7dc01ef'],
    ['./', '794c6d16b4d4d037de693f77d3b81d5c51dafe3b262a1d0e9b295f9f11b93c70'],
    ['./index.html', '794c6d16b4d4d037de693f77d3b81d5c51dafe3b262a1d0e9b295f9f11b93c70'],
    ['./js/app.js', '5c4660412b085c03f520dc67929c9a6a654abba4369c35f5efcc552b4ff85d55'],
    ['./js/brouillon.js', '185d325849e3485aa8a62f91b66f3e504a5e4f34689d66fac892fb512b0a53f3'],
    ['./js/confiance.js', 'f6d2946867a80aa169ec3777075a8f2fef496a954108a1494daac6cda3afec88'],
    ['./js/diagrammes/camembert.js', '6952c8836036381113ceb03cc599fefe68e9f601c5dee1de1faeb8b08740d986'],
    ['./js/diagrammes/commun.js', 'f1383c2d098b87ae37a2251aa4793f1d8f80ca1ab6a902418a0ad19105010b6f'],
    ['./js/diagrammes/etats.js', '7bd2fb519f8380a684227e88fd91fafbe85a6b46218cc318acac987411f70cc7'],
    ['./js/diagrammes/frise.js', '34223332b4b649593da06cc6d1741f54366edcb2d26ae88bbad80ea02474a8d4'],
    ['./js/diagrammes/gantt.js', 'b22c669088374d9de3bfe16b4cf2197bca5af9975abd58256d726c13f8ce1da5'],
    ['./js/diagrammes/index.js', '178234663b65fae72c2a47f907cf3f3e284d96755b74223e6c1861c188ef10b2'],
    ['./js/diagrammes/kanban.js', 'c1f4995552f040f945d4cf45d3458b8299382ecb5c4bbd88e7aa16809a5b6fda'],
    ['./js/diagrammes/logigramme.js', '40623d93df3a9106f3d6596fcd20a633fd83e02e41256f63249c626241afc54f'],
    ['./js/diagrammes/mentale.js', 'd27e5699c65bc10e29d9c767da73038403d4356aa14a0fc192b1eb27cc4d5fed'],
    ['./js/diagrammes/quadrant.js', '8250f0f45fc2d8bd700524a5f9bada4d650341630a9195bc5b5ad796fb692778'],
    ['./js/diagrammes/sequence.js', '0e06abf428c810ed88520160011c7129374ab0ca318abbff9265d2d0021311c8'],
    ['./js/dom.js', '8c514120093236dcf7e843d2d073857f0bda91e5252e002be6ab29dbbfd9c957'],
    ['./js/etat.js', '76f6d4ff0f6299c2e6d64221e0a287dd4ab5bea73612031c3cdfe9e1770d0082'],
    ['./js/export.js', '2c58ee572ffc2b49e94cec3ed864a61ad58c8291f7920f71d2ba624a6e1341c2'],
    ['./js/fichier.js', '2a25b930069c412777c38d8e14e93af4ae9231817e9b1bbd99fa1bd589df6712'],
    ['./js/formats.js', 'a9fe7e27d095f75c0eab899f083747f0b9c24b53699f754d368b5d952f2a5687'],
    ['./js/modeles.js', 'fcaf64c5a090f5114239a97523abcd20eb57280719317e083236f3f56e6f2170'],
    ['./js/rendu.js', 'eddefc80866e0c9217c054cb748ef026f5521d7a8c589a0aa5868347d1a0d2b8'],
    ['./js/securite.js', 'c572f2c6c34425f5fddfc88ab6d8701836a8b51c43bb6ba3f5fa130f37092921'],
    ['./js/version.js', '5592a9564c9aeee89a45d2d1600794addb2551dc6b7a8e2a6e955285d0ad4a8a'],
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
    ['./libs/svg2pdf-v2.8.1/LICENSE', '04db7fb792d065c8c9a0e3a7a8255cd36e32b263ca023cbea10daee4a45132b8'],
    ['./libs/svg2pdf-v2.8.1/svg2pdf.umd.min.js', '2f10c0d16959e9a0c4cfd8605cfce0830ddc384337f74fa0351a6eff1c1efb8b'],
    ['./manifest.webmanifest', 'db470640d46619c11c0e76cadd1b55f404bb2b1d11dba166d1079b51df7343c1'],
    ['./sbom/fusain-sbom-cyclonedx.json', '7a211e9ded6b06ce730b6d4912ca659aceef60fb12cc17e00c5aeaf11019f9da'],
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

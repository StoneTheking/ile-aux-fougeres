# L'Île aux Fougères — fiche de passation

Projet de jeu d'énigmes à la première personne, dans le navigateur (Three.js r128). Cette fiche est destinée à Claude Code : elle reprend le contexte d'une longue conversation dans l'app Claude.

## Vision (demande d'Omérine)

- Jeu à la première personne, style A Short Hike / Zelda Wind Waker / The Witness, ton poétique façon Outer Wilds. Pas d'énigmes pour l'instant : on construit les mécaniques d'abord.
- Direction artistique actuelle : **cartoon** (arbres en touffes rondes, palmes dentelées), lumière et couleurs inspirées de Firewatch / Sea of Thieves. « Les couleurs c'est bien » : ne pas toucher à la palette sans demande.
- Jeu **sur ordinateur uniquement** ; la performance compte quand même (elle a demandé d'optimiser).
- **Pas de messages à l'écran** hors interactions (invites « E … », dialogues, mini-jeux, carte de prise de pêche).
- Tous les textes du jeu sont en **français**.
- Elle aime qu'on s'inspire de ressources trouvées en ligne et d'assets gratuits (CC0/MIT).

## Lancer le jeu en local

Le jeu charge Three.js r128 et GLTFLoader depuis des CDN : il faut Internet.

```
python -m http.server 8000
```
puis ouvrir http://localhost:8000/index.html (un serveur local évite les soucis de `file://`).

## Architecture (ordre de chargement dans index.html)

| Fichier | Rôle |
|---|---|
| `world.js` | Rendu (renderer, post-process, brouillard directionnel `FOG_FRAG`), terrain (heightmap 301², érosion, `heightAt`, `slopeAt`, `coastDist`), eau (shader vagues/ressac/écume/reflets), ciel (dégradé, soleil, lune, 2 couches de nuages, étoiles), géométrie procédurale (`GB`, `tube`, `cluster`, `palmLeaf`, `skirt`, `cleaf`…), toutes les espèces végétales, placement en tuiles instanciées avec LOD (`scatter`, `buildE`, `seat`, `updateVegLOD`, `LODD = 75`), vie (oiseaux, lucioles…) |
| `village.js` | Village pirate (`VILLAGE`, repère `vp(u, v)`), taverne enterable, maisons et accessoires (éditables), murs/sols (`WALLS`, `FLOORS`, `floorAt`, `groundAt`, `collideWalls`), PNJ (`makeNPC`), dialogues à choix (`DIALOG`, `openTalk`, `dnode`, `TALKFX`), mini-jeu banjo (`BJ`, chanson « Drunken Sailor », touches D F J K) |
| `models.js` / `assets.js` | Modèles .glb des exemples three.js (MIT) en base64 : perroquet Capitaine Coco, flamants roses |
| `sea.js` | Voilier (`BOAT`, `updateBoat`), pêche (`FISH`, `SPECIES`, `gFish`), plongée (`DIVE`, `setUnder`, `applyUnder`), vie marine, sauvegarde de progression (`saveProg`/`loadProg`, clé `ile-prog1`) |
| `extra.js` | Mini-jeu de la tortue (`TT`, Caramel, Bartholomé), phare + professeur Anselme et ses améliorations (`G.up`), scène d'arrivée (`startIntro`, `updateIntro`, Lila) |
| `game.js` | État `G` (dont `G.mode` : walk, boat, diveIn, dive, surfacing, turtle, intro), joueur, entrées, bras façon Firewatch, objets tenus (pelle, boussole, longue-vue, lanterne L, montre M, canne, fruits, galets…), roue d'inventaire, terraformation + éditeur d'objets (onglet Objets, clé `ile-edits1`), audio synthétisé (WebAudio), boucle `frame()` et `boot()` |

Tout est généré par code (aucun fichier 3D externe hormis les deux .glb). Couleurs de sommet + `MeshLambertMaterial` patchés via `onBeforeCompile` (`mat(o)`). Une couleur de sommet avec r > 1,6 devient lumineuse la nuit (fenêtres, lanternes).

## Tester sans écran

`shot.py` (Playwright + Chrome headless, rendu logiciel) charge `test.html` et prend des captures. `test.html` se régénère depuis `index.html` en remplaçant les CDN par `node_modules/three/...` (voir la commande `sed` dans l'historique, ou adapter). Helper `window.sim(n)` pour avancer de n images sans rendu. Le rendu logiciel est lent (~1 min par capture) et fait baisser la résolution adaptative (`window.RESK`).

## Publication

Le jeu est publié comme artefact claude.ai : https://claude.ai/artifact/Va25Gjd89VEc3i6ys3tYo2. Depuis Claude Code, il suffit de travailler sur les fichiers locaux ; la republication se fait depuis l'app Claude.

Un doc de suivi des assets (cases à cocher) existe aussi dans l'app : https://claude.ai/artifact/2KSpWyWXx7CeSj1ShQZVDn

## État au 15/11/2026 (version 6)

Fait : île, eau, ciel, végétation cartoon avec LOD, village + taverne + 11 PNJ + dialogues, banjo, tortue, voilier, pêche (7 espèces), plongée + vie marine, phare + améliorations, scène d'arrivée passable, montre/lanterne/longue-vue, ramassage de galets et coquillages, terraformation + éditeur d'objets, optimisation (LOD, ombres 1 image sur 2, résolution adaptative).

Pas vérifié en vraie partie : améliorations du professeur, débarquement/remontée de plongée, super-rebonds de la tortue, longue-vue, pentes, éditeur d'objets, orientation des flamants.

Problèmes connus : la caméra de poursuite de la tortue peut traverser les feuillages ; la tortue peut partir vers la jungle si la plage tourne.

## Suite prévue

- Énigmes (le cœur du jeu, pas encore commencées).
- Remplacer progressivement des modèles générés par des .glb travaillés ou gratuits.
- Sauvegarde complète de la progression (fragments de poème trouvés, fruits…).

Les anciennes versions `world.v2/v3/v4.js` et `game.v2/v3/v4.js` sont des sauvegardes, non chargées par le jeu.

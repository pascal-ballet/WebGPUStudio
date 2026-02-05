# TP1 — 10 exercices WebGPU Studio (WGSL débutant)

Ces exercices sont pensés pour des étudiants de Master qui découvrent WGSL **dans WebGPU Studio uniquement**. Chaque exercice est court (30–60 min) et progressif. Tous les sujets utilisent **compute shaders**, **buffers**, **passes**, **pipelines** et **paramètres** (uniformes).

## 1) Pipeline compute minimal + buffer de sortie
- Objectif : comprendre un pipeline compute qui écrit dans un buffer.
- Tâches :
  - Créer un **compute pipeline** minimal.
  - Déclarer un **storage buffer** de sortie (ex. `array<f32>`).
  - Écrire le même nombre (ex. `0.5`) dans toutes les cases.
  - Lire/visualiser le buffer via WebGPU Studio (outil de lecture/inspection).
- Bonus : écrire l’index du thread dans le buffer.

## 2) Paramètre constant simple
- Objectif : utiliser un paramètre **constante WGSL** exposé par WebGPU Studio.
- Tâches :
  - Ajouter un paramètre `gain` dans l’onglet `Paramètres` (il sera généré en `const`).
  - Multiplier les valeurs du buffer de sortie par `gain`.
  - Tester plusieurs valeurs de `gain` en **re‑compilant** après chaque changement.
- Bonus : limiter le `gain` entre 0 et 1 dans le shader.

## 3) Deux passes compute en chaîne
- Objectif : comprendre l’enchaînement de passes.
- Tâches :
  - Pass 1 : remplir un **buffer A** avec un motif simple (ex. `i % 2`).
  - Pass 2 : lire **buffer A** et écrire dans **buffer B** (ex. inversion 0/1).
  - Visualiser **buffer B**.
- Bonus : permuter l’ordre des passes et observer l’effet.

## 4) Paramètres multiples (constantes)
- Objectif : structurer des paramètres via des **constantes**.
- Tâches :
  - Définir trois paramètres constants `offset`, `scale`, `bias` dans l’onglet `Paramètres`.
  - Appliquer la transformation `value = value * scale + bias + offset`.
  - Tester plusieurs jeux de valeurs en **re‑compilant**.
- Bonus : ajouter un paramètre `enabled` (0/1) pour activer/désactiver la transformation.

## 5) Buffer d’entrée + buffer de sortie
- Objectif : lire un buffer existant et écrire le résultat.
- Tâches :
  - Créer un **buffer d’entrée** initialisé côté CPU (ex. ramp 0..1).
  - Pass compute : lire l’entrée et écrire dans un **buffer de sortie**.
  - Appliquer une fonction simple (ex. `value * value`).
- Bonus : ajouter un paramètre `power` pour faire `pow(value, power)`.

## 6) Réduction simple (somme par blocs)
- Objectif : manipuler les indices et les groupes de travail.
- Tâches :
  - Définir un **workgroup size** (ex. 64).
  - Calculer la somme de blocs de 64 valeurs d’un buffer d’entrée.
  - Écrire chaque somme dans un buffer de sortie plus petit.
- Bonus : comparer les résultats avec une somme calculée côté CPU.

## 7) Ping-pong de buffers (itérations)
- Objectif : gérer plusieurs itérations de passes compute.
- Tâches :
  - Mettre en place deux buffers A/B.
  - Exécuter N passes qui alternent lecture/écriture A↔B.
  - À chaque passe, appliquer une petite transformation (ex. `value = value * 0.95`).
  - Paramétrer N via un **paramètre constant** (et **re‑compiler** quand N change).
- Bonus : afficher l’évolution d’une valeur au fil des passes.

## 8) Image 2D dans un buffer
- Objectif : comprendre un buffer comme grille 2D.
- Tâches :
  - Interpréter un buffer 1D comme une grille 2D (width/height en uniform).
  - Écrire un motif 2D (ex. damier) en compute.
  - Visualiser la grille via l’outil de preview de WebGPU Studio.
- Bonus : rendre la taille des carreaux paramétrable.

## 9) Compute + paramètres animés
- Objectif : combiner temps et paramètres.
- Tâches :
  - Ajouter un **uniform time** (ou paramètre équivalent de WebGPU Studio).
  - Générer un motif qui varie avec le temps.
  - Ajouter un paramètre `speed` pour contrôler la vitesse.
- Bonus : geler l’animation avec un paramètre `pause`.

## 10) Mini-projet : pipeline multi-pass paramétrable
- Objectif : réutiliser buffers, passes, pipeline et paramètres.
- Tâches :
  - Concevoir 3 passes compute en chaîne (génération → transformation → post-traitement).
  - Utiliser au moins 2 buffers intermédiaires.
  - Exposer 3 paramètres (ex. `scale`, `threshold`, `mix`).
  - Documenter clairement les buffers, passes et paramètres dans le code WGSL.
- Bonus : ajouter une passe optionnelle activée par un paramètre.

## 11) Damier 2D paramétrable
- Objectif : générer un motif simple dans un buffer 2D.
- Tâches :
  - Créer un buffer 2D (type `u32` ou `f32`) visualisable.
  - Écrire un damier 2D en fonction de `(x, y)`.
  - Ajouter un paramètre constant `tileSize` pour la taille des carreaux.
  - Re‑compiler après modification de `tileSize`.
- Bonus : inverser les couleurs du damier sur une deuxième passe.

## 12) Bandes diagonales 2D
- Objectif : utiliser une équation simple pour un motif.
- Tâches :
  - Écrire des bandes diagonales via `(x + y) % period`.
  - Ajouter un paramètre constant `period`.
  - Tester plusieurs périodes (avec re‑compilation).
- Bonus : combiner deux directions pour un motif en X.

## 13) Cercles concentriques 2D
- Objectif : manipuler la distance au centre.
- Tâches :
  - Calculer la distance au centre `d`.
  - Afficher des anneaux via `floor(d / step) % 2`.
  - Paramétrer `step` par une constante.
- Bonus : lisser les bords avec `smoothstep`.

## 14) Dégradé radial 2D
- Objectif : produire un dégradé continu.
- Tâches :
  - Calculer `d = length(p)` avec des coordonnées normalisées.
  - Mapper `d` vers une valeur [0..1].
  - Stocker la valeur dans le buffer (visualisation en niveaux de gris).
- Bonus : inverser le dégradé avec `1.0 - d`.

## 15) Vague sinusoïdale 2D
- Objectif : introduire `sin` et des paramètres constants.
- Tâches :
  - Créer un motif `sin(ax + by)` en fonction de `x` et `y`.
  - Paramétrer `a` et `b` avec des constantes.
  - Tester différentes fréquences en re‑compilant.
- Bonus : ajouter un terme `phase` constant.

## 16) Bruit en grille (hash) 2D
- Objectif : générer un motif pseudo‑aléatoire discret.
- Tâches :
  - Écrire une petite fonction `hash` 2D.
  - Remplir le buffer avec des valeurs aléatoires [0..1].
  - Contrôler la densité via un paramètre constant `cellSize`.
- Bonus : afficher une version binaire (seuil).

## 17) Damier 3D (voxels)
- Objectif : étendre un motif 2D au volume.
- Tâches :
  - Utiliser un buffer 3D (SX, SY, SZ).
  - Écrire un damier 3D avec `(x + y + z) % 2`.
  - Ajouter un paramètre constant `tileSize3D`.
- Bonus : rendre la couche centrale différente.

## 18) Sphère 3D
- Objectif : générer un volume avec une forme simple.
- Tâches :
  - Calculer la distance au centre 3D.
  - Écrire 0xFF00FF00 à l’intérieur d’un rayon `R`, 0 à l’extérieur.
  - Paramétrer `R` via une constante.
- Bonus : créer une coquille avec deux rayons.

## 19) Couches 3D (strates)
- Objectif : créer un motif par tranches.
- Tâches :
  - Colorer les voxels selon `z / layerSize`.
  - Ajouter un paramètre constant `layerSize`.
  - Visualiser plusieurs coupes Z dans WebGPU Studio.
- Bonus : alterner deux couleurs par couche.

## 20) Twist 3D (torsion)
- Objectif : déformer les coordonnées par une formule simple.
- Tâches :
  - Appliquer une rotation autour de Z en fonction de `z`.
  - Dessiner un motif 2D dans le plan XY “tordu” dans le volume.
  - Paramétrer l’angle par `twistStrength` (constante).
- Bonus : ajouter un second paramètre pour limiter la torsion à une plage de Z.

# Audit complet de `src/core/`

Date : 20 septembre 2026  
Périmètre principal : `src/core/`  
Périmètre de contexte : `src/types/`, `src/utils/`, `src/config.ts`, `src/index.ts`, commandes/événements appelant le core, `package.json` et `Dockerfile`.

## 1. Résumé exécutif

Le core est fonctionnel et le contrôle TypeScript passe (`bun run typecheck`), mais le chemin critique de lecture est coûteux :

```text
Commande -> validation fournisseur -> métadonnées -> yt-dlp/HTTP
         -> FFmpeg -> cache audio optionnel -> lecture Discord
```

Les problèmes dominants sont :

1. YouTube et SoundCloud sont systématiquement réencodés par FFmpeg en Opus 96 kbit/s, même si la source est déjà compatible.
2. Le nombre de processus et de requêtes n'est pas globalement limité ; chaque guilde peut lancer son couple `yt-dlp`/FFmpeg.
3. Un lien audio externe est probablement téléchargé une première fois pour FFprobe, puis une seconde fois pour la lecture.
4. Le cache audio couple l'écriture disque à la sortie vocale et exécute plusieurs opérations filesystem synchrones sur le thread événementiel.
5. `Player` et `Queue` ne sérialisent pas toutes les transitions ; des jobs annulés peuvent continuer à télécharger et transcoder.
6. Les recherches Spotify/Deezer sont converties en recherches YouTube individuelles, jusqu'à `MAX_PLAYLIST_SIZE` appels par playlist.
7. Les rôles de fournisseur, métadonnées, flux, transcodage, cache et Discord sont trop imbriqués pour permettre un changement de module à faible risque.
8. Plusieurs piles HTTP et d'extraction coexistent sans politique commune de timeout, retry, cancellation ou instrumentation.
9. Aucun test de charge, benchmark ou métrique du core n'a été trouvé.

### Verdict global

| Axe | Évaluation | Motif principal |
|---|---:|---|
| Démarrage d'une piste YouTube | Défavorable | Extraction externe puis FFmpeg avant la lecture. |
| CPU par piste | Défavorable | Réencodage systématique, compression FFmpeg niveau 5, volume inline. |
| Bande passante | Défavorable pour les liens externes | Probe puis lecture potentiellement doublés. |
| Mémoire sous charge | Moyenne à défavorable | Processus, queues, réponses JSON et recherches peu bornés globalement. |
| Concurrence | Défavorable | Fan-out multi-guildes et transitions non sérialisées. |
| Maintenabilité | Moyenne à défavorable | Singletons, imports circulaires et abstractions concrètes. |
| Remplacement d'un fournisseur | Défavorable | Pas de contrat uniforme pour résoudre, rechercher et ouvrir un flux. |
| Observabilité | Insuffisante | Logs textuels uniquement, pas d'histogrammes ni de compteurs. |

## 2. Méthode et limites

L'audit a couvert tous les fichiers de `src/core/`, les appels entrants et les dépendances de configuration. Il a inclus une lecture statique des chemins de données, des processus, des streams, des caches et des événements.

Résultats de vérification :

- `bun run typecheck` : réussi.
- `bunx prettier --check src/core` : échec sur `CommandTrigger.ts`, `DataFinder.ts`, `SoundCloudYtDlp.ts`, `YouTubeStreamConverter.ts`, `PlayerManager.ts` et `Track.ts`.
- Aucun test, benchmark ou fichier de profilage dédié au core n'a été trouvé.
- Aucun profil de production n'est disponible. Les impacts sont donc fondés sur le code ; les gains exacts devront être validés par mesure.

Niveaux : **Critique** = forte dégradation ou ressource non maîtrisée ; **Élevée** = impact fréquent sur latence/stabilité/évolutivité ; **Moyenne** = impact visible sous charge ou dette de conception ; **Faible** = coût limité mais réel.

## 3. Cartographie actuelle

### 3.1 Lecture

`AudioResourceFactory.createResource()` route selon SoundCloud, YouTube ou lien externe :

- SoundCloud : `getSoundCloudStream()` -> `yt-dlp` -> FFmpeg -> Opus.
- YouTube : cache éventuel, sinon `getYouTubeStream()` -> `yt-dlp` -> FFmpeg -> Opus.
- Externe : Got -> `StreamType.Arbitrary` -> `@discordjs/voice`/prism-media.

`Player.process()` attend en parallèle la connexion vocale et la ressource audio, puis démarre le lecteur et le message Now Playing.

### 3.2 Métadonnées

- YouTube vidéo : `play-dl.video_basic_info()`.
- YouTube playlist : `yt-dlp --dump-single-json --flat-playlist`.
- Recherche YouTube : `youtube-sr`.
- SoundCloud : `yt-dlp --dump-single-json`.
- Spotify : `spotify-url-info`, puis une recherche YouTube par piste.
- Deezer : `play-dl`, puis une recherche YouTube par piste.
- Lien externe : Axios + FFprobe.

### 3.3 Caches

- Métadonnées : LRU mémoire avec TTL.
- Extractions en cours : `Extractor.pending`.
- Audio : fichiers `.opus` dans `cache/audio`.
- Préchargements : `AudioCacheManager.pending`.
- Validation fournisseur : `ExtractorFactory.validationCache`.

Ces caches n'ont ni clé canonique commune, ni politique d'annulation, ni métriques hit/miss partagées.

## 4. Findings critiques et élevés

### CORE-PERF-001 — Réencodage FFmpeg systématique

**Sévérité : Critique**  
**Fichiers :** `src/core/helpers/YouTubeStreamConverter.ts:184-255`, `src/core/AudioResourceFactory.ts:30-74`

`transcode()` lance toujours FFmpeg avec `-ar 48000`, `-ac 2`, `-acodec libopus`, `-b:a 96k`, `-compression_level 5` et `-f opus`. Le flux est donc décodé puis réencodé même quand `yt-dlp` fournit un flux Ogg/Opus compatible.

**Impacts :** CPU et latence par piste, perte de qualité par réencodage, capacité limitée par les processus FFmpeg, préchargements qui concurrencent la lecture.

**Piste d'amélioration :** introduire un `StreamDescriptor` (conteneur, codec, fréquence, canaux, seekable) et bypasser FFmpeg si le format est déjà compatible. Réserver le transcodage aux sources incompatibles et aux seeks. Mesurer le compromis bitrate/compression avant de le modifier.

### CORE-PERF-002 — Pas de limite globale sur les processus audio

**Sévérité : Critique**  
**Fichiers :** `src/core/Player.ts:220-249`, `src/core/helpers/YouTubeStreamConverter.ts:111-255`, `src/core/managers/AudioCacheManager.ts:86-144`

Seuls les préchargements ont une limite (`AUDIO_PRELOAD_CONCURRENCY`). Les lectures actives, retries, seeks et transitions de toutes les guildes peuvent lancer simultanément des processus yt-dlp/FFmpeg. Les recherches de playlist ont une limite locale de 4, recréée à chaque requête.

**Impacts :** CPU/mémoire/réseau non bornés, rate-limit fournisseur, famine possible d'une lecture active.

**Piste d'amélioration :** ajouter un scheduler global avec budgets séparés pour lectures, transcodages, métadonnées et preloads. Prioriser la piste active, annuler les preloads obsolètes et n'ajouter des workers qu'après avoir défini cette capacité.

### CORE-PERF-003 — Lien externe téléchargé deux fois

**Sévérité : Critique**  
**Fichiers :** `src/core/extractors/ExternalLinkExtractor.ts:43-75`, `src/core/extractors/ExternalLinkExtractor.ts:93-175`, `src/core/AudioResourceFactory.ts:77-93`

`getExternalStreamInfo()` ouvre un flux Axios et l'envoie à FFprobe pour obtenir la durée. Lors de la lecture, `AudioResourceFactory` ouvre ensuite une nouvelle requête Got vers la même URL. Le probe peut consommer tout ou partie du fichier avant de retourner.

Le flux source n'est pas explicitement détruit après succès de FFprobe. Selon le comportement du serveur et du pipe, la connexion peut encore consommer des données après la fin utile du probe.

**Impacts :** jusqu'à deux téléchargements, double bande passante, latence proportionnelle à la taille et risque de connexions inutiles.

**Piste d'amélioration :** utiliser headers, métadonnées ou requête range bornée lorsque possible ; sinon partager un seul flux entre probe et lecture ou accepter une durée inconnue pour démarrer immédiatement. Encapsuler le cycle de vie avec `pipeline()` et cancellation.

### CORE-PERF-004 — Backpressure du cache couplé au playback

**Sévérité : Élevée**  
**Fichier :** `src/core/managers/AudioCacheManager.ts:57-83`

`tee()` branche la source vers un `PassThrough` de lecture et un `PassThrough` d'écriture disque. Une destination lente exerce une pression sur la source ; l'écriture cache peut donc ralentir la sortie vocale. La fonction ajoute aussi une copie de passage et plusieurs chemins d'erreur.

**Impacts :** jitter, sous-alimentation audio, mémoire moins prévisible, erreurs disque susceptibles de perturber le chemin de lecture.

**Piste d'amélioration :** rendre la branche cache best-effort et découplée avec une file bornée. Si elle est pleine ou en erreur, abandonner le cache sans bloquer le playback. Tester disque lent, plein et lecteur interrompu.

### CORE-PERF-005 — Filesystem synchrone sur les chemins chauds

**Sévérité : Élevée**  
**Fichier :** `src/core/managers/AudioCacheManager.ts:26-49`, `src/core/managers/AudioCacheManager.ts:57-185`

Le cache utilise `statSync`, `unlinkSync`, `readdirSync`, `renameSync`, `existsSync` et `mkdirSync`. Le nettoyage différé de 250 ms reste entièrement synchrone et effectue un scan puis plusieurs stats.

**Impacts :** blocage du thread événementiel, latence commandes/voice gateway et coût croissant avec le nombre de fichiers.

**Piste d'amélioration :** passer aux APIs promises, déplacer le nettoyage dans une tâche dédiée/worker, tenir un index mémoire des tailles et faire une réconciliation asynchrone périodique.

### CORE-PERF-006 — Transitions Player non sérialisées

**Sévérité : Critique**  
**Fichiers :** `src/core/Player.ts:67-176`, `src/core/Player.ts:220-253`, `src/core/Player.ts:287-361`

`transitionId` empêche une ancienne ressource d'être installée, mais n'annule pas le téléchargement, FFmpeg ou les appels réseau déjà lancés. Plusieurs `skip`, `jump`, `previous`, `seek`, erreurs ou ajouts peuvent donc travailler en parallèle.

**Impacts :** travail abandonné mais exécuté, processus concurrents, loading messages dans le désordre, erreurs d'une ancienne transition qui interfèrent avec la courante.

**Piste d'amélioration :** transformer `Player` en machine d'état avec une file par guilde et un `AbortController` par transition. Les adapters réseau/process doivent accepter le signal et tuer réellement leurs ressources au remplacement.

### CORE-PERF-007 — Téléchargement lancé même si la connexion vocale échoue

**Sévérité : Élevée**  
**Fichier :** `src/core/Player.ts:224-233`

`Promise.allSettled()` démarre en parallèle `entersState(connection, Ready)` et `createResource()`. Si la connexion échoue, le download/transcodage a déjà pu consommer du réseau et du CPU.

**Piste d'amélioration :** attendre la connexion avant le download, ou utiliser un signal commun et annuler immédiatement la ressource quand la connexion échoue. Ne conserver le parallélisme que si le gain mesuré justifie les abandons.

### CORE-PERF-008 — Processus yt-dlp non annulable explicitement

**Sévérité : Élevée**  
**Fichiers :** `src/core/helpers/YouTubeStreamConverter.ts:111-181`, `YouTubeYtDlp.ts:29-96`, `SoundCloudYtDlp.ts:43-97`

Le streaming renvoie `child.stdout` mais perd le handle du processus. À la fermeture du flux, le code détruit la sortie source mais ne tue pas directement yt-dlp. Les chemins de métadonnées n'ont pas de timeout global ni de signal d'annulation.

**Impacts :** processus potentiellement orphelins, descripteurs/mémoire conservés, promesses `Extractor.pending` bloquées lors d'un réseau défaillant.

**Piste d'amélioration :** encapsuler processus et stream dans une ressource annulable, tuer yt-dlp et FFmpeg ensemble, ajouter timeout d'inactivité et timeout total aux métadonnées, et nettoyer dans un `finally` idempotent.

### CORE-PERF-009 — Initialisation yt-dlp non single-flight et non atomique

**Sévérité : Élevée**  
**Fichier :** `src/core/helpers/YouTubeStreamConverter.ts:305-339`

Plusieurs appels concurrents peuvent tous constater l'absence du binaire, interroger GitHub et écrire le même chemin.

**Impacts :** téléchargements redondants, fichier partiellement écrit/écrasé et cold start variable.

**Piste d'amélioration :** conserver une promesse statique d'initialisation, télécharger dans un fichier temporaire puis renommer atomiquement, vérifier version/hash et épingler le binaire dans l'image de production.

### CORE-PERF-010 — Validation SoundCloud coûteuse et répétée

**Sévérité : Élevée**  
**Fichier :** `src/core/extractors/SoundCloudLinkExtractor.ts:16-60`

La validation SoundCloud lance déjà `getSoundCloudInfo(url, 1)`. Pour une playlist, `extractPlaylist()` supprime le résultat puis appelle `getSoundCloudInfo(url)` à nouveau. Les appels de validation sont eux-mêmes séquentiels dans `ExtractorFactory`.

**Impacts :** métadonnées récupérées deux fois, latence avant extraction et erreurs réseau dans une phase censée sélectionner le fournisseur.

**Piste d'amélioration :** rendre la validation pure quand possible ; réserver la résolution réseau aux liens courts ; partager le résultat single-flight entre validation et extraction.

### CORE-PERF-011 — Playlists Spotify/Deezer transformées en N recherches YouTube

**Sévérité : Critique sous charge**  
**Fichiers :** `src/core/extractors/SpotifyLinkExtractor.ts:60-103`, `src/core/extractors/DeezerLinkExtractor.ts:66-99`

Chaque piste est convertie en recherche `artiste + titre`. La limite locale de 4 ne protège pas contre plusieurs guildes ni contre une playlist de grande taille. Avec `MAX_PLAYLIST_SIZE=500`, une seule playlist peut provoquer jusqu'à 500 recherches YouTube.

**Impacts :** latence linéaire, rate-limit, mémoire pour les promesses et correspondances textuelles ambiguës.

**Piste d'amélioration :** résolution par lots/lazy, queue globale de recherche, limite interactive plus stricte, clés normalisées et ajout progressif des pistes.

### CORE-PERF-012 — Retries dispersés et sans budget global

**Sévérité : Élevée**  
**Fichiers :** `YouTubeStreamConverter.ts:82-104`, `SoundCloudYtDlp.ts:22-40`, `Player.ts:339-357`

Les retries sont répartis entre converter, helpers, `Player`, Got et REST Discord. Les backoffs sont déterministes et sans jitter. Les erreurs FFmpeg qui arrivent après le retour de `getYouTubeStream()` ne sont pas prises par sa boucle de retry ; elles remontent ensuite par événement au Player.

**Impacts :** tentatives plus nombreuses que prévu, rafales synchronisées, réglage difficile et charge accrue pendant les pannes.

**Piste d'amélioration :** centraliser classification et policy avec `retryable`, `retryAfter`, budget par job, jitter, circuit breaker et distinction création/consommation de flux.

## 5. Findings cache, filesystem et mémoire

### CORE-CACHE-001 — Clés non canoniques et duplication possible

**Sévérité : Élevée**  
**Fichiers :** `AudioCacheManager.ts:35-54`, `AudioCacheManager.ts:175-179`, `LinkExtractor.ts:19-21`, `YouTubeLinkExtractor.ts:34-47`

Le cache audio hash directement l'URL reçue. Deux URLs représentant la même vidéo mais différant par des paramètres de tracking, l'ordre des paramètres, le hostname ou la playlist produisent deux fichiers. Le cache de métadonnées canonicalise partiellement YouTube, mais le cache audio ne partage pas cette clé.

**Impacts :** taux de hit réduit, stockage et transcodages dupliqués, nettoyage plus fréquent.

**Piste d'amélioration :** définir une canonicalisation par fournisseur et une clé de contenu stable (`youtube:videoId`, identifiant SoundCloud ou URL normalisée), tout en conservant séparément l'URL de téléchargement.

### CORE-CACHE-002 — Race entre producteurs d'une même entrée audio

**Sévérité : Élevée**  
**Fichier :** `src/core/managers/AudioCacheManager.ts:57-83`

`pending` déduplique seulement les préchargements. Deux transitions peuvent créer simultanément deux `tee()` et deux téléchargements pour le même URL, puis renommer vers le même fichier final.

**Impacts :** bande passante et CPU doublés, commit non déterministe, lecteur pouvant ouvrir un résultat d'une autre tentative.

**Piste d'amélioration :** unifier preload et lecture active derrière un cache de jobs par clé. Autoriser une seule production et partager une représentation consommable ou attendre un fichier final validé.

### CORE-CACHE-003 — Commit et nettoyage fragiles sous concurrence

**Sévérité : Moyenne à élevée**  
**Fichier :** `src/core/managers/AudioCacheManager.ts:64-79`, `AudioCacheManager.ts:146-173`

Le nettoyage peut inspecter un fichier disparu entre `readdirSync()` et `statSync()`. Une exception de `cleanup()` n'est pas capturée. Les fichiers temporaires sont ignorés et les limites peuvent être dépassées entre plusieurs commits proches.

**Piste d'amélioration :** commit coordonné, gestion des entrées disparues, nettoyage des `.tmp` âgés au démarrage, réservations de taille en mémoire et lock si plusieurs instances partagent le volume.

### CORE-CACHE-004 — Touch disque à chaque hit

**Sévérité : Moyenne**  
**Fichier :** `src/core/managers/AudioCacheManager.ts:35-47`

Chaque hit fait un `statSync()` puis planifie un `utimes()`. Une succession de seeks ou de lectures depuis le cache génère des syscalls et des mises à jour concurrentes avec le nettoyage.

**Piste d'amélioration :** tenir `lastUsed` en mémoire et flusher par lot ou au plus une fois par période minimale par fichier.

### CORE-CACHE-005 — Sérialisation complète pour calculer la taille du cache mémoire

**Sévérité : Faible à moyenne**  
**Fichier :** `src/core/managers/CacheManager.ts:17-28`

Chaque insertion fait `JSON.stringify(value)` et parcourt une playlist entière sur le thread événementiel. Une playlist importante entraîne allocations et pause proportionnelles à sa taille.

**Piste d'amélioration :** calculer le poids à la normalisation, le mémoriser dans le DTO de cache ou limiter par nombre d'entrées quand les objets sont petits.

### CORE-CACHE-006 — Valeurs de cache mutables et invalidation limitée

**Sévérité : Moyenne**  
**Fichiers :** `src/core/extractors/abstract/Extractor.ts:29-42`, `src/core/managers/CacheManager.ts:30-40`

`cacheManager.get()` renvoie directement l'objet et ses tableaux. Une future couche qui modifierait `tracks` ou `related` pourrait corrompre l'entrée partagée entre guildes. Il n'existe pas de version de schéma ni d'invalidation ciblée.

**Piste d'amélioration :** DTO immuables, clonage aux frontières mutables, version de cache et invalidation par fournisseur/identifiant.

### CORE-MEM-001 — Plusieurs frontières restent insuffisamment bornées

**Sévérité : Élevée sous charge**  
**Fichiers :** `Queue.ts:27-45`, `YouTubeYtDlp.ts:55-69`, `SoundCloudYtDlp.ts:57-70`, `AudioCacheManager.ts:95-107`

La queue peut recevoir des pistes sans limite globale. En `loop === "queue"`, le pruning d'historique est désactivé. Les réponses JSON yt-dlp peuvent occuper 32 MiB par processus, et les promesses `pending` vivent jusqu'à la fin de requêtes sans timeout.

**Impacts :** croissance mémoire, GC plus fréquent, temps de réponse dégradé et monopolisation par une source volumineuse.

**Piste d'amélioration :** limites par guilde et globales, playlists paginées/lazy, buffers bornés et expiration/cancellation des entrées `pending`.

## 6. Findings Player, Queue et concurrence applicative

### CORE-STATE-001 — Queue non protégée contre les opérations concurrentes

**Sévérité : Élevée**  
**Fichiers :** `src/core/Queue.ts:124-193`, `src/core/Player.ts:67-111`

Dans le listener `jump`, `scheduleAutoAdd()` est appelé avant `this._index = trackId`. L'autoqueue peut donc démarrer avec l'ancien index. Après deux `await` dans `autoAddNextTrack()`, le code vérifie seulement `_autoqueue` avant d'ajouter la piste ; il ne vérifie pas que le track courant et l'index n'ont pas changé.

**Impacts :** piste liée au mauvais morceau, appels devenus inutiles, doublons et comportement dépendant du timing.

**Piste d'amélioration :** génération de queue par tâche, mise à jour de l'index avant planification, validation de génération/track courant avant commit, mutations sérialisées par joueur.

### CORE-STATE-002 — `Track.getRelated()` ne déduplique pas les appels en cours

**Sévérité : Moyenne**  
**Fichier :** `src/core/Track.ts:30-41`

Le champ `related` reste indéfini pendant `video_basic_info()`. Deux appels simultanés lancent deux recherches. Pour une source non YouTube, une recherche de piste supplémentaire est effectuée avant l'appel YouTube.

**Piste d'amélioration :** mémoriser une promesse `relatedPromise`, la supprimer en cas d'échec et réutiliser les `related` fournis par les métadonnées initiales.

### CORE-STATE-003 — Autoqueue et loop peuvent faire croître la queue sans fin

**Sévérité : Moyenne à élevée**  
**Fichier :** `src/core/Queue.ts:155-193`

Le pruning ne s'applique pas en boucle de queue et l'autoqueue ajoute des pistes quand il reste au plus deux éléments. Une session longue peut donc conserver indéfiniment son historique.

**Piste d'amélioration :** limiter l'historique même en loop, ajouter un plafond absolu et une déduplication bornée.

### CORE-STATE-004 — Preload concurrent d'une transition prioritaire

**Sévérité : Élevée**  
**Fichier :** `src/core/Player.ts:310-315`

À chaque événement `Playing`, les prochains tracks sont préchargés avec `void`. Les appels restent actifs après `skip`, `jump`, `stop` ou `seek`, même si la fenêtre de lecture a changé.

**Piste d'amélioration :** jobs de preload avec priorité et `AbortController`, annulation des pistes sorties de la fenêtre, capacité réservée à la lecture active.

### CORE-STATE-005 — Opérations de queue linéaires et queue non bornée

**Sévérité : Faible à moyenne**  
**Fichier :** `src/core/Queue.ts:27-81`

`concat`, `splice`, `slice`, le `some()` d'autoqueue et `idsToRemove.includes()` sont acceptables pour une petite queue, mais leur coût augmente avec une queue non limitée.

**Piste d'amélioration :** imposer une limite, utiliser un `Set` pour les suppressions et ne changer de structure que si le benchmark le justifie.

### CORE-STATE-006 — Messages Discord nombreux et non coordonnés

**Sévérité : Moyenne**  
**Fichiers :** `src/core/Player.ts:220-253`, `Player.ts:317-320`, `Player.ts:363-413`, `NowPlayingMsgManager.ts:24-65`

Une transition peut envoyer loading, track added, error, supprimer loading, supprimer/éditer Now Playing et mettre à jour les boutons. Plusieurs envois sont détachés et peuvent arriver dans un ordre différent.

**Impacts :** requêtes REST, rate-limit et état UI incohérent.

**Piste d'amélioration :** un flux d'état UI par joueur, mises à jour regroupées et identifiant de version pour ignorer une édition obsolète.

### CORE-STATE-007 — Promesses détachées et erreurs non observées

**Sévérité : Moyenne**  
**Fichiers :** appels `void` dans `Player.ts`, `Queue.ts`, `CommandManager.ts`, `Bot.ts`

Nettoyage Now Playing, preloads, `skip`, `leave`, autoqueue, réponses Discord et autocomplete sont souvent lancés sans wrapper homogène de journalisation/cancellation.

**Piste d'amélioration :** un helper `fireAndForget(label, promise)` pour tracer les rejets et, pour les transitions, une file où les opérations sont attendues.

## 7. Findings réseau et bibliothèques

### CORE-NET-001 — Empilement de clients HTTP et de piles d'extraction

**Sévérité : Élevée pour la maintenance, moyenne pour la performance**  
**Fichiers :** `package.json`, extracteurs et helpers

Le core utilise simultanément `youtube-sr`, `play-dl`, yt-dlp, `spotify-url-info`, `isomorphic-unfetch`, Axios et Got. Cela ne prouve pas qu'une bibliothèque est intrinsèquement lente, mais empêche une politique commune de timeout, keep-alive, proxy, retry, cancellation et instrumentation. Les piles peuvent aussi ouvrir des connexions et buffers différents.

**Piste d'amélioration :** isoler chaque fournisseur derrière un adapter et définir un transport HTTP interne avec agents réutilisables, timeout, signal et métriques communs. Ne remplacer une bibliothèque qu'après benchmark ; le gain principal viendra de la réduction des appels et du transcodage.

### CORE-NET-002 — Validation des extracteurs séquentielle

**Sévérité : Moyenne**  
**Fichier :** `src/core/helpers/ExtractorFactory.ts:41-60`

Les validateurs sont attendus l'un après l'autre. La majorité est syntaxique, mais SoundCloud peut lancer yt-dlp et Deezer peut effectuer un HEAD pour `deezer.page.link`. Un validateur réseau lent bloque tous les suivants.

**Piste d'amélioration :** routage syntaxique pur par hostname/chemin ; résolution réseau réservée aux liens courts et ambigus, avec cache single-flight et timeout court.

### CORE-NET-003 — Recherches YouTube non normalisées

**Sévérité : Moyenne**  
**Fichiers :** `src/core/extractors/abstract/SearchExtractor.ts:17-19`, `src/core/helpers/DataFinder.ts:9-42`

Le cache utilise la chaîne brute. Casse, espaces, ponctuation et variantes artiste/titre entraînent des recherches répétées.

**Piste d'amélioration :** normaliser les requêtes, versionner la stratégie de recherche et mettre en cache une clé artiste/titre normalisée.

### CORE-NET-004 — Pas de timeout global des métadonnées yt-dlp

**Sévérité : Élevée**  
**Fichiers :** `src/core/helpers/YouTubeYtDlp.ts:51-95`, `SoundCloudYtDlp.ts:43-97`

La taille stdout est limitée à 32 MiB, mais aucun délai total ou d'inactivité ne tue un processus bloqué.

**Impacts :** promesses `pending`, processus et buffers conservés indéfiniment lors d'un incident réseau.

**Piste d'amélioration :** timeout d'inactivité et total, kill du processus dans les deux cas, erreur typée et métrée.

### CORE-NET-005 — Démarrage yt-dlp basé sur `readable` ou 500 ms

**Sévérité : Moyenne**  
**Fichier :** `src/core/helpers/YouTubeStreamConverter.ts:120-163`

Le flux est accepté sur `stdout.readable` ou à l'expiration d'un timer de 500 ms, avant validation complète de yt-dlp. Une erreur tardive est seulement journalisée ou remonte ensuite par FFmpeg.

**Piste d'amélioration :** exposer séparément `ready` et `stream`, attendre un premier chunk réellement consommable et propager les erreurs dans un lifecycle annulable. Cela rend aussi les retries corrects.

### CORE-NET-006 — Liens externes validés uniquement par extension

**Sévérité : Faible à moyenne**  
**Fichier :** `src/core/extractors/ExternalLinkExtractor.ts:30-41`

Les URLs signées, extensions en majuscule, redirections et endpoints sans extension sont rejetés sans inspection limitée du type MIME.

**Piste d'amélioration :** utiliser `Content-Type`, redirections et `Content-Length` après un HEAD/GET borné, puis mettre en cache la résolution.

## 8. Findings architecture et maintenabilité

### CORE-ARCH-001 — `YouTubeStreamConverter` concentre trop de responsabilités

**Sévérité : Élevée**  
**Fichier :** `src/core/helpers/YouTubeStreamConverter.ts`

La classe valide les URLs, configure le format, démarre yt-dlp, télécharge son binaire, classe les erreurs, démarre FFmpeg, transcode des fichiers et expose le helper SoundCloud.

**Impacts :** tests difficiles sans processus réels, remplacement de yt-dlp/FFmpeg coûteux, régressions croisées.

**Piste d'amélioration :** découper en ports/adapters : `BinaryManager`, `MetadataProcess`, `SourceStreamProvider`, `AudioTranscoder`, `StreamLifecycle` et `ErrorClassifier`.

### CORE-ARCH-002 — Contrat `Extractor` trop lié aux classes concrètes

**Sévérité : Élevée**  
**Fichiers :** `Extractor.ts`, `LinkExtractor.ts`, `SearchExtractor.ts`, `DataFinder.ts`

Les extracteurs portent un type chaîne, retournent une union `TrackData | PlaylistData`, importent dynamiquement les classes domaine et dépendent du cache singleton. `DataFinder` expose en parallèle des méthodes statiques pour chaque combinaison.

**Impacts :** type de retour dépendant du chemin d'appel, ajout de types qui élargit toutes les unions, tests dépendants des singletons.

**Piste d'amélioration :** interfaces explicites `TrackResolver`, `PlaylistResolver`, `SearchProvider`, `StreamProvider`, DTO validés et construction domaine séparée.

### CORE-ARCH-003 — Recherche YouTube codée en dur

**Sévérité : Moyenne à élevée**  
**Fichier :** `src/core/helpers/DataFinder.ts:77-80`

`defineSearchSource()` retourne directement `YouTubeSearchExtractor`. Changer de moteur ou ajouter un fallback exige de modifier le core.

**Piste d'amélioration :** registre de providers avec capacités (`searchTrack`, `searchPlaylist`, `resolveUrl`, `stream`) et priorité configurable.

### CORE-ARCH-004 — Imports circulaires et singleton global `bot`

**Sévérité : Élevée pour la maintenabilité**  
**Fichiers :** `Player.ts:18`, `CommandManager.ts:18`, `PlayerManager.ts`, `src/index.ts`

`Player` et `CommandManager` importent `bot` depuis `index`, pendant que `index` construit `Bot`, puis `PlayerManager` et `Player`.

**Impacts :** ordre d'initialisation fragile, tests unitaires difficiles, évolutions risquant d'ajouter d'autres cycles.

**Piste d'amélioration :** injecter `PlayerManager`, logger, services de résolution et policies ; fournir un contexte applicatif aux commandes.

### CORE-ARCH-005 — Erreurs et retries non unifiés

**Sévérité : Élevée**  
**Fichiers :** extracteurs, converter, helpers yt-dlp, `Player.handlePlaybackFailure()`

Chaque couche a ses regex et types (`ExtractionError`, `YouTubeStreamError`, erreurs brutes Axios/Got/FFmpeg). Le Player reclasse ensuite des messages texte avec une autre regex.

**Piste d'amélioration :** modèle `{ kind, provider, phase, retryable, retryAfter, cause }` et policy centrale ; le message humain ne doit pas servir de protocole.

### CORE-ARCH-006 — Binaire yt-dlp téléchargé au runtime et non vérifié

**Sévérité : Moyenne à élevée**  
**Fichiers :** `YouTubeStreamConverter.ts:318-339`, `Dockerfile:14-31`

L'image Docker n'embarque pas yt-dlp ; la première commande télécharge la release GitHub `latest` sans hash. Le cold start dépend donc d'un service externe et d'une version distante.

**Piste d'amélioration :** version épinglée, hash vérifié et binaire inclus au build ; à défaut, initialisation single-flight avec timeout et fallback explicite.

### CORE-ARCH-007 — Types relâchés aux frontières externes

**Sévérité : Moyenne**  
**Fichiers :** `ExternalLinkExtractor.ts:77`, `SpotifyLinkExtractor.ts:50-103`, `DeezerLinkExtractor.ts:56-97`, `YouTubeLinkExtractor.ts:65-79`

Plusieurs `any`, assertions non nulles et `as any` contournent le strict typing au moment où les données externes entrent dans le domaine.

**Impacts :** erreurs tardives, fallback/retry incorrects et refactorings moins sûrs.

**Piste d'amélioration :** valider les réponses par schéma dans les adapters, supprimer `any` et convertir immédiatement en DTO interne.

### CORE-ARCH-008 — Imports dynamiques utilisés comme découplage implicite

**Sévérité : Faible à moyenne**  
**Fichiers :** `Track.ts`, `DataFinder.ts`, `ExtractorFactory.ts`, extracteurs Spotify/Deezer

Les imports dynamiques contournent des cycles mais rendent les dépendances invisibles et compliquent tests, bundling et analyse statique. Ils ne remplacent pas l'injection.

**Piste d'amélioration :** conserver le lazy loading seulement lorsqu'il est mesuré ; utiliser des interfaces et un composition root pour les services centraux.

### CORE-ARCH-009 — Méthode async sans travail asynchrone

**Sévérité : Faible**  
**Fichier :** `src/core/Playlist.ts:22-27`

`Playlist.from()` est `async` sans `await`, donc une promesse et un microtask sont créés sans bénéfice.

**Piste d'amélioration :** rendre la méthode synchrone ou réserver `fromAsync()` à une construction qui résout effectivement des données externes.

### CORE-ARCH-010 — Aucun test de charge ni profilage du core

**Sévérité : Élevée**  
**Périmètre :** dépôt, en particulier `src/core/`

Il n'existe pas de verrou sur les flux, processus, backpressure, cancellation, cache ou transitions concurrentes.

**Piste d'amélioration :** ajouter tests unitaires des clés/erreurs/queue, tests d'intégration avec faux yt-dlp/FFmpeg, tests de cancellation/backpressure, benchmarks cold/cache/seek/playlists et charge multi-guildes.

## 9. Problèmes secondaires mais réels

### CORE-MINOR-001 — Cache de validation sans normalisation

`ExtractorFactory.validationCache` utilise l'URL brute. Les variantes de slash, casse ou paramètres génèrent plusieurs entrées ; il n'est pas relié au cache d'extraction.

### CORE-MINOR-002 — `max: 100` indépendant de `CACHE_SIZE`

`CacheManager` combine une limite d'entrées fixe et une limite en mégaoctets. Une playlist importante peut évincer des tracks légers et `CACHE_SIZE` ne correspond pas à une capacité prédictible sans métriques.

### CORE-MINOR-003 — Erreurs de flux externe mal capturées

Le `try/catch` de `getExternalResource()` couvre la création de `got.stream()`, mais les erreurs de réseau arrivent ensuite sur le flux. Elles ne sont pas garanties d'être transformées par ce `catch` et la cause structurée est perdue.

### CORE-MINOR-004 — FFmpeg/FFprobe en devDependencies côté Node/Bun

Le Dockerfile fournit des binaires système via `FFMPEG_PATH` et `FFPROBE_PATH`, mais une installation production hors Docker peut tomber sur le PATH ou échouer. Le comportement dépend donc du mode de déploiement.

### CORE-MINOR-005 — Format et volume non négociés

Bitrate, fréquence, canaux, compression FFmpeg et `inlineVolume` sont codés en dur. Ces choix peuvent être corrects, mais aucune mesure ne montre qu'ils minimisent le CPU pour la qualité attendue.

### CORE-MINOR-006 — Logs non structurés et parfois volumineux

Les erreurs incluent jusqu'à 16 KiB de stderr et des URLs complètes. Sous panne répétée, le volume de logs et l'absence d'identifiant de job compliquent l'observation.

### CORE-MINOR-007 — `CommandTrigger` concentre trop de modèles Discord

Messages, interactions, callback, defer, edit, delete et follow-up partagent un état `response` partiellement défini. Le coût principal est la fiabilité et le nombre de requêtes, pas le CPU local.

### CORE-MINOR-008 — I/O synchrone du bootstrap

`Bot` et `CommandManager` utilisent `readdirSync`. L'impact est limité au démarrage, mais une initialisation contrôlée et observable serait plus cohérente avec le reste du système.

## 10. Ce qui ne doit pas être sur-optimisé

- Les regex de validation sont négligeables devant les appels réseau.
- `LRUCache.get/set` n'est pas un goulot en soi.
- Les quatre étapes de fade-out sont négligeables devant FFmpeg et Discord REST.
- `mapWithConcurrency()` est correct pour une limite locale ; le problème est l'absence de limite globale.
- Les processus OS fournissent déjà une forme de parallélisme. Le manque principal est le contrôle du fan-out et l'annulation, pas l'absence brute de threads JavaScript.
- Le chargement dynamique des commandes n'affecte pas la lecture après le démarrage.

## 11. Architecture cible recommandée

```text
Command / Discord adapter
        |
Application services : ResolveTrack, ResolvePlaylist, Play, Preload
        |
Provider registry / capabilities
        |-------------------------------|
YouTube adapter                  autres adapters
        |
Normalized metadata + StreamDescriptor
        |
Stream scheduler + cancellation + retry policy
        |
Cache manager     Process manager     Audio format selector
        |                 |                    |
Metadata cache      yt-dlp/FFmpeg       Discord voice resource
Audio cache
```

Contrat minimal souhaitable :

```ts
interface SourceAdapter {
  canHandle(input: URL): boolean;
  resolve(input: URL, signal: AbortSignal): Promise<ResolvedItem>;
  search?(query: string, signal: AbortSignal): Promise<SearchResult[]>;
  openStream(item: ResolvedTrack, options: StreamOptions,
    signal: AbortSignal): Promise<SourceStream>;
}
```

`SourceStream` doit exposer le flux, un descripteur de format, un `close()` idempotent et un identifiant de job. Le code Discord ne doit pas savoir si la source vient de yt-dlp, d'une URL HTTP ou d'un autre service.

## 12. Plan d'amélioration par étapes

### Étape 0 — Instrumenter avant de changer

Ajouter par `guildId`/`jobId` : durée validation, métadonnées, ouverture et première trame ; cache hit/miss ; processus actifs ; CPU/mémoire ; bytes téléchargés ; retries ; transitions annulées ; latence event-loop.

### Étape 1 — Robustesse immédiate

- Timeout et cancellation pour tous les processus.
- Promesse single-flight d'initialisation yt-dlp.
- File de transitions par guilde.
- Correction ordre `jump`/autoqueue et vérification de génération avant commit.
- Plafond de queue et playlist.
- Suppression de l'I/O FS synchrone du chemin de lecture.

### Étape 2 — Réduction du coût de flux

- Bypass FFmpeg pour Ogg/Opus compatible.
- `StreamDescriptor` et `StreamType` corrects.
- Cache best-effort découplé du playback.
- Probe externe borné ou durée inconnue plutôt qu'un second téléchargement.
- Annulation des preloads hors fenêtre.

### Étape 3 — Débit et rate-limit

- Scheduler global.
- Retries, backoff/jitter et circuit breakers centralisés.
- Clés URL/recherche normalisées.
- Playlists lazy ou par lots.
- Priorité à la lecture active.

### Étape 4 — Refactor maintenable

- Adapters fournisseurs et DTO normalisés.
- Suppression des imports circulaires vers `bot`.
- Injection des services dans `Player`, `Queue` et les commandes.
- Ports testables pour yt-dlp, FFmpeg, HTTP et Discord.
- Erreurs structurées.

### Étape 5 — Validation

Benchmarks avant/après sur YouTube cold/cache, seek, SoundCloud, lien externe, Spotify/Deezer playlist et 1/10/50 guildes. Tester skip pendant download, disque plein, réseau lent, connexion vocale indisponible et yt-dlp bloqué.

## 13. Matrice de priorisation

| ID | Priorité | Effort | Gain attendu | Risque si reporté |
|---|---:|---:|---:|---|
| CORE-PERF-001 | P0 | Moyen | Très élevé CPU/latence | Un FFmpeg par lecture limite la capacité. |
| CORE-PERF-003 | P0 | Moyen | Très élevé réseau/latence | Deux téléchargements pour les liens externes. |
| CORE-PERF-006 | P0 | Élevé | Élevé stabilité | Jobs abandonnés et courses difficiles. |
| CORE-PERF-002 | P0 | Moyen | Très élevé multi-guildes | Saturation CPU/mémoire non bornée. |
| CORE-PERF-005 | P1 | Moyen | Moyen à élevé event-loop | Blocages sur cache important. |
| CORE-PERF-008 | P1 | Moyen | Élevé incident réseau | Processus/descripteurs persistants. |
| CORE-PERF-010 | P1 | Faible-moyen | Élevé SoundCloud | Validation puis extraction répétées. |
| CORE-PERF-011 | P1 | Moyen | Très élevé playlists | Latence/rate-limit linéaires. |
| CORE-PERF-012 | P1 | Moyen | Moyen à élevé | Rafales de retries. |
| CORE-CACHE-002 | P1 | Moyen | Élevé | Téléchargements dupliqués. |
| CORE-STATE-001 | P1 | Moyen | Élevé | Autoqueue obsolète ou incorrecte. |
| CORE-ARCH-001 | P1 | Élevé | Maintenabilité élevée | Toute évolution touche le centre. |
| CORE-ARCH-002 | P1 | Élevé | Maintenabilité élevée | Changement fournisseur coûteux. |
| CORE-ARCH-004 | P1 | Moyen | Maintenabilité élevée | Tests/bootstrap fragiles. |
| CORE-ARCH-010 | P1 | Moyen | Réduction du risque | Pas de garde-fou contre les régressions. |
| CORE-CACHE-001 | P2 | Faible-moyen | Moyen | Hits manqués et stockage dupliqué. |
| CORE-STATE-003 | P2 | Faible | Moyen long terme | Croissance mémoire en loop. |
| CORE-NET-002 | P2 | Faible-moyen | Moyen | Latence liens ambigus. |
| CORE-ARCH-007 | P2 | Moyen | Stabilité | Erreurs externes tardives. |

## 14. Conclusion

Le projet n'a pas besoin d'ajouter aveuglément des threads JavaScript. Les gains viennent de la réduction du travail inutile et d'une concurrence contrôlée : éviter les réencodages, ne pas télécharger deux fois, annuler les jobs obsolètes, limiter les processus et résoudre les playlists progressivement.

Pour la maintenabilité, la priorité est de remplacer le couplage actuel par des adapters de fournisseurs et un contrat de flux normalisé. La queue de lecture et le scheduler doivent posséder le cycle de vie des jobs, avec cancellation et budgets de capacité. Cette base permettra de changer yt-dlp, FFmpeg, une source de métadonnées ou le cache sans réécrire `Player`, `Queue` et les commandes.

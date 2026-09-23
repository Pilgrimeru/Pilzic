# Suivi de l'audit du core — 23 septembre 2026

Ce document compare les constats de `AUDIT_CORE_PERFORMANCE.md` aux corrections du dépôt. « Partiel » signifie qu'un risque reste ouvert ou qu'une mesure en production manque. Les tests locaux ne remplacent pas un essai Discord avec les fournisseurs réels.

| Constats | État | Résultat et limite |
| --- | --- | --- |
| CORE-PERF-001 | Partiel | YouTube utilise directement WebM/Opus quand disponible ; SoundCloud évite FFmpeg quand ses métadonnées indiquent Ogg/Opus ou WebM/Opus. Le volume inline est désactivé à 100 % pour les sources repositionnables et réactivé sur changement de volume. Seeks, live et formats incompatibles sont transcodés. Le gain CPU réel reste à mesurer. |
| CORE-PERF-002 | Corrigé | Ordonnanceur global configurable pour les jobs audio et métadonnées ; recherches et préchargements ont leurs limites. |
| CORE-PERF-003 | Corrigé | Métadonnées externes par HEAD, sans téléchargement du corps avant lecture. |
| CORE-PERF-004 | Corrigé | L'écriture du cache ne partage plus la pression de la lecture active ; seules les pistes préchargées sont enregistrées. |
| CORE-PERF-005 | Corrigé | Accès disque du cache audio asynchrones. |
| CORE-PERF-006 | Partiel | Une transition remplace et annule la précédente ; les opérations ne passent pas encore par une file explicite par guilde et certaines bibliothèques réseau n'exposent pas d'annulation. |
| CORE-PERF-007 | Corrigé | La connexion vocale est attendue avant l'ouverture de la source audio. |
| CORE-PERF-008 | Corrigé pour yt-dlp | Le flux conserve un chemin d'annulation qui tue yt-dlp et FFmpeg ; les métadonnées yt-dlp ont un délai total. |
| CORE-PERF-009 | Corrigé | Initialisation partagée, fichier temporaire, renommage et empreinte SHA-256 vérifiée. |
| CORE-PERF-010 | Corrigé | Validation SoundCloud syntaxique pour les liens ordinaires ; les liens ambigus réutilisent leur extraction. |
| CORE-PERF-011 | Corrigé | Les playlists Spotify/Deezer sont ajoutées avec leurs métadonnées puis résolues vers YouTube à la lecture ; recherche globale bornée. |
| CORE-PERF-012 | Partiel | Retries réduits, jitter, classification commune au lecteur ; pas encore de budget unique partagé par tous les fournisseurs. |
| CORE-CACHE-001, 002 | Corrigé pour l'écriture cache | Clés normalisées et un seul préchargement producteur par piste ; plusieurs lectures actives peuvent toujours ouvrir leurs propres flux. |
| CORE-CACHE-003 | Partiel | Commits temporaires, nettoyage asynchrone et gestion des fichiers disparus ; pas de verrou entre instances partageant un volume. |
| CORE-CACHE-004, 006 | Corrigé | Mises à jour d'atime espacées, copies aux frontières du cache et invalidation ciblée. |
| CORE-CACHE-005 | Partiel | Estimation de taille sans JSON.stringify, encore linéaire en nombre de pistes. |
| CORE-MEM-001 | Partiel | Queue et réponses yt-dlp bornées, délais des extractions ; certaines bibliothèques externes conservent leurs propres buffers. |
| CORE-STATE-001, 002, 003, 004, 005 | Corrigé pour les courses identifiées | Génération d'autoqueue, promesse de related, plafond de queue, annulation des préchargements et suppressions par Set. |
| CORE-STATE-006 | Partiel | Messages de lecture versionnés, chargement et notification initiale superflus supprimés ; le nombre total d'appels Discord dépend encore des commandes. |
| CORE-STATE-007 | Corrigé pour le core inspecté | Les promesses détachées du lecteur, des commandes et de la queue observent leurs erreurs. |
| CORE-NET-001, 002 | Partiel | Axios retiré et validations courantes devenues syntaxiques ; les bibliothèques propres aux fournisseurs restent distinctes. |
| CORE-NET-003, 004, 005, 006 | Corrigé | Recherches normalisées, timeout des métadonnées yt-dlp, premier octet réel attendu, validation MIME des URLs sans extension. |
| CORE-ARCH-001, 002 | Partiel | Binaire, processus JSON et adapters de flux séparés ; construction domaine sortie des extracteurs. Le convertisseur et le contrat de métadonnées restent larges. |
| CORE-ARCH-003, 004 | Corrigé | Source de recherche remplaçable, dépendances de Player et CommandManager injectées. |
| CORE-ARCH-005 | Partiel | Classification commune au Player ; les adapters ont encore des erreurs et retries spécifiques. |
| CORE-ARCH-006, 007, 008, 009 | Corrigé | Version et hash yt-dlp épinglés, types externes renforcés, imports dynamiques réservés au chargement commandes/événements, Playlist.from synchrone. |
| CORE-ARCH-010 | Partiel | Tests de capacité, annulation, queue, HTTP et messages ajoutés ; pas de profil de production ni de benchmark audio réel 1/10/50 guildes. |
| CORE-MINOR-001, 002, 004, 008 | Corrigé | Clés de validation normalisées, cache mémoire dimensionné, FFmpeg disponible en production, bootstrap FS asynchrone. |
| CORE-MINOR-003, 005, 006, 007 | Partiel | Erreurs de flux propagées, paramètres Opus configurables, logs de jobs structurés et CommandTrigger fiabilisé ; le volume inline et une partie des messages/logs restent à mesurer. |

## Vérifications

- `bun run check` : format, lint, TypeScript et 67 tests réussis avant les derniers ajustements du repli et du volume. Format, lint et TypeScript ont été relancés après ces ajustements.
- Test HTTP local : aucune requête GET pendant l'extraction des métadonnées externes.
- Build Docker non exécuté : le moteur Docker local ne répond pas.
- Lecture Discord réelle et benchmarks fournisseurs non exécutés : ils nécessitent un bot connecté et des liens de test stables.

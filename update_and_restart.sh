#!/usr/bin/env bash

set -Eeuo pipefail

readonly CONTAINER_NAME="Octaveru"
readonly IMAGE_NAME="pilzic"
readonly BRANCH="main"

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f config.env ]]; then
  echo "Erreur : config.env est introuvable." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Erreur : le dépôt contient des modifications suivies non validées." >&2
  echo "Sauvegardez-les avant de déployer." >&2
  exit 1
fi

echo "Mise à jour du dépôt Git..."
git fetch --prune origin "$BRANCH"

# Ce clone est un clone de déploiement : il doit reproduire exactement la
# branche distante, y compris après une réécriture de son historique.
git reset --hard "origin/$BRANCH"

readonly REVISION="$(git rev-parse --short=12 HEAD)"
readonly NEW_IMAGE="$IMAGE_NAME:$REVISION"

echo "Construction de l'image Docker $NEW_IMAGE..."
docker build --pull --tag "$NEW_IMAGE" .

echo "Vérification de config.env avec Docker..."
docker run --rm --env-file config.env --entrypoint /bin/true "$NEW_IMAGE"

old_image=""
if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Image}}' "$CONTAINER_NAME")"
  echo "Arrêt de l'ancien conteneur $CONTAINER_NAME..."
  docker container stop "$CONTAINER_NAME"
  docker container rm "$CONTAINER_NAME"
fi

run_container() {
  local image="$1"
  local -a options=(
    --detach
    --name "$CONTAINER_NAME"
    --restart=always
    --env-file config.env
  )

  if [[ -f secrets/youtube-cookies.txt ]]; then
    options+=(
      --env YOUTUBE_COOKIES_PATH=/app/secrets/youtube-cookies.txt
      --volume "$PWD/secrets/youtube-cookies.txt:/app/secrets/youtube-cookies.txt:ro"
    )
  fi

  docker run "${options[@]}" "$image"
}

echo "Démarrage du conteneur $CONTAINER_NAME..."
if ! run_container "$NEW_IMAGE"; then
  echo "Le nouveau conteneur n'a pas démarré." >&2
  docker container rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true

  if [[ -n "$old_image" ]]; then
    echo "Restauration de l'image précédente..." >&2
    run_container "$old_image"
  fi

  exit 1
fi

docker image tag "$NEW_IMAGE" "$IMAGE_NAME:latest"

echo "Déploiement terminé : $CONTAINER_NAME utilise la révision $REVISION."

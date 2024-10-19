# syntax=docker/dockerfile:1

### Étape 1: Utiliser une image légère avec Bun ###
FROM oven/bun:alpine AS base

# Installer ffmpeg via apk (Alpine package manager)
RUN apk add --no-cache ffmpeg

# Répertoire de travail dans le conteneur
WORKDIR /app

# Copier uniquement les fichiers nécessaires (code source et config)
COPY . .

# Installer les dépendances avec Bun (production uniquement)
RUN bun install --production

# Créer un utilisateur non-root pour des raisons de sécurité
RUN adduser -D appuser
USER appuser

# Spécifier l'environnement en mode production
ENV NODE_ENV=production

# Commande pour démarrer l'application avec Bun
CMD ["bun", "start"]

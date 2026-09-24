# Multi-stage image.
#   setup   -> one-shot job: creates the DB schema + seeds data (needs devDependencies)
#   runtime -> the production server (default target)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM build AS setup
CMD ["sh", "scripts/setup.sh"]

FROM build AS prune
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=prune /app/build ./build
COPY --from=prune /app/node_modules ./node_modules
COPY --from=prune /app/package.json ./package.json
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build/index.js"]

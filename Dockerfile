# Built and run by quicksilver's post-receive hook on the server.
# Stage 1 checks and builds; stage 2 runs the server on :8000, the port quicksilver's vhost proxies to.
#
# The type check and unit tests run here on purpose: `qs deploy` pushes straight to the server
# and skips GitHub's CI, so this is the only gate every deploy passes. A failing stage fails the
# build, and the push comes back with an error.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# No install scripts: better-sqlite3 ships prebuilt binaries, which some npm versions try to
# compile anyway, and no other dependency needs one.
RUN npm ci --no-fund --no-audit --ignore-scripts
COPY . .
RUN npm run typecheck && npm test && npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production HABITS_DB=/data/habits.db
WORKDIR /app
# A new named volume takes this directory's owner, so the unprivileged user can write the database.
RUN mkdir /data && chown node:node /data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/backup.ts ./scripts/
USER node
EXPOSE 8000
# All interfaces, inside the container only: compose publishes no ports, and nginx reaches it over quicksilvernet.
CMD ["node_modules/.bin/srvx", "serve", "--prod", "--host=0.0.0.0", "--port=8000", "--entry", "dist/server/server.js", "--static", "../client"]

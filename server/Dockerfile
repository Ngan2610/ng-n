# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY shared /app/shared
COPY db/*.sql /app/db/
COPY --from=web-build /app/web/dist /app/web/dist
RUN mkdir -p /app/server/uploads && chown -R node:node /app/server/uploads
USER node
ENV NODE_ENV=production SERVE_WEB=true
EXPOSE 3000
CMD ["node", "src/index.js"]

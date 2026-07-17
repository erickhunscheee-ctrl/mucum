# syntax=docker/dockerfile:1

# Expo SDK 57 requer Node.js 22.13 ou superior.
FROM node:22.13-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Somente variaveis publicas entram no bundle web.
# Proxy vazio usa /api no mesmo dominio do painel.
ARG EXPO_PUBLIC_PROXY_URL=
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY

ENV EXPO_PUBLIC_PROXY_URL=${EXPO_PUBLIC_PROXY_URL}
ENV EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}

RUN npm run typecheck && npm run build:web

FROM node:22.13-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/hidro-proxy.mjs"]

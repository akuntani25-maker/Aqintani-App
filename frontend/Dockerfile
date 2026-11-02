# Tahap 1: build tampilan aplikasi (React)
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
# API berada di domain yang sama (/api), jadi alamat backend dikosongkan
ENV REACT_APP_BACKEND_URL= GENERATE_SOURCEMAP=false NODE_OPTIONS=--max-old-space-size=1536
RUN yarn build

# Tahap 2: Caddy menyajikan tampilan + meneruskan /api ke backend + HTTPS otomatis
FROM caddy:2.8.4-alpine
COPY --from=build /app/build /srv

# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm i -g tsx@4
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY config.example.toml ./config.example.toml
RUN mkdir -p data
EXPOSE 3001
CMD ["tsx", "server/index.ts"]

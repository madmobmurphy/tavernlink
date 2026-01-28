FROM node:20-bullseye-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm install \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm run build

FROM node:20-bullseye-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

RUN mkdir -p /app/data /app/uploads

EXPOSE 3003

CMD ["node", "server/index.js"]

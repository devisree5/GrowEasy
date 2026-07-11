FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src/ ./src
COPY shared/ ../shared

RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create storage directory for JSON DB
RUN mkdir -p /app/data

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000
ENV STORAGE_DIR=/app/data

CMD ["node", "dist/server.js"]

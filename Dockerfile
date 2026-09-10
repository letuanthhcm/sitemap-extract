# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json ./
RUN npm install

# Copy source code
COPY . .

# Build Vite frontend and bundled Express server
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package.json and install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy build artifacts and config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json* ./

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

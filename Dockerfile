# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and config files
COPY .env ./
COPY src ./src
COPY static ./static
COPY svelte.config.ts ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Run sync to generate required files (skip type checking)
RUN bun run svelte-kit sync

# Build the application
RUN bun run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and lock file
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

# Install production dependencies only using bun (if available) or npm
RUN npm install --production

# Copy build output and static files
COPY --from=builder /app/build ./build
COPY --from=builder /app/static ./static

# Set environment
ENV NODE_ENV=production
ENV PORT=4173
ENV HOST=0.0.0.0

EXPOSE 4173

# Run the Node.js server built by adapter-node
CMD ["node", "build/index.js"]

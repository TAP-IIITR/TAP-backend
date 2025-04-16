# Stage 1: Builder - Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# Set memory limits for Node.js
ENV NODE_OPTIONS="--max-old-space-size=512"

# 1. Copy package files first for better caching
COPY package*.json ./

# 2. Install only necessary dependencies for building
RUN npm install --no-audit --no-fund --ignore-scripts

# 3. Copy all source files
COPY . .

# 4. Compile TypeScript with minimal resources
RUN echo "Building TypeScript project..." && \
    npx tsc --pretty false || (echo "TypeScript compilation failed" && exit 1)

# Stage 2: Runtime - Production image
FROM node:20-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# 1. Copy package files
COPY package*.json ./

# 2. Install only production dependencies
RUN npm install --only=production --no-audit --no-fund

# 3. Copy only the built dist folder
COPY --from=builder /app/dist ./dist

# 4. Use your existing start script
CMD ["npm", "start"]
# Stage 1: Builder - Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for the clean script
RUN apk add --no-cache findutils

# 1. Copy package files first for better caching
COPY package*.json ./

# 2. Install all dependencies (including devDependencies needed for build)
RUN npm install

# 3. Copy all source files
COPY . .

# 4. Modified build command for better error visibility
RUN npm run build || (echo "Build failed with error:" && cat npm-debug.log 2>/dev/null || true && exit 1)

# Stage 2: Runtime - Production image
FROM node:20-alpine

WORKDIR /app

# 1. Only copy production dependencies
COPY package*.json ./
RUN npm install --production

# 2. Copy only the built dist folder
COPY --from=builder /app/dist ./dist

# 3. Use your existing start script
CMD ["npm", "start"]
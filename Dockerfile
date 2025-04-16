# Stage 1: Builder - Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copy package files first for better caching
COPY package*.json ./

# 2. Install all dependencies (including devDependencies needed for build)
RUN npm install

# 3. Copy all source files
COPY . .

# 4. Run your existing build script (clean + install + tsc)
RUN npm run build

# Stage 2: Runtime - Production image
FROM node:20-alpine

WORKDIR /app

# 1. Only copy production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# 2. Copy only the built dist folder
COPY --from=builder /app/dist ./dist

# 3. Use your existing start script
CMD ["npm", "start"]
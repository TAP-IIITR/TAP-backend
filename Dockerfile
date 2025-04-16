# Stage 1: Builder - Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copy package files first for better caching
COPY package*.json ./

# 2. Install all dependencies (including devDependencies needed for build) 
RUN npm install

# 3. Copy all source files
COPY . .

# 4. Run TypeScript compilation with verbose output
RUN echo "Building TypeScript project..." && \
    npx tsc --listFiles --traceResolution > typescript-debug.log 2>&1 || \
    (echo "TypeScript compilation failed:" && cat typescript-debug.log && exit 1)

# Stage 2: Runtime - Production image
FROM node:20-alpine

WORKDIR /app

# 1. Only copy production dependencies
COPY package*.json ./
RUN npm install --production --ignore-scripts

# 2. Copy only the built dist folder
COPY --from=builder /app/dist ./dist

# 3. Use your existing start script
CMD ["npm", "start"]
FROM node:20-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy tsconfig.json
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Copy .env file (if it exists)
COPY .env* ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
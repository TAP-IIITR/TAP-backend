# Use a single-stage build for simplicity and better debugging
FROM node:20-alpine

WORKDIR /app

# Set environment variables to help with memory management
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy package files first
COPY package*.json ./

# Install dependencies including TypeScript explicitly
RUN npm install
RUN npm install typescript -g

# Copy the rest of the application
COPY . .

# Try to compile the TypeScript
RUN echo "Building TypeScript project..." && \
    tsc || (echo "TypeScript compilation failed" && exit 1)

# Start the application
CMD ["npm", "start"]
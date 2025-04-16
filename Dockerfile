FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Environment variables will be configured in Railway

# Use the start command from package.json
CMD ["npm", "start"]
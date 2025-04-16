# Use a single-stage build for simplicity and better debugging
FROM node:20-alpine

WORKDIR /app

# Set environment variables to help with memory management
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy everything
COPY . .

# Install dependencies
RUN npm install --quiet

# Try to identify TypeScript issues
RUN npx tsc --listFiles > tsc-files.log || (echo "Failed to list TypeScript files" && cat tsc-files.log && exit 1)

# Try a more minimal compilation approach - just check types without emitting files
RUN npx tsc --noEmit > tsc-check.log || (echo "TypeScript type checking failed:" && cat tsc-check.log && exit 1)

# If type checking passes, run the actual build
RUN npm run build || (echo "TypeScript build failed" && exit 1)

# Start the application
CMD ["npm", "start"]
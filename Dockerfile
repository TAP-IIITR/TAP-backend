FROM public.ecr.aws/lambda/nodejs:20

WORKDIR /var/task

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy your TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the TypeScript code
RUN npm run build

# Copy .env files if they exist
COPY .env* ./

# Set the CMD to point to your Lambda handler function
CMD ["dist/index.handler"]

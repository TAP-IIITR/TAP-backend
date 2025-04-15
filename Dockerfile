FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Environment variables will be configured in Railway
# No need to copy .env file as it doesn't exist
# COPY .env ./ 

# Set the CMD to your handler
CMD [ "src/index.js" ]
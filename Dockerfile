FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript to dist/
RUN npm run build

CMD [ "dist/index.js" ]

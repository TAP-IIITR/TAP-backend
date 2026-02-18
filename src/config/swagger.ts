import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TAP Placement Portal API',
      version: '1.0.0',
      description: 'API documentation for the Training and Placement (TAP) Portal of IIIT Ranchi',
      contact: {
        name: 'TAP Team',
        // url: 'https://tap.iiitv.ac.in', // Replace with IIITR URL if available
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/index.ts', './src/**/*.routes.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJSDoc(options);

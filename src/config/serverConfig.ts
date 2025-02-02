// src/config/server.config.ts
import dotenv from 'dotenv';
dotenv.config();

export const SERVER_CONFIG = {
  // Server settings
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Firebase config
  FIREBASE: {
    API_KEY: process.env.FIREBASE_API_KEY,
    AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    APP_ID: process.env.FIREBASE_APP_ID,
    MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID
  },

  // Auth settings
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // Cookie settings
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'your-cookie-secret',
  COOKIE_MAX_AGE: parseInt(process.env.COOKIE_MAX_AGE || '86400000'),
  
  // CORS settings
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // OTP settings
  OTP_EXPIRY: parseInt(process.env.OTP_EXPIRY || '900000'), // 15 minutes in milliseconds
} as const;

// Type definition for the config
type ServerConfig = typeof SERVER_CONFIG;

// Required environment variables validation
const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'JWT_SECRET',
  'COOKIE_SECRET'
] as const;

// Validate required environment variables
// Validate required environment variables
requiredEnvVars.forEach(envVar => {
    const configValue = process.env[envVar];
  
    if (!configValue) {
      console.error(`Error: Environment variable ${envVar} is required`);
      process.exit(1);
    }
  });
  // Environment-specific validations
if (SERVER_CONFIG.NODE_ENV === 'production') {
  const productionEnvVars = [
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS'
  ] as const;

  productionEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      console.error(`Error: Environment variable ${envVar} is required in production`);
      process.exit(1);
    }
  });
}

// Helper function to validate config at runtime
export const validateConfig = () => {
  console.log('Current configuration:', {
    ...SERVER_CONFIG,
    FIREBASE: {
      ...SERVER_CONFIG.FIREBASE,
      API_KEY: '**********' 
    },
    JWT_SECRET: '**********',
    COOKIE_SECRET: '**********',
  });

  if (SERVER_CONFIG.NODE_ENV === 'production' && SERVER_CONFIG.CORS_ORIGIN === '*') {
    console.warn('Warning: CORS is set to allow all origins in production');
  }
};
console.log("Firebase Config:", SERVER_CONFIG.FIREBASE);

export default SERVER_CONFIG;
import * as admin from 'firebase-admin';
import logger from '../utils/logger';

const initializeFirebaseAdmin = () => {
  try {
    if (!admin.apps.length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
      });
      logger.info('Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    logger.error('Error initializing Firebase Admin SDK', { error });
  }
};

initializeFirebaseAdmin();

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export default admin;

import { ITapCoordinator } from '../interfaces/ITapCoordinator';
import { auth, db } from '../../config/firebase';
import { 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection, 
  query,
  where,
  getDocs
} from 'firebase/firestore';

export class TapAuthRepository {
  private readonly tapCollection = 'students';

  async findByEmail(email: string): Promise<ITapCoordinator | null> {
    try {
      const tapRef = collection(db, this.tapCollection);
      const q = query(tapRef, where('regEmail', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const tapDoc = querySnapshot.docs[0];
      return {
        ...tapDoc.data() as ITapCoordinator,
        id: tapDoc.id
      };
    } catch (error) {
      console.error('Error finding TAP coordinator:', error);
      throw error;
    }
  }

  async initiatePasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error initiating password reset:', error);
      throw error;
    }
  }

  async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      return await verifyPasswordResetCode(auth, code);
    } catch (error) {
      console.error('Error verifying reset code:', error);
      throw error;
    }
  }

  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(auth, code, newPassword);
    } catch (error) {
      console.error('Error confirming password reset:', error);
      throw error;
    }
  }
}

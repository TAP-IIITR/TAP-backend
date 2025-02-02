import { IAuthRepository } from '../interfaces/IAuthRepository';
import { IStudent } from '../interfaces/IStudent';
import { auth, db } from '../../config/firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  signOut,
  updatePassword,
  sendEmailVerification
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  collection 
} from 'firebase/firestore';

export class FirebaseAuthRepository implements IAuthRepository {
  private readonly studentsCollection = 'students';

  async findByEmail(email: string): Promise<IStudent | null> {
    try {
      const studentsRef = collection(db, this.studentsCollection);
      const studentSnapshot = await getDoc(doc(studentsRef, email));
      
      if (!studentSnapshot.exists()) {
        return null;
      }

      return studentSnapshot.data() as IStudent;
    } catch (error) {
      console.error('Error finding student:', error);
      throw error;
    }
  }

  async create(student: IStudent): Promise<IStudent> {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        student.regEmail,
        student.password!
      );

      // Send verification email
      await sendEmailVerification(userCredential.user);

      // Remove password before storing in Firestore
      const { password, ...studentData } = student;
      
      // Store additional user data in Firestore
      await setDoc(doc(db, this.studentsCollection, student.regEmail), {
        ...studentData,
        id: userCredential.user.uid,
        emailVerified: false,  // Add email verification status
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        ...studentData,
        id: userCredential.user.uid
      };
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  }
  async updateEmailVerificationStatus(email: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.studentsCollection, email), {
        emailVerified: true
      });
    } catch (error) {
      console.error('Error updating email verification status:', error);
      throw error;
    }
  }


  async updatePassword(id: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      await updatePassword(user, newPassword);
      
      // Update the timestamp in Firestore
      const studentDoc = await this.findByEmail(user.email!);
      if (studentDoc) {
        await updateDoc(doc(db, this.studentsCollection, user.email!), {
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  async initiatePasswordReset(email: string): Promise<void> {
    try {
      // Firebase will automatically send a password reset email
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error initiating password reset:', error);
      throw error;
    }
  }

  async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      // Verify the password reset code
      return await verifyPasswordResetCode(auth, code);
    } catch (error) {
      console.error('Error verifying reset code:', error);
      throw error;
    }
  }

  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    try {
      // Confirm the password reset
      await confirmPasswordReset(auth, code, newPassword);
    } catch (error) {
      console.error('Error confirming password reset:', error);
      throw error;
    }
  }
}


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
  collection, 
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { validateIIITREmail,extractRollNumber } from '../../utils/validator';

export class FirebaseAuthRepository implements IAuthRepository {
  private readonly studentsCollection = 'students';

  async findByRollNumber(rollNumber: string): Promise<IStudent | null> {
    try {
      const studentDoc = await getDoc(doc(db, this.studentsCollection, rollNumber));
      if (!studentDoc.exists()) {
        return null;
      }
      return {
        ...studentDoc.data() as IStudent,
        id: studentDoc.id
      };
    } catch (error) {
      console.error('Error finding student by roll number:', error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<IStudent | null> {
    try {
      const studentsRef = collection(db, this.studentsCollection);
      const q = query(studentsRef, where('regEmail', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const studentDoc = querySnapshot.docs[0];
      return {
        ...studentDoc.data() as IStudent,
        id: studentDoc.id
      };
    } catch (error) {
      console.error('Error finding student:', error);
      throw error;
    }
  }

  async create(student: IStudent): Promise<IStudent> {
    try {
      if (!validateIIITREmail(student.regEmail)) {
        throw new Error('Invalid email format');
      }

      const rollNumber = extractRollNumber(student.regEmail);
      if (!rollNumber) {
        throw new Error('Could not extract roll number from email');
      }

      // Check if roll number already exists
      const existingStudent = await this.findByRollNumber(rollNumber);
      if (existingStudent) {
        throw new Error('Student with this roll number already exists');
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        student.regEmail,
        student.password!
      );

      await sendEmailVerification(userCredential.user);

      const { password, ...studentData } = student;
      
      // Store in Firestore using roll number as document ID
      await setDoc(doc(db, this.studentsCollection, rollNumber), {
        ...studentData,
        id: rollNumber,
        uid: userCredential.user.uid,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        ...studentData,
        id: rollNumber
      };
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  }


  async updateEmailVerificationStatus(rollNumber: string): Promise<void> {
    try {
      const studentRef = doc(db, this.studentsCollection, rollNumber);
      await updateDoc(studentRef, {
        emailVerified: true,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating email verification status:', error);
      throw error;
    }
  }


  async updatePassword(userId: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      await updatePassword(user, newPassword);
      
      // Update the timestamp in Firestore using userId
      const studentRef = doc(db, this.studentsCollection, userId);
      await updateDoc(studentRef, {
        updatedAt: new Date()
      });
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


import { IAuthService } from '../interfaces/IAuthService';
import { IAuthRepository } from '../interfaces/IAuthRepository';
import { IStudent } from '../interfaces/IStudent';
import { generateJWT } from '../../utils/jwt';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { CustomError } from '../../errors/Custom-Error';

export class AuthService implements IAuthService {
  constructor(private authRepository: IAuthRepository) {}

  async register(student: IStudent): Promise<{ id: string; token: string }> {
    try {
      const existingStudent = await this.authRepository.findByEmail(student.regEmail);
      if (existingStudent) {
        throw new CustomError(
          'Registration failed',
          400,
          [{ message: 'Student with this email already exists' }]
        );
      }
      
      const newStudent = await this.authRepository.create(student);
      const token = generateJWT({ id: newStudent.id!, role: 'student' });
      
      return { id: newStudent.id!, token };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        'Registration failed',
        500,
        [{ message: 'Internal server error during registration' }]
      );
    }
  }

  async login(email: string, password: string): Promise<{ id: string; token: string }> {
    try {
      // First attempt to sign in with Firebase Auth
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (firebaseError: any) {
        // Handle specific Firebase Auth errors
        if (firebaseError.code === 'auth/user-not-found') {
          throw new CustomError('Login failed', 404, [
            { message: 'No account exists with this email' }
          ]);
        }
        if (firebaseError.code === 'auth/wrong-password') {
          throw new CustomError('Login failed', 401, [
            { message: 'Invalid password' }
          ]);
        }
        if (firebaseError.code === 'auth/too-many-requests') {
          throw new CustomError('Login failed', 429, [
            { message: 'Too many failed login attempts. Please try again later.' }
          ]);
        }
        // For any other Firebase auth errors
        throw new CustomError('Login failed', 400, [
          { message: 'Authentication failed. Please try again.' }
        ]);
      }
  
      // Check email verification
      if (!userCredential.user.emailVerified) {
        // Send a new verification email
        await sendEmailVerification(userCredential.user);
        throw new CustomError('Email verification required', 403, [
          { message: 'Please verify your email. A new verification email has been sent.' }
        ]);
      }
  
      // Get the user ID from Firebase Auth
      const userId = userCredential.user.uid;
  
      // Update email verification status using the correct user ID
      await this.authRepository.updateEmailVerificationStatus(userId);
      
      // Generate JWT token with proper payload
      const token = generateJWT({ 
        id: userId, 
        role: 'student'
      });
  
      return { 
        id: userId, 
        token 
      };
  
    } catch (error) {
      // If it's already a CustomError, rethrow it
      if (error instanceof CustomError) {
        throw error;
      }
      // Log the unexpected error for debugging
      console.error('Unexpected error during login:', error);
      // Return a generic error message to the client
      throw new CustomError('Login failed', 500, [
        { message: 'An unexpected error occurred during login. Please try again.' }
      ]);
    }
  }
  

  async logout(id: string): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error in logout:', error);
      throw new Error('Logout failed');
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      const student = await this.authRepository.findByEmail(email);
      if (!student) {
        throw new Error('Student not found');
      }
      await this.authRepository.initiatePasswordReset(email);
    } catch (error) {
      console.error('Error in resetPassword:', error);
      throw new Error('Password reset failed');
    }
  }

  async confirmResetPassword(code: string, newPassword: string): Promise<void> {
    try {
      await this.authRepository.verifyPasswordResetCode(code);
      await this.authRepository.confirmPasswordReset(code, newPassword);
    } catch (error) {
      console.error('Error in confirmResetPassword:', error);
      throw new Error('Password reset confirmation failed');
    }
  }
}

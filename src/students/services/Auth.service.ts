import { IAuthService } from '../interfaces/IAuthService';
import { IAuthRepository } from '../interfaces/IAuthRepository';
import { IStudent } from '../interfaces/IStudent';
import { generateJWT } from '../../utils/jwt';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';

export class AuthService implements IAuthService {
  constructor(private authRepository: IAuthRepository) {}

  async register(student: IStudent): Promise<{ id: string; token: string }> {
    try {
      const existingStudent = await this.authRepository.findByEmail(student.regEmail);
      if (existingStudent) {
        throw new Error('Student already exists');
      }
      
      const newStudent = await this.authRepository.create(student);
      const token = generateJWT({ id: newStudent.id!, role: 'student' });
      
      return { id: newStudent.id!, token };
    } catch (error) {
      console.error('Error in register:', error);
      throw new Error('Registration failed');
    }
  }

  async login(email: string, password: string): Promise<{ id: string; token: string }> {
    try {
      const student = await this.authRepository.findByEmail(email);
      if (!student) {
        throw new Error('Student not found');
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user);
        throw new Error('Email not verified. Verification email sent.');
      }

      await this.authRepository.updateEmailVerificationStatus(email);
      
      const token = generateJWT({ id: userCredential.user.uid, role: 'student' });
      return { id: userCredential.user.uid, token };
    } catch (error) {
      console.error('Error in login:', error);
      throw new Error('Login failed');
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

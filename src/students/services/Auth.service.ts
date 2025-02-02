import { IAuthService } from '../interfaces/IAuthService';
import { IAuthRepository } from '../interfaces/IAuthRepository';
import { IStudent } from '../interfaces/IStudent';
import { generateJWT } from '../../utils/jwt';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { BadRequestError } from '../../errors/Bad-Request-Error';
import { AuthError } from '../../errors/Auth-Error';
import { NotFoundError } from '../../errors/Not-Found-Error';

export class AuthService implements IAuthService {
  constructor(private authRepository: IAuthRepository) {}

  async register(student: IStudent): Promise<{ id: string; token: string }> {
    const existingStudent = await this.authRepository.findByEmail(student.regEmail);
    if (existingStudent) {
      throw new BadRequestError('Student with this email already exists');
    }
    
    try {
      const newStudent = await this.authRepository.create(student);
      const token = generateJWT({ id: newStudent.id!, role: 'student' });
      return { id: newStudent.id!, token };
    } catch (error) {
      throw new BadRequestError('Registration failed');
    }
  }

  async login(email: string, password: string): Promise<{ id: string; token: string }> {
    const student = await this.authRepository.findByEmail(email);
    if (!student) {
      throw new NotFoundError('Student with this email does not exist');
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user);
        throw new AuthError('Email not verified. Verification email has been sent.');
      }

      await this.authRepository.updateEmailVerificationStatus(email);
      
      const token = generateJWT({ id: userCredential.user.uid, role: 'student' });
      return { id: userCredential.user.uid, token };
    } catch (error) {
      if ((error as any).code === 'auth/wrong-password') {
        throw new AuthError('Invalid password');
      }
      throw new BadRequestError('Login failed');
    }
  }

  async logout(id: string): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      throw new AuthError('Logout failed');
    }
  }

  async resetPassword(email: string): Promise<void> {
    const student = await this.authRepository.findByEmail(email);
    if (!student) {
      throw new NotFoundError('Student not found');
    }
    
    try {
      await this.authRepository.initiatePasswordReset(email);
    } catch (error) {
      throw new BadRequestError('Password reset failed');
    }
  }

  async confirmResetPassword(code: string, newPassword: string): Promise<void> {
    try {
      await this.authRepository.verifyPasswordResetCode(code);
      await this.authRepository.confirmPasswordReset(code, newPassword);
    } catch (error) {
      throw new BadRequestError('Password reset confirmation failed');
    }
  }
}

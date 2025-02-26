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

  async login(email: string, password: string): Promise<{ id: string; token: string }>
  {
    const student = await this.authRepository.findByEmail(email);
    console.log('student is ',student)
    if (!student) {
      throw new NotFoundError('Student with this email does not exist');
    }

    try {
      // const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Attempting login with:", email, password);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful:", userCredential);

      
      if (!userCredential.user.emailVerified) {
        // Send a new verification email
        await sendEmailVerification(userCredential.user);
        throw new AuthError('Email not verified. Verification email has been sent.');
      }
  
      // Get the user ID from Firebase Auth
      const userId = userCredential.user.uid;
      const rollNumber = student.rollNumber


      // Update email verification status using the correct user ID
      await this.authRepository.updateEmailVerificationStatus(rollNumber);
      
      // Generate JWT token with proper payload
      const token = generateJWT({ 
        id: rollNumber, 
        role: 'student'
      });
  
      return { 
        id: userId, 
        token 
      };
  
    } catch (error: any) {
      if ((error as any).code === 'auth/wrong-password') {
        throw new AuthError('Invalid password');
      }
      console.log("error is ",error)
      throw new BadRequestError(error.message);
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

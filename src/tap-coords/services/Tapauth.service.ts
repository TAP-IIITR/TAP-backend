import { TapAuthRepository } from '../repositories/TapAuth.repository';
import { ITapCoordinator } from '../interfaces/ITapCoordinator';
import { generateJWT } from '../../utils/jwt';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { NotFoundError } from '../../errors/Not-Found-Error';
import { AuthError } from '../../errors/Auth-Error';
import { ForbiddenError } from '../../errors/Forbidden-Error';

export class TapAuthService {
  constructor(private tapAuthRepository: TapAuthRepository) {}

  async login(email: string, password: string): Promise<{ id: string; token: string }> {
    const tapCoordinator = await this.tapAuthRepository.findByEmail(email);
    if (!tapCoordinator) {
      throw new NotFoundError('TAP coordinator not found');
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        throw new AuthError('Email not verified');
      }

      const token = generateJWT({ 
        id: tapCoordinator.id!, 
        role: 'tap',
      });

      return { 
        id: tapCoordinator.id!, 
        token 
      };
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new AuthError('Invalid credentials');
      }
      throw error;
    }
  }

  async logout(userId: string, role: string): Promise<void> {
    if (role !== 'tap') {
      throw new ForbiddenError('Only TAP coordinators can perform this action');
    }

    try {
      await signOut(auth);
    } catch (error) {
      throw new AuthError('Logout failed');
    }
  }

  async resetPassword(email: string, role: string): Promise<void> {
    if (role !== 'tap') {
      throw new ForbiddenError('Only TAP coordinators can perform this action');
    }

    const tapCoordinator = await this.tapAuthRepository.findByEmail(email);
    if (!tapCoordinator) {
      throw new NotFoundError('TAP coordinator not found');
    }
    
    try {
      await this.tapAuthRepository.initiatePasswordReset(email);
    } catch (error) {
      throw new AuthError('Password reset failed');
    }
  }

  async confirmResetPassword(code: string, newPassword: string, role: string): Promise<void> {
    if (role !== 'tap') {
      throw new ForbiddenError('Only TAP coordinators can perform this action');
    }

    try {
      await this.tapAuthRepository.verifyPasswordResetCode(code);
      await this.tapAuthRepository.confirmPasswordReset(code, newPassword);
    } catch (error) {
      throw new AuthError('Password reset confirmation failed');
    }
  }
}


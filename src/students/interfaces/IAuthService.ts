import { IStudent } from "./IStudent";

export interface IAuthService {
    register(student: IStudent): Promise<{ id: string; token: string }>;
    login(email: string, password: string): Promise<{ id: string; token: string }>;
    logout(id: string): Promise<void>;
    resetPassword(email: string): Promise<string>; // returns OTP
    confirmResetPassword(email: string, otp: string, newPassword: string): Promise<void>;
  }
  
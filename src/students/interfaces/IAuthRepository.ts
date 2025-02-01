import { IStudent } from "./IStudent";

export interface IAuthRepository {
    findByEmail(email: string): Promise<IStudent | null>;
    create(student: IStudent): Promise<IStudent>;
    updatePassword(id: string, password: string): Promise<void>;
    storeOTP(email: string, otp: string): Promise<void>;
    verifyOTP(email: string, otp: string): Promise<boolean>;
  }
  
  
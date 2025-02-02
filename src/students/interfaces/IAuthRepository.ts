import { IStudent } from "./IStudent";

export interface IAuthRepository {
    findByEmail(email: string): Promise<IStudent | null>;

    create(student: IStudent): Promise<IStudent>;

    updatePassword(email: string, newPassword: string): Promise<void>;

    updateEmailVerificationStatus(email: string): Promise<void>;

    initiatePasswordReset(email: string): Promise<void>;

    verifyPasswordResetCode(code: string): Promise<string>;

    confirmPasswordReset(code: string, newPassword: string): Promise<void>;
}


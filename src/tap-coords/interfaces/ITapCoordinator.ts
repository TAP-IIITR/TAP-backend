export interface ITapCoordinator {
  id?: string;
  regEmail: string;
  firstName: string;
  lastName: string;
  password?: string;
  role: 'tap' | 'tpo';
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStudent {
  id?: string;
  firstName: string;
  lastName: string;
  regEmail: string;
  mobile: string;
  linkedin: string;
  resume?: {
    url: string;
    lastUpdated: Date;
  };
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IResumeRepository {
    generateUploadUrl(studentId: string, fileType: string): Promise<string>;
    deleteResume(studentId: string): Promise<void>;
    getResumeUrl(studentId: string): Promise<string | null>;
  }
  
  
import { IResumeRepository } from '../interfaces/IResumeRepository';
import { CustomError } from '../../errors/Custom-Error';
import { db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { BadRequestError } from '../../errors/Bad-Request-Error';

export class ResumeService {
  constructor(private resumeRepository: IResumeRepository) {}

  async getUploadUrl(studentId: string, fileType: string): Promise<string> {
    if (fileType !== 'application/pdf') {
      throw new BadRequestError("Invalid file type. Only PDF files are allowed");
    }

    return await this.resumeRepository.generateUploadUrl(studentId, fileType);
  }

  async updateResumeUrl(studentId: string, url: string): Promise<void> {
    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, {
      resume: {
        url,
        lastUpdated: new Date()
      }
    });
  }

  async deleteCurrentResume(studentId: string): Promise<void> {
    await this.resumeRepository.deleteResume(studentId);
    
    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, {
      resume: null
    });
  }

  async getResume(studentId: string): Promise<string | null> {
    return await this.resumeRepository.getResumeUrl(studentId);
  }
}


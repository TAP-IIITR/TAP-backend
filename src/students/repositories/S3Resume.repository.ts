import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { IResumeRepository } from '../interfaces/IResumeRepository';

export class S3ResumeRepository implements IResumeRepository {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
    this.bucketName = process.env.AWS_S3_BUCKET!;
  }

  async generateUploadUrl(studentId: string, fileType: string): Promise<string> {
    const key = `resumes/${studentId}/${Date.now()}.pdf`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
      ContentLength: 10 * 1024 * 1024, // 10MB max
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return signedUrl;
  }

  async deleteResume(studentId: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: `resumes/${studentId}/${studentId}.pdf`
    });
    await this.s3Client.send(command);
  }

  async getResumeUrl(studentId: string): Promise<string | null> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `resumes/${studentId}/${studentId}.pdf`
    });

    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      return signedUrl;
    } catch (error) {
      return null;
    }
  }
}


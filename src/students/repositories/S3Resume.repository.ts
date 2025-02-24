import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { IResumeRepository } from '../interfaces/IResumeRepository';
import { CustomError } from '../../errors/Custom-Error';
import { BadRequestError } from '../../errors/Bad-Request-Error';

export class S3ResumeRepository implements IResumeRepository {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Ensure all required environment variables are present
    if (!process.env.AWS_ACCESS_KEY_ID || 
        !process.env.AWS_SECRET_ACCESS_KEY || 
        !process.env.AWS_REGION || 
        !process.env.AWS_S3_BUCKET) {
      throw new Error('Missing required AWS configuration');
    }

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },
      forcePathStyle: true // Important for some regions
    });
    
    this.bucketName = process.env.AWS_S3_BUCKET;
  }

  async generateUploadUrl(rollNumber: string, fileType: string): Promise<string> {
    try {
      // Create a unique key for the file using rollNumber
      const key = `resumes/${rollNumber}/latest.pdf`;

      // Create the PUT command with specific parameters
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: fileType //ACL is set to PUBLIC by default
      });

      // Generate signed URL with specific options
      const signedUrl = await getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn: 3600,
        signableHeaders: new Set(['host']), // Minimize signed headers
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new BadRequestError('S3 error');
    }
  }

  async deleteResume(rollNumber: string): Promise<void> {
    try {
      // Define the key for the file to delete
      const key = `resumes/${rollNumber}/latest.pdf`;
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting resume:', error);
      throw new BadRequestError('S3 error');
    }
  }

  async getResumeUrl(rollNumber: string): Promise<string | null> {
    try {
      const key = `resumes/${rollNumber}/latest.pdf`; // Use rollNumber as key
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
        signableHeaders: new Set(['host'])
      });

      return signedUrl;
    } catch (error) {
      console.error('Error getting resume URL:', error);
      return null;
    }
  }
}
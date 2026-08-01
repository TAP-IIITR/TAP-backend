import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { ResumeGeneratorService, ResumeData } from '../services/ResumeGenerator.service';
import { BadRequestError } from '../../errors/Bad-Request-Error';
import { AuthError } from '../../errors/Auth-Error';
import { NotFoundError } from '../../errors/Not-Found-Error';
import logger from '../../utils/logger';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'your-bucket-name';

const resumeGeneratorService = new ResumeGeneratorService();

export const generateResumePreview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { resumeData, template }: { resumeData: ResumeData, template?: string } = req.body;

    if (!resumeData || !resumeData.personalInfo || !resumeData.education) {
      throw new BadRequestError('Missing required resume data');
    }

    const pdfBuffer = await resumeGeneratorService.generatePdf(resumeData, template);

    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error in generateResumePreview', { error });
    next(error);
  }
};

export const saveGeneratedResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { resumeData, template }: { resumeData: ResumeData, template?: string } = req.body;
    const rollNumber = req.user?.id;

    if (!rollNumber) {
      throw new AuthError('Unauthorized');
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      throw new BadRequestError('Missing AWS configuration');
    }

    const pdfBuffer = await resumeGeneratorService.generatePdf(resumeData, template);

    const key = `resumes/${rollNumber}/resume.pdf`;
    const putObjectCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: 'application/pdf',
    });

    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, { expiresIn: 3600 });

    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      body: pdfBuffer as any,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

    if (!s3Response.ok) {
      throw new BadRequestError('S3 upload failed');
    }

    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const userRef = doc(db, 'students', rollNumber);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      throw new NotFoundError('User not found');
    }

    await updateDoc(userRef, {
      resume: {
        url: publicUrl,
        lastUpdated: new Date(),
      },
    });

    logger.info(`Generated resume saved successfully for student ${rollNumber}`);
    res.status(200).json({
      success: true,
      message: 'Resume generated and saved successfully',
      data: { resumeUrl: publicUrl },
    });
  } catch (error) {
    logger.error('Error in saveGeneratedResume', { error });
    next(error);
  }
};

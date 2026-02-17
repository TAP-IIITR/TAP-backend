import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { CustomError } from '../../errors/Custom-Error';
import { NotFoundError } from '../../errors/Not-Found-Error';
import { AuthError } from '../../errors/Auth-Error';
import { BadRequestError } from '../../errors/Bad-Request-Error';
import multer from 'multer';
import logger from '../../utils/logger';
import { db } from '../../config/firebase'; // Adjusted path
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'your-bucket-name';

// Configure multer for PDF files
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      logger.warn(`Invalid file type uploaded for resume: ${file.mimetype}`);
      cb(new BadRequestError('Only PDF files are allowed'));
    }
  },
}).single('resume');

// Middleware to promisify multer upload
const uploadMiddleware = (req: Request, res: Response): Promise<void> =>
  new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error during resume upload', { err });
        reject(new BadRequestError(`Multer error: ${err.message} (Field: ${err.field || 'unknown'})`));
      } else if (err) {
        logger.error('Unknown error during resume upload', { err });
        reject(err);
      } else {
        resolve();
      }
    });
  });

// Upload Resume (PDF)
export const uploadResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      throw new BadRequestError('Missing AWS configuration in environment variables');
    }

    await uploadMiddleware(req, res);

    const file = req.file;
    if (!file) {
      throw new BadRequestError('No resume file provided. Ensure the field name is "resume" and a PDF is attached.');
    }

    const rollNumber = req.user?.id;
    if (!rollNumber) {
      throw new AuthError('Unauthorized');
    }

    const key = `resumes/${rollNumber}/resume.pdf`;
    const putObjectCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: 'application/pdf',
    });

    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, { expiresIn: 3600 });

    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file.buffer as any,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': file.size.toString(),
      },
    });

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      logger.error('S3 resume upload failed', { status: s3Response.status, errorText });
      throw new BadRequestError(`S3 upload failed: ${errorText}`);
    }

    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const userRef = doc(db, 'students', rollNumber);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      logger.warn(`User document not found during resume upload: ${rollNumber}`);
      throw new NotFoundError('User not found');
    }

    await updateDoc(userRef, {
      resume: {
        url: publicUrl,
        lastUpdated: new Date(),
      },
    });

    logger.info(`Resume uploaded successfully for student ${rollNumber}`);
    res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: { resumeUrl: publicUrl },
    });
  } catch (error) {
    logger.error('Error in uploadResume', { error });
    next(error);
  }
};



// Update Resume (PDF)
export const updateResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      throw new BadRequestError('Missing AWS configuration in environment variables');
    }

    await uploadMiddleware(req, res);

    const file = req.file;
    if (!file) {
      throw new BadRequestError('No resume file provided. Ensure the field name is "resume" and a PDF is attached.');
    }

    const rollNumber = req.user?.id;
    if (!rollNumber) {
      throw new AuthError('Unauthorized');
    }

    const key = `resumes/${rollNumber}/resume.pdf`;

    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    const putObjectCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: 'application/pdf',
      ACL: 'public-read',
    });

    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, { expiresIn: 3600 });
    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file.buffer,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': file.size.toString(),
      },
    });

    if (!s3Response.ok) {
      throw new BadRequestError(`S3 upload failed: ${await s3Response.text()}`);
    }

    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    const userRef = doc(db, 'students', rollNumber);
    await updateDoc(userRef, {
      resume: {
        url: publicUrl,
        lastUpdated: new Date(),
      },
    });

    logger.info(`Resume updated successfully for student ${rollNumber}`);
    res.status(200).json({
      success: true,
      message: 'Resume updated successfully',
      data: { resumeUrl: publicUrl },
    });
  } catch (error) {
    logger.error('Error in updateResume', { error });
    next(error);
  }
};

// Get Resume URL
export const getResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rollNumber = req.user?.id;
    if (!rollNumber) {
      throw new AuthError('Unauthorized');
    }

    const key = `resumes/${rollNumber}/resume.pdf`;
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    try {
      await s3Client.send(getObjectCommand);
    } catch (error) {
      logger.warn(`Resume not found in S3 for student ${rollNumber}`);
      throw new NotFoundError('Resume not found');
    }

    res.status(200).json({
      success: true,
      data: { resumeUrl: publicUrl },
    });
  } catch (error) {
    logger.error('Error in getResume', { error });
    next(error);
  }
};
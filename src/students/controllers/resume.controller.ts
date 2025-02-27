import { Request, Response, NextFunction } from 'express';
import { ResumeService } from '../services/Resume.service';
import { S3ResumeRepository } from '../repositories/S3Resume.repository';
import { AuthenticatedRequest } from '../../types/express';
import { CustomError } from '../../errors/Custom-Error';
import multer from 'multer';
import { db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { NotFoundError } from '../../errors/Not-Found-Error';
import { AuthError } from '../../errors/Auth-Error';
import { BadRequestError } from '../../errors/Bad-Request-Error';

// Configure multer for PDF files
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only PDF files are allowed'));
    }
  }  
}).single('resume');

const resumeService = new ResumeService(new S3ResumeRepository());

export const uploadResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  upload(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        throw new NotFoundError('File upload error');
      } else if (err) {
        throw new NotFoundError('File upload error');
      }

      const file = req.file;
      if (!file) {
        throw new NotFoundError('File upload error');
      }

      // Use the existing id property which now contains the rollNumber
      const rollNumber = req.user?.id;
      if (!rollNumber) {
        throw new AuthError('Unauthorized');
      }

      try {
        // Get upload URL from S3 with proper error handling
        const uploadUrl = await resumeService.getUploadUrl(rollNumber, file.mimetype);
        
        // Upload to S3 with proper error handling
        const s3Response = await fetch(uploadUrl, {
          method: 'PUT',
          body: file.buffer,
          headers: {
            'Content-Type': file.mimetype,
            'Content-Length': file.size.toString()
          },
        });

        if (!s3Response.ok) {
          const errorText = await s3Response.text();
          throw new NotFoundError('S3 upload failed');
        }

        // Get the public URL
        const publicUrl = uploadUrl.split('?')[0];

        // Update Firestore with the resume URL
        await updateFirestoreResumeUrl(rollNumber, publicUrl);

        res.status(200).json({
          success: true,
          message: 'Resume uploaded successfully',
          data: { resumeUrl: publicUrl }
        });
      } catch (uploadError) {
        // More specific error handling for S3 operations
        console.error('S3 operation failed:', uploadError);
        throw new BadRequestError('File upload error');
      }
    } catch (error) {
      next(error);
    }
  });
};

const updateFirestoreResumeUrl = async (rollNumber: string, url: string) => {
  try {
    // Using rollNumber as document ID
    const studentRef = doc(db, 'students', rollNumber);
    await updateDoc(studentRef, {
      resume: {
        url,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    throw new BadRequestError('Database error');
  }
};

export const updateResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeUrl } = req.body;
    // Use the existing id property which now contains the rollNumber
    const rollNumber = req.user?.id;

    if (!rollNumber) {
       res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    // Delete old resume if exists
    await resumeService.deleteCurrentResume(rollNumber);
    
    // Update with new resume URL
    await resumeService.updateResumeUrl(rollNumber, resumeUrl);

    res.status(200).json({
      success: true,
      message: 'Resume updated successfully'
    });
  } catch (error) {
    throw new NotFoundError('File upload error');
  }
};

export const getResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Use the existing id property which now contains the rollNumber
    const rollNumber = req.user?.id;

    if (!rollNumber) {
       res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const resumeUrl = await resumeService.getResume(rollNumber);

    if (!resumeUrl) {
       res.status(404).json({
        success: false,
        error: 'Resume not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { resumeUrl }
    });
  } catch (error) {
    throw new NotFoundError('Could get file');
  }
};
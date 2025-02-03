import { Request, Response, NextFunction } from 'express';
import { ResumeService } from '../services/Resume.service';
import { S3ResumeRepository } from '../repositories/S3Resume.repository';
import { AuthenticatedRequest } from '../../types/express';
import { CustomError } from '../../errors/Custom-Error';
import multer from 'multer';
import { db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

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
        throw new CustomError('File upload error', 400, [
          { message: err.message }
        ]);
      } else if (err) {
        throw new CustomError('File upload error', 400, [
          { message: err.message }
        ]);
      }

      const file = req.file;
      if (!file) {
        throw new CustomError('File upload error', 400, [
          { message: 'No file uploaded' }
        ]);
      }

      const studentId = req.user?.id;
      if (!studentId) {
        throw new CustomError('Unauthorized', 401, [
          { message: 'User not authenticated' }
        ]);
      }

      try {
        // Get upload URL from S3 with proper error handling
        const uploadUrl = await resumeService.getUploadUrl(studentId, file.mimetype);
        
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
          throw new CustomError('S3 upload failed', 500, [
            { message: `Failed to upload file to S3: ${errorText}` }
          ]);
        }

        // Get the public URL
        const publicUrl = uploadUrl.split('?')[0];

        // Update Firestore with the resume URL
        await updateFirestoreResumeUrl(studentId, publicUrl);

        res.status(200).json({
          success: true,
          message: 'Resume uploaded successfully',
          data: { resumeUrl: publicUrl }
        });
      } catch (uploadError) {
        // More specific error handling for S3 operations
        console.error('S3 operation failed:', uploadError);
        throw new CustomError('File upload error', 500, [
          { message: 'Failed to process file upload to S3' }
        ]);
      }
    } catch (error) {
      next(error);
    }
  });
};

const updateFirestoreResumeUrl = async (studentId: string, url: string) => {
  try {
    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, {
      resume: {
        url,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    throw new CustomError('Database error', 500, [
      { message: 'Failed to update resume URL in database' }
    ]);
  }
};

export const updateResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resumeUrl } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
       res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    // Delete old resume if exists
    await resumeService.deleteCurrentResume(studentId);
    
    // Update with new resume URL
    await resumeService.updateResumeUrl(studentId, resumeUrl);

    res.status(200).json({
      success: true,
      message: 'Resume updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getResume = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
       res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const resumeUrl = await resumeService.getResume(studentId);

    if (!resumeUrl) {
       res.status(404).json({
        success: false,
        error: 'Resume not found'
      });
      return   ;
    }

    res.status(200).json({
      success: true,
      data: { resumeUrl }
    });
  } catch (error) {
    next(error);
  }
};

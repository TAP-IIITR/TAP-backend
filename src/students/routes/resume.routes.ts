import { Router } from 'express';
import { uploadResume, updateResume, getResume } from '../controllers/resume.controller';
import { generateResumePreview, saveGeneratedResume } from '../controllers/resumeGenerator.controller';
import { checkAuth } from '../../middleware/auth.middleware';
import { body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';

const router = Router();

router.post(
  '/upload-url',
  checkAuth,
  validateRequest,
  uploadResume
);

router.post(
  '/preview',
  checkAuth,
  validateRequest,
  generateResumePreview
);

router.post(
  '/generate',
  checkAuth,
  validateRequest,
  saveGeneratedResume
);

router.put(
  '/',
  checkAuth,
  [
    body('resumeUrl')
      .isURL()
      .withMessage('Invalid resume URL'),
  ],
  validateRequest,
  updateResume
);

router.get('/', checkAuth, getResume);

export { router as resumeRouter };

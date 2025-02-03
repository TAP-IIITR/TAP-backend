import { Router } from 'express';
import { uploadResume, updateResume, getResume } from '../controllers/resume.controller';
import { checkAuth } from '../../middleware/auth.middleware';
import { body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';

const router = Router();

router.post(
  '/upload-url',
  checkAuth,
  [
    body('fileType')
  ],
  validateRequest,
  uploadResume
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

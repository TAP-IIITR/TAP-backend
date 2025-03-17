import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';
import { checkAuth } from '../../middleware/auth.middleware';
import { register, login, logout, resetPassword } from '../controllers/auth.controllers';

const router = Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [
  ],
  validateRequest,
  login
);

router.get('/logout', checkAuth, logout);

router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
  ],
  validateRequest,
  resetPassword
);

export { router as tapAuthRouter };
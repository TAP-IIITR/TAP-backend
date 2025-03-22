import { Router } from 'express';
import { checkAuth } from '../../middleware/auth.middleware';
import { getDashboard, updateCGPA } from '../controllers/dashboard.controllers';
import { checkTapAuth } from '../../middleware/tapauth.middleware';

const router = Router();

router.get('/', checkTapAuth, getDashboard)

router.post('/',
    checkTapAuth,
    updateCGPA
)

export { router as tapDashboardRouter };
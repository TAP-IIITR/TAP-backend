import { Router } from 'express';
import { checkAuth } from '../../middleware/auth.middleware';
import { getDashboard, updateCGPA } from '../controllers/dashboard.controllers';

const router = Router();

router.get('/', checkAuth, getDashboard)

router.post('/',
    checkAuth,
    updateCGPA
)

export { router as tapDashboardRouter };
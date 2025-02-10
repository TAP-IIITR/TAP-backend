import { Router } from 'express';
import { checkAuth } from '../../middleware/auth.middleware';
import { param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';
import { getStudent, getStudentApplications, getStudents } from '../controllers/student.controllers';

const router = Router();

router.get('/',
    [
        query('branch').isString().optional(),
        query('batch').isInt().optional(),
    ],
    validateRequest,
    checkAuth,
    getStudents
)

router.get('/:id',
    [
        param("id").isString().withMessage("ID is Required")
    ],
    validateRequest,
    checkAuth,
    getStudent
)

router.get('/applications/:id',
    [
        param("id").isString().withMessage("ID is Required")
    ],
    validateRequest,
    checkAuth,
    getStudentApplications
)

export { router as tapStudentRouter };
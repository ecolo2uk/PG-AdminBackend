import express from 'express';
import {
    getIntegrationMethods,
    getIntegrationMethodById,
    createIntegrationMethod,
    updateIntegrationMethod,
    deleteIntegrationMethod
} from '../controllers/integrationMethodController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js'; // Assuming you have auth middleware

const router = express.Router();

// Public routes for now, add protect/authorize as needed
router.route('/')
    .get(getIntegrationMethods) // protect, authorize('admin')
    .post(createIntegrationMethod); // protect, authorize('admin')

router.route('/:id')
    .get(getIntegrationMethodById) // protect, authorize('admin')
    .put(updateIntegrationMethod) // protect, authorize('admin')
    .delete(deleteIntegrationMethod); // protect, authorize('admin')

export default router;
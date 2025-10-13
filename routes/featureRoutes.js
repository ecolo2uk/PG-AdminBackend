// routes/featureRoutes.js
import express from 'express';
const router = express.Router();
import {
    getFeatures,
    getFeatureById,
    createFeature,
    updateFeature,
    deleteFeature,
} from '../controllers/featureController.js';

// If you have authentication middleware (e.g., `protect` and `admin`),
// you would add them here. For simplicity, I'm omitting them,
// but remember to secure your routes in a real application.
// import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/')
    .get(getFeatures)
    .post(createFeature); // Add protect, admin if needed

router.route('/:id')
    .get(getFeatureById)
    .put(updateFeature) // Add protect, admin if needed
    .delete(deleteFeature); // Add protect, admin if needed

export default router;
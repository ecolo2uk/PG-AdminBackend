import express from 'express';
const router = express.Router();
import {
    getFeatures,
    getFeatureById,
    createFeature,
    updateFeature,
    deleteFeature,
} from '../controllers/featureController.js';



router.route('/')
    .get(getFeatures)
    .post(createFeature); 

router.route('/:id')
    .get(getFeatureById)
    .put(updateFeature) 
    .delete(deleteFeature); 

export default router;
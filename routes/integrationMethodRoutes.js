import express from 'express';
import {
    getIntegrationMethods,
    getIntegrationMethodById,
    createIntegrationMethod,
    updateIntegrationMethod,
    deleteIntegrationMethod
} from '../controllers/integrationMethodController.js';

const router = express.Router();

router.route('/')
    .get(getIntegrationMethods) 
    .post(createIntegrationMethod); 

router.route('/:id')
    .get(getIntegrationMethodById) 
    .put(updateIntegrationMethod) 
    .delete(deleteIntegrationMethod); 

export default router;
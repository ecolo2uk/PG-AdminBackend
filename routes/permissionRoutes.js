import express from 'express';
const router = express.Router();
import * as permissionController from '../controllers/permissionController.js';
import mongoose from 'mongoose'; 


router.get('/role/:roleId', permissionController.getModuleSubmodulePermissions);
router.post('/role/:roleId', permissionController.saveRolePermissions); 
router.get('/modules', permissionController.getAllModulesAndSubmodules); 

export default router;
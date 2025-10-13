// permissionRoutes.js
import express from 'express';
const router = express.Router();
import * as permissionController from '../controllers/permissionController.js';
import mongoose from 'mongoose'; // Added for mongoose.Types.ObjectId.isValid check

// Get all modules, submodules, and existing permissions for a specific role
router.get('/role/:roleId', permissionController.getModuleSubmodulePermissions);
// Save/Update permissions for a specific role
router.post('/role/:roleId', permissionController.saveRolePermissions); // Used for saving permissions
// Get all modules and submodules (general) - NEW ROUTE FOR CREATE ROLE PAGE
router.get('/modules', permissionController.getAllModulesAndSubmodules); // This is what the frontend calls

export default router;
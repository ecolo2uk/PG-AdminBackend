import express from 'express';
const router = express.Router();

// Change from require() to import and add .js extension
import {
  getPSPUsers,
  createPSPUser,
  updatePSPUser,
  deletePSPUser
} from '../controllers/pspController.js'; // Added .js extension

// Get all PSP users
router.get('/users', getPSPUsers);

// Create PSP user
router.post('/users', createPSPUser);

// Update PSP user by ID
router.put('/users/:id', updatePSPUser);

// Delete PSP user by ID
router.delete('/users/:id', deletePSPUser);

export default router;
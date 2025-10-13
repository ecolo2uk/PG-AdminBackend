import express from 'express';
const router = express.Router();

import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser
} from '../controllers/adminController.js'; // This is now correct
router.get('/users', getAdminUsers);

// Create admin user
router.post('/users', createAdminUser);

// Update admin user
router.put('/users/:id', updateAdminUser);

// Delete admin user
router.delete('/users/:id', deleteAdminUser);

export default router;
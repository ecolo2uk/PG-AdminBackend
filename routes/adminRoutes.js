import express from 'express';
const router = express.Router();

import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser
} from '../controllers/adminController.js'; 
router.get('/users', getAdminUsers);

router.post('/users', createAdminUser);


router.put('/users/:id', updateAdminUser);


router.delete('/users/:id', deleteAdminUser);

export default router;
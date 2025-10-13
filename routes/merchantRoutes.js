import express from 'express';
import {
  getAllMerchants,
  getMerchantUsers,
  createMerchantUser,
  updateMerchantUser,
  deleteMerchantUser
} from '../controllers/merchantController.js';

const router = express.Router();

// Get all merchants (simple list)
router.get('/', getAllMerchants);

// Merchant users routes
router.get('/users', getMerchantUsers);
router.post('/users', createMerchantUser);
router.put('/users/:id', updateMerchantUser);
router.delete('/users/:id', deleteMerchantUser);

export default router;
import express from 'express';
import {
  getAllMerchants,
  getMerchantUsers,
  createMerchantUser,
  updateMerchantUser,
  deleteMerchantUser,
  getMerchantById
} from '../controllers/merchantController.js';

const router = express.Router();

// Merchant routes
router.get('/', getAllMerchants);
router.get('/users', getMerchantUsers);
router.post('/users', createMerchantUser);
router.put('/users/:id', updateMerchantUser);
router.delete('/users/:id', deleteMerchantUser);
router.get('/:id', getMerchantById);

export default router;
// routes/merchantFee.js
import express from 'express';
import {
  createMerchantFee,
  getMerchantFeeHistory,
  getMerchantFeeById,
  updateMerchantFee,
  deleteMerchantFee,
  getMerchantsList,
  getFeeStatistics
} from '../controllers/merchantFeeController.js';

const router = express.Router();

// Merchant Fee Routes
router.post('/create', createMerchantFee);
router.get('/history', getMerchantFeeHistory);
router.get('/statistics', getFeeStatistics);
router.get('/merchants/list', getMerchantsList);
router.get('/:id', getMerchantFeeById);
router.put('/:id', updateMerchantFee);
router.delete('/:id', deleteMerchantFee);

export default router;
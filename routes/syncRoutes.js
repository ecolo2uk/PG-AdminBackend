// routes/syncRoutes.js
import express from 'express';
import {   syncAllExistingTransactions, 
  syncMerchantTransactions  } from '../controllers/syncController.js';

const router = express.Router();
router.post('/all', syncAllExistingTransactions);
router.post('/merchant/:merchantId', syncMerchantTransactions);

export default router;
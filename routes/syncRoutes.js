// routes/syncRoutes.js
import express from 'express';
import { syncMerchantTransactions } from '../controllers/syncController.js';

const router = express.Router();

router.post('/merchant/:merchantId', syncMerchantTransactions);

export default router;
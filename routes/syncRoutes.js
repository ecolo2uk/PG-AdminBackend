// routes/syncRoutes.js
import express from 'express';
import { 
  syncAllExistingTransactions, 
  syncMerchantTransactions,
  fixTransactionBalances,
  debugTransactions  // Add this
} from '../controllers/syncController.js';

const router = express.Router();

router.post('/all', syncAllExistingTransactions);
router.post('/merchant/:merchantId', syncMerchantTransactions);
router.post('/fix-balances', fixTransactionBalances);  // Add this
router.get('/debug', debugTransactions);  // Add this

export default router;
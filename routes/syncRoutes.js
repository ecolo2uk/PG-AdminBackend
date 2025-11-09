// routes/syncRoutes.js
import express from 'express';
import { 
  syncAllExistingTransactions, 
  syncMerchantTransactions,
  fixTransactionBalances,
  debugTransactions 
} from '../controllers/transactionSyncController.js'; // ← Update import path

const router = express.Router();

router.get('/all', syncAllExistingTransactions);
router.get('/merchant/:merchantId', syncMerchantTransactions);
router.get('/fix-balances', fixTransactionBalances);
router.get('/debug', debugTransactions);

export default router;
import express from 'express';
import { 
  syncAllExistingTransactions, 
  syncMerchantTransactions,
  fixTransactionBalances,
  debugTransactions 
} from '../controllers/transactionSyncController.js'; 

const router = express.Router();

router.get('/all', syncAllExistingTransactions);
router.get('/merchant/:merchantId', syncMerchantTransactions);
router.get('/fix-balances', fixTransactionBalances);
router.get('/debug', debugTransactions);

export default router;
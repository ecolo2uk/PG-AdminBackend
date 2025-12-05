import express from 'express';
import { 
  syncAllExistingTransactions, 
  syncMerchantTransactions 
} from '../controllers/autoSyncController.js';

const router = express.Router();

router.post('/sync-all', syncAllExistingTransactions);
router.post('/merchants/:merchantId/sync', syncMerchantTransactions);

export default router;
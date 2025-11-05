// Add to your backend routes file (payoutTransactionRoutes.js)
import express from 'express';
import {
  getPayoutTransactions,
  getMerchantList,
  getConnectorList,
  createPayoutTransaction,
  getMerchantTransactionsSummary,
  exportPayoutTransactions,
  updatePayoutTransactionStatus,
} from '../controllers/payoutTransactionController.js';

const router = express.Router();

// Add test routes first
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payout Transactions API is working!',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payout API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Your existing routes
router.get('/', getPayoutTransactions);
router.post('/', createPayoutTransaction);
router.patch('/:id/status', updatePayoutTransactionStatus);
router.get('/merchants/list', getMerchantList);
router.get('/connectors/list', getConnectorList);
router.get('/merchant/:merchantId/transactions', getMerchantTransactionsSummary);
router.get('/export/excel', exportPayoutTransactions);

export default router;
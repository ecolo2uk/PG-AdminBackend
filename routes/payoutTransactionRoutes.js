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

router.get('/', getPayoutTransactions);
router.post('/', createPayoutTransaction);
router.patch('/:id/status', updatePayoutTransactionStatus);
router.get('/merchants/list', getMerchantList);
router.get('/connectors/list', getConnectorList);
router.get('/merchant/:merchantId/transactions', getMerchantTransactionsSummary);
router.get('/export/excel', exportPayoutTransactions);

export default router;
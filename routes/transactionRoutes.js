// routes/transactionRoutes.js
import express from 'express';
import {
  createPaymentTransaction,
  updateTransactionStatus,
  getAllPaymentTransactions,
  getPaymentTransactionById,
  getMerchantPayoutBalance,
  getAllTransactionsSimple,
  getPaymentLinkDetails,
  processPaymentViaLink
} from '../controllers/transactionController.js';

const router = express.Router();

router.post('/', createPaymentTransaction);
router.put('/:id', updateTransactionStatus);
router.get('/', getAllPaymentTransactions);
router.get('/simple', getAllTransactionsSimple);
router.get('/:id', getPaymentTransactionById);
router.get('/merchant-balance/:merchantId', getMerchantPayoutBalance);

// Payment Link Routes
router.get('/payment-link/:shortLinkId', getPaymentLinkDetails);
router.post('/payment-link/:shortLinkId/process', processPaymentViaLink);

export default router;
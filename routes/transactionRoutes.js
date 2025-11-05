import express from 'express';
import {
  createPaymentTransaction,
  updateTransactionStatus,
  getAllPaymentTransactions,
  getPaymentTransactionById,
  getMerchantPayoutBalance,
  getAllTransactionsSimple // ✅ ADD THIS
} from '../controllers/transactionController.js';

const router = express.Router();

// Define all routes
router.post('/', createPaymentTransaction);
router.put('/:id', updateTransactionStatus);
router.get('/', getAllPaymentTransactions);
router.get('/simple', getAllTransactionsSimple); // ✅ ADD THIS ROUTE
router.get('/:id', getPaymentTransactionById);
router.get('/merchant-balance/:merchantId', getMerchantPayoutBalance);

export default router;
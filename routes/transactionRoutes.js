import express from 'express';
import {
  createPaymentTransaction,
  updateTransactionStatus,
  getAllPaymentTransactions,
  getPaymentTransactionById,
  getMerchantPayoutBalance,
  getAllTransactionsSimple
} from '../controllers/transactionController.js';

const router = express.Router();

router.post('/', createPaymentTransaction);
router.put('/:id', updateTransactionStatus);
router.get('/', getAllPaymentTransactions);
router.get('/simple', getAllTransactionsSimple);
router.get('/:id', getPaymentTransactionById);
router.get('/merchant-balance/:merchantId', getMerchantPayoutBalance);

export default router;
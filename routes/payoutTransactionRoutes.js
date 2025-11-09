// routes/payoutTransaction.js
import express from 'express';
import {
  createPayoutToMerchant,
  getPayoutTransactions,
  createInternalPayoutTransaction,
  getPayoutTransactionById,
  getMerchantBankDetails,
  getAllMerchantsForPayout,
  createPayoutTransaction,
  getConnectors,
  getPayoutSupportedConnectors
} from '../controllers/payoutTransactionController.js';

const router = express.Router();

// Make sure ALL these routes match what your frontend is calling
router.post('/internal', createInternalPayoutTransaction);
router.post('/to-merchant', createPayoutToMerchant);
router.post('/', createPayoutTransaction);
router.get('/', getPayoutTransactions);
router.get('/merchants/list', getAllMerchantsForPayout);
router.get('/connectors/list', getConnectors);
router.get('/:id', getPayoutTransactionById);
router.get('/bank-details/:merchantId', getMerchantBankDetails);
router.get('/connectors/payout-supported', getPayoutSupportedConnectors);

export default router;
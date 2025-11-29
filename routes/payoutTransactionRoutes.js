// routes/payoutTransaction.js - CLEAN VERSION
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

// POST Routes
router.post('/to-merchant', createPayoutToMerchant);
router.post('/internal', createInternalPayoutTransaction);
router.post('/', createPayoutTransaction);

// GET Routes
router.get('/', getPayoutTransactions);
router.get('/merchants/list', getAllMerchantsForPayout);
router.get('/connectors/list', getConnectors);
router.get('/connectors/payout-supported', getPayoutSupportedConnectors);
router.get('/:id', getPayoutTransactionById);
router.get('/bank-details/:merchantId', getMerchantBankDetails);

export default router;
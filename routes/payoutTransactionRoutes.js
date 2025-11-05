import express from 'express';
import {
  createPayoutToMerchant,
  getPayoutTransactions,
  createInternalPayoutTransaction, // Make sure this is imported
  getPayoutTransactionById,
  getMerchantBankDetails,
  getAllMerchantsForPayout,
  createPayoutTransaction,
  getConnectors,
  getPayoutSupportedConnectors
} from '../controllers/payoutTransactionController.js';

const router = express.Router();

// Make sure these routes exist
router.post('/internal', createInternalPayoutTransaction);
router.post('/to-merchant', createPayoutToMerchant);
router.post('/', createPayoutTransaction);
router.get('/', getPayoutTransactions);
router.get('/merchants/list', getAllMerchantsForPayout);
router.get('/:id', getPayoutTransactionById);
router.get('/connectors/list', getConnectors);
router.get('/bank-details/:merchantId', getMerchantBankDetails);
router.get('/connectors/payout-supported', getPayoutSupportedConnectors);

export default router;
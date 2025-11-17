// routes/merchant.js - FIXED VERSION
import express from 'express';
import {
  getAllMerchants,
  getMerchantUsers,
  createMerchantUser,
  updateMerchantUser,
  deleteMerchantUser,
  getMerchantById,
  getMerchantDetails,
  updateMerchantBalance,
  getMerchantBalanceHistory,
  getMerchantWithTransactions,
  getMerchantTransactionStats,
  getMerchantDashboard,
  syncMerchantTransactions,
  getMerchantConnectors  // ✅ Make sure this is imported
} from '../controllers/merchantController.js';

const router = express.Router();

// Merchant routes
router.get('/', getAllMerchants);
router.get('/users', getMerchantUsers);
router.post('/users', createMerchantUser);
router.put('/users/:id', updateMerchantUser);
router.delete('/users/:id', deleteMerchantUser);
router.get('/users/:id', getMerchantById);

// ✅ THIS IS THE CRITICAL ROUTE - Make sure it's defined
router.get('/:merchantId/connector-accounts', getMerchantConnectors);

// Other routes...
router.get('/:merchantId', getMerchantDetails);
router.put('/:merchantId/balance', updateMerchantBalance);
router.get('/:merchantId/balance-history', getMerchantBalanceHistory);
router.get('/:merchantId/transactions', getMerchantWithTransactions);
router.get('/:merchantId/transaction-stats', getMerchantTransactionStats);
router.get('/:merchantId/dashboard', getMerchantDashboard);
router.post('/:merchantId/sync-transactions', syncMerchantTransactions);

export default router;
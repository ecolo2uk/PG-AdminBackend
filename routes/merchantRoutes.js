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
 syncMerchantTransactions
} from '../controllers/merchantController.js';

const router = express.Router();

// Merchant routes
router.get('/', getAllMerchants); // Get all merchants with details
router.get('/users', getMerchantUsers); // Get merchant users (from User model)
router.post('/users', createMerchantUser); // Create merchant user
router.put('/users/:id', updateMerchantUser); // Update merchant user
router.delete('/users/:id', deleteMerchantUser); // Delete merchant user
router.get('/users/:id', getMerchantById); // Get single merchant user

// New Merchant Table routes
router.get('/:merchantId', getMerchantDetails); // Get merchant with all details
router.put('/:merchantId/balance', updateMerchantBalance); // Update merchant balance
router.get('/:merchantId/balance-history', getMerchantBalanceHistory); // Get balance history
router.get('/:merchantId/transactions', getMerchantWithTransactions); // Get merchant with transactions
router.get('/:merchantId/transaction-stats', getMerchantTransactionStats); // Get transaction stats
router.get('/:merchantId/dashboard', getMerchantDashboard);
router.post('/:merchantId/sync-transactions', syncMerchantTransactions);


export default router;
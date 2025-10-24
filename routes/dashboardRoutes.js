import express from 'express';
import { 
  getDashboardAnalytics, 
  getMerchantTransactionSummary,
  getRecentOrders,
  getAllMerchants,
  getTransactionsByMerchant,
  getTransactionsByMerchantStatus,
  debugDataStructure,
  getSalesReport 
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/analytics', getDashboardAnalytics);
router.get('/recent-orders', getRecentOrders);
router.get('/merchant-transaction-summary', getMerchantTransactionSummary);
router.get('/merchants', getAllMerchants);
router.get('/transactions-by-merchant', getTransactionsByMerchantStatus);
router.get('/debug-structure', debugDataStructure);
router.get('/transactions-by-merchant', getTransactionsByMerchant);
router.get('/sales-report', getSalesReport); // <--- ADD THIS ROUTE

export default router;
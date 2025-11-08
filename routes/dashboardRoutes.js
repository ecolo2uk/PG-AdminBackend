import express from 'express';
import { 
  getDashboardAnalytics, 
  getMerchantTransactionSummary,
  getAllMerchants,
  getTransactionsByMerchantStatus,
  getSalesReport,
  getAllTransactions ,
  getMerchantDashboard// Assuming you want this too, it's defined in the controller
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/analytics', getDashboardAnalytics);
// router.get('/recent-orders', getRecentOrders); // Removed
router.get('/merchant-transaction-summary', getMerchantTransactionSummary);
router.get('/merchants', getAllMerchants);
router.get('/transactions-by-merchant', getTransactionsByMerchantStatus);
// router.get('/debug-structure', debugDataStructure); // Removed
// router.get('/transactions-by-merchant', getTransactionsByMerchant); // Removed - duplicate, use getTransactionsByMerchantStatus
router.get('/sales-report', getSalesReport);
router.get('/all-transactions', getAllTransactions); // Added route for getAllTransactions
router.get('/merchants/:merchantId/dashboard', getMerchantDashboard); // <--- ADD THIS ROUTE

export default router;
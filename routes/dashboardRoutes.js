import express from 'express';
import { 
  getDashboardAnalytics, 
  getMerchantTransactionSummary,
  getRecentOrders,
  getAllMerchants,
  getTransactionsByMerchant,
  getTransactionsByMerchantStatus,
  debugDataStructure,
  getSaleReportData,
  debugSaleReport // नवीन function import करा
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/analytics', getDashboardAnalytics);
router.get('/recent-orders', getRecentOrders);
router.get('/merchant-transaction-summary', getMerchantTransactionSummary);
router.get('/merchants', getAllMerchants);
router.get('/transactions-by-merchant', getTransactionsByMerchantStatus);
router.get('/debug-structure', debugDataStructure);
router.get('/transactions-by-merchant', getTransactionsByMerchant);
router.get('/sale-report', getSaleReportData);  // नवीन route जोडा
// routes/dashboard.js मध्ये
router.get('/debug-sale-report', debugSaleReport);
export default router;
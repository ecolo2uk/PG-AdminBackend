import express from 'express';
import { 
 getDashboardAnalytics, 
  getMerchantTransactionSummary,
  getAllMerchants,
  getTransactionsByMerchantStatus,
  getSalesReport,
  getAllTransactions ,
  checkTransaction
  // Assuming you want this too, it's defined in the controller
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/analytics', getDashboardAnalytics);
router.get('/merchant-transaction-summary', getMerchantTransactionSummary); 
router.get('/merchants', getAllMerchants);
router.get('/transactions-by-merchant', getTransactionsByMerchantStatus);
router.get('/sales-report', getSalesReport);
router.get('/all-transactions', getAllTransactions); // Added route for getAllTransactions
router.get('/checkTransaction', checkTransaction); // Added route for checkTransactionData

export default router;
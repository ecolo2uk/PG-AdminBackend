import express from 'express';
import {
  // getAllTransactions, // <--- Remove or comment this out
  // getTransactionById, // <--- This function also appears to have changed
  // getAllTransactionsSimple, // <--- This function also appears to have changed
  createPaymentTransaction, // Add this
  updateTransactionStatus,  // Add this
  getAllPaymentTransactions, // Add this
  getPaymentTransactionById, // Add this
  getMerchantPayoutBalance // Add this
} from '../controllers/transactionController.js';

const router = express.Router();

// Existing routes (adjust as per new controller functions)
router.post('/', createPaymentTransaction); // Route for creating a payment transaction
router.put('/:id', updateTransactionStatus); // Route for updating transaction status
router.get('/', getAllPaymentTransactions); // Use the new function for getting all transactions
router.get('/:id', getPaymentTransactionById); // Use the new function for getting a single transaction by ID
router.get('/merchant-balance/:merchantId', getMerchantPayoutBalance); // Route to get merchant payout balance


// If you still need a simple version for testing, uncomment and adjust:
// router.get('/simple', getAllTransactionsSimple); // Make sure getAllTransactionsSimple is actually exported in the controller if you use this.


export default router;
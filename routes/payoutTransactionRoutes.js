import express from 'express';
import {
  getPayoutTransactions,
  createPayoutToMerchant,
  createInternalPayoutTransaction,
  getPayoutTransactionById,
  getAllMerchantsForPayout,
  getPayoutSupportedConnectors,
  getMerchantBankDetails,
} from '../controllers/payoutTransactionController.js';

const router = express.Router();

// Test route to check database connection and data
router.get('/test-data', async (req, res) => {
  try {
    const PayoutTransaction = (await import('../models/PayoutTransaction.js')).default;
    const transactionCount = await PayoutTransaction.countDocuments();
    const sampleTransaction = await PayoutTransaction.findOne();
    
    res.json({
      success: true,
      totalTransactions: transactionCount,
      sampleTransaction: sampleTransaction,
      message: `Found ${transactionCount} payout transactions in database`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking database',
      error: error.message
    });
  }
});

// Create sample transaction for testing
router.post('/test-create-sample', async (req, res) => {
  try {
    const PayoutTransaction = (await import('../models/PayoutTransaction.js')).default;
    const User = (await import('../models/User.js')).default;
    
    // Get first merchant
    const merchant = await User.findOne({ role: 'merchant' });
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'No merchant found to create sample transaction'
      });
    }

    const sampleTransaction = new PayoutTransaction({
      merchantId: merchant._id,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      amount: 1000,
      currency: 'INR',
      paymentMode: 'IMPS',
      transactionType: 'Debit',
      status: 'Success',
      remark: 'Sample test transaction',
      utr: `TEST${Date.now()}`,
      recipientAccountNumber: '1234567890',
      recipientBankName: 'Test Bank',
      recipientAccountHolderName: 'Test Account Holder'
    });

    await sampleTransaction.save();

    res.json({
      success: true,
      message: 'Sample transaction created successfully',
      transaction: sampleTransaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating sample transaction',
      error: error.message
    });
  }
});

// Main routes
router.post('/', createInternalPayoutTransaction);
router.post('/to-merchant', createPayoutToMerchant);
router.get('/', getPayoutTransactions);
router.get('/:id', getPayoutTransactionById);
router.get('/merchants/list', getAllMerchantsForPayout);
router.get('/connectors/list', getPayoutSupportedConnectors);
router.get('/merchant-bank-details/:merchantId', getMerchantBankDetails);

export default router;
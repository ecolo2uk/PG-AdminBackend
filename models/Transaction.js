// models/Transaction.js
import mongoose from 'mongoose';
import Merchant from './Merchant.js';
import User from './User.js';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  merchantOrderId: {
    type: String,
    required: true
  },
  merchantHashId: {
    type: String,
    required: true
  },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  merchantName: {
    type: String,
    required: true
  },
  mid: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'INR'
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
    default: 'Pending'
  },
  "Commission Amount": { // Using quotes due to space
    type: Number,
    default: 0
  },
  "Settlement Status": { // Using quotes due to space
    type: String,
    enum: ['Pending', 'Settled', 'Failed'],
    default: 'Pending'
  },
  "Vendor Ref ID": {
    type: String
  },
  upiId: {
    type: String // For merchant's VPA or payer's VPA if collected
  },
  merchantVpa: {
    type: String, // Merchant's VPA specifically
    required: true
  },
  txnRefId: {
    type: String, // Enpay's transaction ID or our own reference if Enpay's isn't available
    required: true
  },
  txnNote: {
    type: String
  },
  paymentMethod: {
    type: String,
    required: true
  },
  paymentOption: {
    type: String,
    required: true
  },
  source: {
    type: String, // e.g., 'enpay', 'razorpay'
    required: true
  },
  isMock: {
    type: Boolean,
    default: false
  },
  paymentUrl: { // The direct Enpay or mock payment URL
    type: String
  },
  qrCode: { // If a QR code image URL is provided
    type: String
  },
  enpayTxnId: { // Actual transaction ID from Enpay
    type: String
  },
  // New fields for short link functionality
  encryptedPaymentPayload: {
    type: String // To store the encrypted data needed by the frontend
  },
  shortLinkId: {
    type: String,
    unique: true, // Ensure short link IDs are unique
    sparse: true // Allows null values, useful if not all transactions get short links
  }
}, { timestamps: true });

transactionSchema.post('save', async function(doc) {
  try {
    console.log(`🔄 Auto-syncing transaction to merchant: ${doc.transactionId}`);
    
    // Find merchant via user
    const merchant = await Merchant.findOne({ userId: doc.merchantId });
    
    if (!merchant) {
      console.log('❌ Merchant not found for auto-sync');
      return;
    }

    // 1. Add to paymentTransactions array
    if (!merchant.paymentTransactions.includes(doc._id)) {
      merchant.paymentTransactions.push(doc._id);
    }

    // 2. Update recentTransactions array
    const newTransaction = {
      transactionId: doc.transactionId,
      type: 'payment',
      transactionType: 'Credit',
      amount: doc.amount,
      status: doc.status,
      reference: doc.merchantOrderId,
      method: doc.paymentMethod,
      remark: 'Payment Received',
      date: doc.createdAt,
      customer: doc.customerName || 'N/A'
    };

    merchant.recentTransactions.unshift(newTransaction);
    
    // Keep only last 20 transactions
    if (merchant.recentTransactions.length > 20) {
      merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
    }

    // 3. UPDATE BALANCE if transaction is successful
    if (doc.status === 'SUCCESS' || doc.status === 'Success') {
      merchant.availableBalance += doc.amount;
      merchant.totalCredits += doc.amount;
      merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
      
      // Also update user balance
      await User.findByIdAndUpdate(doc.merchantId, {
        $inc: { balance: doc.amount }
      });
    }

    // 4. Update transaction counts
    merchant.totalTransactions = merchant.paymentTransactions.length;
    merchant.successfulTransactions = merchant.paymentTransactions.filter(
      txnId => txnId.status === 'SUCCESS' || txnId.status === 'Success'
    ).length;

    await merchant.save();
    console.log(`✅ Auto-synced transaction for merchant: ${merchant.merchantName}`);

  } catch (error) {
    console.error('❌ Error in transaction auto-sync:', error);
  }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
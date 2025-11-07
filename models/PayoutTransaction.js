import mongoose from 'mongoose';
import Merchant from './Merchant.js';
import User from './User.js';

const payoutTransactionSchema = new mongoose.Schema({
  utr: {
    type: String,
    unique: true,
    sparse: true,
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  merchantName: {
    type: String,
    required: true,
  },
  
  // ✅ ADDED: Fields for your UI
  accountNumber: { 
    type: String,
    default: "N/A"
  },
  connector: { 
    type: String,
    default: "Manual"
  },
  webhook: { 
    type: String,
    default: "N/A"
  },
  feeApplied: {
    type: Boolean,
    default: false,
  },
  
  // Existing fields
  recipientMerchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
  },
  recipientBankName: { type: String },
  recipientAccountNumber: { type: String },
  recipientIfscCode: { type: String },
  recipientAccountHolderName: { type: String },
  recipientAccountType: { type: String, enum: ['Saving', 'Current'] },
  
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  paymentMode: {
    type: String,
    required: true,
    enum: ['IMPS', 'NEFT', 'RTGS', 'Bank Transfer', 'Wallet Transfer'],
  },
  transactionType: {
    type: String,
    enum: ['Debit', 'Credit'],
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Success", "Failed", "Initiated", "Processing", "Cancelled"],
    default: 'Pending',
  },
  connectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connector',
    sparse: true,
  },
  connectorAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConnectorAccount',
    sparse: true,
  },
  connectorTxnId: { type: String },
  customerEmail: { type: String },
  customerPhoneNumber: { type: String },
  remark: { type: String },
  responseUrl: { type: String },
  webhookUrl: { type: String },
  applyFee: {
    type: Boolean,
    default: false,
  },
  feeAmount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});
payoutTransactionSchema.post('save', async function(doc) {
  try {
    console.log(`🔄 Auto-syncing payout to merchant: ${doc.transactionId}`);
    
    const merchant = await Merchant.findOne({ userId: doc.merchantId });
    
    if (!merchant) {
      console.log('❌ Merchant not found for payout auto-sync');
      return;
    }

    // Add to payoutTransactions array
    if (!merchant.payoutTransactions.includes(doc._id)) {
      merchant.payoutTransactions.push(doc._id);
    }

    // Update recentTransactions
    const newPayout = {
      transactionId: doc.transactionId || doc.utr,
      type: 'payout',
      transactionType: doc.transactionType,
      amount: doc.amount,
      status: doc.status,
      reference: doc.utr,
      method: doc.paymentMode,
      remark: doc.remark || 'Payout Processed',
      date: doc.createdAt,
      customer: 'N/A'
    };

    merchant.recentTransactions.unshift(newPayout);
    
    if (merchant.recentTransactions.length > 20) {
      merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
    }

    // UPDATE BALANCE for successful debit transactions
    if (doc.status === 'Success' && doc.transactionType === 'Debit') {
      merchant.availableBalance -= doc.amount;
      merchant.totalDebits += doc.amount;
      merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
      
      // Also update user balance
      await User.findByIdAndUpdate(doc.merchantId, {
        $inc: { balance: -doc.amount }
      });
    }

    await merchant.save();
    console.log(`✅ Auto-synced payout for merchant: ${merchant.merchantName}`);

  } catch (error) {
    console.error('❌ Error in payout auto-sync:', error);
  }
});

const PayoutTransaction = mongoose.model('PayoutTransaction', payoutTransactionSchema);
export default PayoutTransaction;
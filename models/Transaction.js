import mongoose from 'mongoose';

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
  merchantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
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
    default: 'INR'
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
    default: 'Pending'
  },
  "Commission Amount": { // ✅ EXACT name as in your database
    type: Number,
    default: 0
  },
  "Settlement Status": { // ✅ EXACT name as in your database
    type: String,
    enum: ['Pending', 'Settled', 'Failed'],
    default: 'Pending'
  },
  "Vendor Ref ID": { // ✅ EXACT name as in your database
    type: String,
    default: ''
  },
  "Vendor Txn ID": { // ✅ EXACT name as in your database
    type: String,
    default: ''
  },
  upiId: {
    type: String,
    default: ''
  },
  merchantVpa: {
    type: String,
    required: true
  },
  txnRefId: {
    type: String,
    required: true
  },
  txnNote: {
    type: String,
    default: ''
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
    type: String,
    default: 'enpay'
  },
  isMock: {
    type: Boolean,
    default: false
  },
  paymentUrl: {
    type: String,
    default: ''
  },
  qrCode: {
    type: String,
    default: ''
  },
  enpayTxnId: {
    type: String,
    default: ''
  },
  "Customer Name": { // ✅ EXACT name as in your database
    type: String,
    default: ''
  },
  "Customer VPA": { // ✅ EXACT name as in your database
    type: String,
    default: ''
  },
  "Customer Contact No": { // ✅ EXACT name as in your database
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  encryptedPaymentPayload: {
    type: String,
    default: ''
  },
  shortLinkId: {
    type: String,
    unique: true,
    sparse: true
  }
}, { 
  timestamps: true 
});

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
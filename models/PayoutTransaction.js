// import mongoose from 'mongoose';
// import Merchant from './Merchant.js';
// import User from './User.js';

// const payoutTransactionSchema = new mongoose.Schema({
//   payoutId: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   utr: {
//     type: String,
//     unique: true,
//     sparse: true,
//   },
//   transactionId: {
//     type: String,
//     unique: true,
//     sparse: true,
//   },
//     merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

//   merchantName: {
//     type: String,
//     required: true,
//   },
//    merchantEmail: {
//     type: String,
//     required: true
//   },
//   mid: {
//     type: String,
//     required: true
//   },

//     settlementId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Settlement'
//   },
//   settlementBatch: {
//     type: String
//   },
  
//   // ✅ ADDED: Fields for your UI
//   accountNumber: { 
//     type: String,
//     default: "N/A"
//   },
//   connector: { 
//     type: String,
//     default: "Manual"
//   },
//   webhook: { 
//     type: String,
//     default: "N/A"
//   },
//   feeApplied: {
//     type: Boolean,
//     default: false,
//   },
  
//   // Existing fields
//   recipientMerchantId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     sparse: true,
//   },
//   recipientBankName: { type: String },
//   recipientAccountNumber: { type: String },
//   recipientIfscCode: { type: String },
//   recipientAccountHolderName: { type: String },
//   recipientAccountType: { type: String, enum: ['Saving', 'Current'] },
  
//   amount: {
//     type: Number,
//     required: true,
//   },
//    settlementAmount: {
//     type: Number,
//     required: true
//   },
//   currency: {
//     type: String,
//     default: 'INR',
//   },
//   paymentMode: {
//     type: String,
//     required: true,
//     enum: ['IMPS', 'NEFT', 'RTGS', 'Bank Transfer', 'Wallet Transfer'],
//   },
//   transactionType: {
//     type: String,
//     enum: ['Debit', 'Credit'],
//     required: true,
//   },
//   status: {
//     type: String,
//     enum: ["Pending", "Success", "Failed", "Initiated", "Processing", "Cancelled"],
//     default: 'Pending',
//   },
//   connectorId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Connector',
//     sparse: true,
//   },
//   connectorAccountId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'ConnectorAccount',
//     sparse: true,
//   },
//   connectorTxnId: { type: String },
//   customerEmail: { type: String },
//   customerPhoneNumber: { type: String },
//   remark: { type: String },
//   responseUrl: { type: String },
//   webhookUrl: { type: String },
//   applyFee: {
//     type: Boolean,
//     default: false,
//   },
//   feeAmount: {
//     type: Number,
//     default: 0,
//   },
//     bankDetails: {
//     bankName: String,
//     accountNumber: String,
//     ifscCode: String,
//     accountHolderName: String,
//     accountType: String
//   },
//     paymentMode: {
//     type: String,
//     default: 'NEFT'
//   },
//   remark: {
//     type: String,
//     default: 'Payout Settlement'
//   },
//   processedBy: {
//     type: String,
//     default: 'System'
//   },
//  initiatedAt: {
//     type: Date,
//     default: Date.now
//   },
//   processedAt: Date,
//   completedAt: Date
  
// }, {
//   timestamps: true,
// });
// payoutTransactionSchema.post('save', async function(doc) {
//   try {
//     console.log(`🔄 Auto-syncing payout to merchant: ${doc.transactionId}`);
    
//     const merchant = await Merchant.findOne({ userId: doc.merchantId });
    
//     if (!merchant) {
//       console.log('❌ Merchant not found for payout auto-sync');
//       return;
//     }

//     // 1. Add to payoutTransactions array
//     if (!merchant.payoutTransactions.includes(doc._id)) {
//       merchant.payoutTransactions.push(doc._id);
//     }

//     // 2. Update recentTransactions
//     const newPayout = {
//       transactionId: doc.transactionId || doc.utr,
//       type: 'payout',
//       transactionType: doc.transactionType,
//       amount: doc.amount,
//       status: doc.status,
//       reference: doc.utr,
//       method: doc.paymentMode,
//       remark: doc.remark || 'Payout Processed',
//       date: doc.createdAt,
//       customer: 'N/A'
//     };

//     merchant.recentTransactions.unshift(newPayout);
    
//     if (merchant.recentTransactions.length > 20) {
//       merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
//     }

//     // 3. UPDATE BALANCE for successful transactions
//     if (doc.status === 'Success') {
//       if (doc.transactionType === 'Debit') {
//         merchant.availableBalance -= doc.amount;
//         merchant.totalDebits += doc.amount;
        
//         // Also update user balance
//         await User.findByIdAndUpdate(doc.merchantId, {
//           $inc: { balance: -doc.amount }
//         });
//       } else if (doc.transactionType === 'Credit') {
//         merchant.availableBalance += doc.amount;
//         merchant.totalCredits += doc.amount;
        
//         // Also update user balance
//         await User.findByIdAndUpdate(doc.merchantId, {
//           $inc: { balance: doc.amount }
//         });
//       }
      
//       merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
//     }

//     await merchant.save();
//     console.log(`✅ Auto-synced payout for merchant: ${merchant.merchantName}`);

//   } catch (error) {
//     console.error('❌ Error in payout auto-sync:', error);
//   }
// });




// // PayoutTransaction model मध्ये indexes जोडा
// payoutTransactionSchema.index({ utr: 1 }, { 
//   unique: true, 
//   sparse: true,
//   background: true 
// });

// payoutTransactionSchema.index({ transactionId: 1 }, { 
//   unique: true, 
//   sparse: true,
//   background: true 
// });

// payoutTransactionSchema.index({ 
//   merchantId: 1, 
//   createdAt: -1 
// }, { background: true });

// payoutTransactionSchema.post('save', async function(doc) {
//   try {
//     const Merchant = mongoose.model('Merchant');
//     const User = mongoose.model('User');
    
//     const merchant = await Merchant.findOne({ userId: doc.merchantId });
    
//     if (!merchant) {
//       console.log('❌ Merchant not found for payout auto-sync');
//       return;
//     }

//     // Add to payoutTransactions array
//     if (!merchant.payoutTransactions.includes(doc._id)) {
//       merchant.payoutTransactions.push(doc._id);
//     }

//     // Update recentTransactions
//     const newPayout = {
//       transactionId: doc.payoutId,
//       type: 'payout',
//       transactionType: doc.transactionType,
//       amount: doc.amount,
//       status: doc.status,
//       reference: doc.utr || doc.payoutId,
//       method: doc.paymentMode,
//       remark: doc.remark || 'Payout Settlement',
//       date: doc.createdAt,
//       customer: 'N/A'
//     };

//     merchant.recentTransactions.unshift(newPayout);
    
//     if (merchant.recentTransactions.length > 20) {
//       merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
//     }

//     // Update balance for successful settlements
//     if (doc.status === 'SUCCESS' && doc.transactionType === 'Debit') {
//       merchant.availableBalance -= doc.amount;
//       merchant.totalDebits += doc.amount;
//       merchant.unsettledBalance -= doc.amount;
      
//       // Also update user balance and unsettleBalance
//       await User.findByIdAndUpdate(doc.merchantId, {
//         $inc: { 
//           balance: -doc.amount,
//           unsettleBalance: -doc.amount
//         }
//       });
      
//       merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
//     }

//     await merchant.save();
//     console.log(`✅ Auto-synced settlement for merchant: ${merchant.merchantName}`);

//   } catch (error) {
//     console.error('❌ Error in settlement auto-sync:', error);
//   }
// });
// const PayoutTransaction = mongoose.model('PayoutTransaction', payoutTransactionSchema);
// export default PayoutTransaction;



// models/PayoutTransaction.js - CORRECTED VERSION
import mongoose from 'mongoose';

const payoutTransactionSchema = new mongoose.Schema({
  // Required unique identifiers
  payoutId: {
    type: String,
    required: true,
    unique: true
  },
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
  
  // Merchant information
  merchantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  merchantName: {
    type: String,
    required: true,
  },
  merchantEmail: {
    type: String,
    required: true
  },
  mid: {
    type: String,
    required: true
  },

  // Settlement information
  settlementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settlement',
    sparse: true
  },
  settlementBatch: {
    type: String
  },
  settlementAmount: {
    type: Number,
    required: true
  },
  
  // Transaction details
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
  feeAmount: {
    type: Number,
    default: 0,
  },
  
  // Recipient bank details (for external payouts)
  recipientBankName: { type: String },
  recipientAccountNumber: { type: String },
  recipientIfscCode: { type: String },
  recipientAccountHolderName: { type: String },
  recipientAccountType: { type: String, enum: ['Saving', 'Current'] },
  recipientMerchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
  },
  
  // Transaction core fields
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
  
  // Connector information
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
  
  // Customer information
  customerEmail: { type: String },
  customerPhoneNumber: { type: String },
  
  // Additional fields
  remark: { type: String },
  responseUrl: { type: String },
  webhookUrl: { type: String },
  applyFee: {
    type: Boolean,
    default: false,
  },
  
  // Bank details (simplified - remove duplicate)
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    accountType: String
  },
  
  // Processing information
  processedBy: {
    type: String,
    default: 'System'
  },
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  completedAt: Date
  
}, {
  timestamps: true,
});

// Remove duplicate post-save hooks and keep only one
payoutTransactionSchema.post('save', async function(doc) {
  try {
    console.log(`🔄 Auto-syncing payout to merchant: ${doc.transactionId}`);
    
    const Merchant = mongoose.model('Merchant');
    const User = mongoose.model('User');
    
    const merchant = await Merchant.findOne({ userId: doc.merchantId });
    
    if (!merchant) {
      console.log('❌ Merchant not found for payout auto-sync');
      return;
    }

    // 1. Add to payoutTransactions array
    if (!merchant.payoutTransactions.includes(doc._id)) {
      merchant.payoutTransactions.push(doc._id);
    }

    // 2. Update recentTransactions
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

    // 3. UPDATE BALANCE for successful transactions
    if (doc.status === 'Success') {
      if (doc.transactionType === 'Debit') {
        merchant.availableBalance -= doc.amount;
        merchant.totalDebits += doc.amount;
        
        // Also update user balance
        await User.findByIdAndUpdate(doc.merchantId, {
          $inc: { balance: -doc.amount }
        });
      } else if (doc.transactionType === 'Credit') {
        merchant.availableBalance += doc.amount;
        merchant.totalCredits += doc.amount;
        
        // Also update user balance
        await User.findByIdAndUpdate(doc.merchantId, {
          $inc: { balance: doc.amount }
        });
      }
      
      merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
    }

    await merchant.save();
    console.log(`✅ Auto-synced payout for merchant: ${merchant.merchantName}`);

  } catch (error) {
    console.error('❌ Error in payout auto-sync:', error);
  }
});

// Indexes
payoutTransactionSchema.index({ utr: 1 }, { 
  unique: true, 
  sparse: true,
  background: true 
});

payoutTransactionSchema.index({ transactionId: 1 }, { 
  unique: true, 
  sparse: true,
  background: true 
});

payoutTransactionSchema.index({ 
  merchantId: 1, 
  createdAt: -1 
}, { background: true });

const PayoutTransaction = mongoose.model('PayoutTransaction', payoutTransactionSchema);
export default PayoutTransaction;
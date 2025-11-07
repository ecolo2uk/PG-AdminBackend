// models/Merchant.js
import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Merchant Basic Info
  merchantName: {
    type: String,
    required: true
  },
  company: {
    type: String,
    default: '' // ✅ FIX: Remove required, add default
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  contact: {
    type: String,
    required: true
  },
  mid: {
    type: String,
    required: true,
    unique: true
  },
  
  // Financial Information
  availableBalance: {
    type: Number,
    default: 0
  },
  unsettledBalance: {
    type: Number,
    default: 0
  },
  totalCredits: {
    type: Number,
    default: 0
  },
  totalDebits: {
    type: Number,
    default: 0
  },
  netEarnings: {
    type: Number,
    default: 0
  },
  
  // Bank Details
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    accountType: {
      type: String,
      enum: ['Saving', 'Current']
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  
  // Statistics
  totalTransactions: {
    type: Number,
    default: 0
  },
  successfulTransactions: {
    type: Number,
    default: 0
  },
  failedTransactions: {
    type: Number,
    default: 0
  },
  
  // Transactions Array
  recentTransactions: [{
    transactionId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['payment', 'payout'],
      required: true
    },
    transactionType: {
      type: String,
      enum: ['Credit', 'Debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    reference: {
      type: String,
      required: true
    },
    method: String,
    remark: String,
    date: {
      type: Date,
      default: Date.now
    },
    customer: String
  }],
  
  // Daily/Weekly transaction summary
  transactionSummary: {
    today: {
      credits: { type: Number, default: 0 },
      debits: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    last7Days: {
      credits: { type: Number, default: 0 },
      debits: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    last30Days: {
      credits: { type: Number, default: 0 },
      debits: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    }
  },
   paymentTransactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  payoutTransactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayoutTransaction'
  }],
}, {
  timestamps: true
});

// Update updatedAt on save
merchantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Merchant = mongoose.model('Merchant', merchantSchema);
export default Merchant;
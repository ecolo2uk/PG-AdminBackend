// models/MerchantFee.js
import mongoose from 'mongoose';

const merchantFeeSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  merchantName: {
    type: String,
    required: true
  },
  merchantEmail: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  feeType: {
    type: String,
    required: true,
    enum: [
      'TRANSACTION_FEE',
      'MONTHLY_FEE', 
      'SETUP_FEE',
      'CHARGEBACK_FEE',
      'REFUND_FEE',
      'GATEWAY_FEE',
      'MAINTENANCE_FEE',
      'OTHER'
    ]
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'FAILED', 'REFUNDED'],
    default: 'PROCESSED'
  },
  currency: {
    type: String,
    default: 'INR'
  },
  transactionReference: {
    type: String,
    unique: true
  },
  appliedDate: {
    type: Date,
    default: Date.now
  },
  processedBy: {
    type: String,
    default: 'System'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Generate transaction reference
merchantFeeSchema.pre('save', async function(next) {
  if (!this.transactionReference) {
    const count = await mongoose.model('MerchantFee').countDocuments();
    this.transactionReference = `MF${Date.now()}${count + 1}`;
  }
  next();
});

// Index for better performance
merchantFeeSchema.index({ merchantId: 1, appliedDate: -1 });
merchantFeeSchema.index({ feeType: 1 });
merchantFeeSchema.index({ status: 1 });

export default mongoose.model('MerchantFee', merchantFeeSchema);
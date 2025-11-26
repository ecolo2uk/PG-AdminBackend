// models/Settlement.js
import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
  settlementId: {
    type: String,
    required: true,
    unique: true
  },
  batchId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Settlement details
  totalAmount: {
    type: Number,
    required: true
  },
  totalMerchants: {
    type: Number,
    required: true
  },
  settlementDate: {
    type: Date,
    default: Date.now
  },
  
  // Status
  status: {
    type: String,
    enum: ['INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'],
    default: 'INITIATED'
  },
  
  // Selected merchants for settlement
  selectedMerchants: [{
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
    unsettleBalance: {
      type: Number,
      required: true
    },
    settlementAmount: {
      type: Number,
      required: true
    },
    mid: {
      type: String,
      required: true
    }
  }],
  
  // Processing information
  processedBy: {
    type: String,
    default: 'Admin'
  },
  processedAt: Date,
  completedAt: Date,
  
  // Additional details
  remarks: String,
  failureReason: String
}, {
  timestamps: true
});

// Generate settlement IDs
settlementSchema.pre('save', async function(next) {
  if (!this.settlementId) {
    this.settlementId = `STL${Date.now()}`;
  }
  if (!this.batchId) {
    const count = await mongoose.model('Settlement').countDocuments();
    this.batchId = `BATCH${Date.now()}${count + 1}`;
  }
  next();
});

export default mongoose.model('Settlement', settlementSchema);
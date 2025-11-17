// models/Transaction.js - SIMPLIFIED VERSION
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // Core required fields
  transactionId: { type: String, required: true, unique: true },
  merchantOrderId: { type: String, required: true },
  merchantHashId: { type: String, required: true },
  merchantVpa: { type: String, required: true },
  txnRefId: { type: String, required: true, unique: true },
  
  // Merchant info
  merchantId: { type: mongoose.Schema.Types.Mixed, required: true },
  merchantName: { type: String, required: true },
  mid: { type: String, required: true },
  
  // Payment details
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'INITIATED' 
  },
  paymentMethod: { type: String, required: true },
  paymentOption: { type: String, required: true },
  paymentUrl: { type: String, default: '' },
  
  // Connector info
  connectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector' },
  connectorAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConnectorAccount' },
  terminalId: { type: String, required: true },
  
  // Customer info (using simple field names)
  customerName: { type: String, default: '' },
  customerVpa: { type: String, default: '' },
  customerContact: { type: String, default: '' },
  
  // Additional fields with defaults
  txnNote: { type: String, default: '' },
  source: { type: String, default: 'enpay' },
  qrCode: { type: String, default: '' },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Remove the complex post-save hook for now to simplify debugging
transactionSchema.post('save', async function(doc) {
  console.log(`✅ Transaction saved: ${doc.transactionId}`);
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
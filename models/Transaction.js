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
    type: String, // Changed to String to match your static merchant IDs
    required: true
  },
  merchantName: {
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
    enum: ['Pending', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'Pending'
  },
  upiId: {
    type: String,
    default: ''
  },
  qrCode: {
    type: String,
    default: ''
  },
  paymentUrl: {
    type: String,
    default: ''
  },
  txnNote: {
    type: String,
    default: ''
  },
  txnRefId: {
    type: String,
    default: ''
  },
  merchantVpa: {
    type: String,
    default: ''
  },
  paymentMethod: {
    type: String,
    default: 'UPI'
  },
  paymentOption: {
    type: String,
    default: ''
  },
  enpayTxnId: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    default: 'enpay'
  },
  isMock: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
// models/Transaction.js
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
    type: String,
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

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
// backend/models/Transaction.js (Already provided, just confirming changes)
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true, // Added unique constraint back, important for idempotency
    sparse: true,
  },
  merchantOrderId: { type: String },
  merchantHashId: { type: String },
  merchantId: { // MUST be ObjectId to reference User model
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // A transaction must belong to a merchant
  },
  merchantName: { type: String }, // Denormalized
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ["Pending", "Success", "Failed", "Cancelled", "Refund", "SUCCESS", "FAILED", "PENDING", "REFUND", "INITIATED"],
    default: 'Pending'
  },
  commissionAmount: { type: Number, default: 0 },
  customerName: { type: String },
  customerVPA: { type: String },
  customerContact: { type: String },
  upiId: { type: String },
  qrCode: { type: String },
  paymentUrl: { type: String },
  txnNote: { type: String },
  txnRefId: { type: String }, // Our internal reference
  merchantVpa: { type: String },
  paymentMethod: { type: String },
  paymentOption: { type: String },
  enpayTxnId: { type: String }, // Could be a general `connectorTxnId`
  source: { type: String, default: 'enpay' },
  isMock: { type: Boolean, default: false },

  // Fields from the first image example (if not already covered)
  // These seem to be covered by commissionAmount, customerName, customerVPA, customerContact

  // Fields from the second image example (if not already covered)
  // These seem to be covered by upiId, qrCode, paymentUrl, txnNote, txnRefId, merchantVpa

  // If you need to map old fields during migration:
  "Vendor Ref ID": { type: String }, // Potentially map to connectorTxnId
  "Vendor Txn ID": { type: String }, // Potentially map to connectorTxnId
  "Transaction Status": { type: String }, // Map to status
  "Settlement Status": { type: String }, // Needs a separate settlement model/field if distinct
  "Transaction Date": { type: Date }, // Convert to Date type
  "Amount": { type: Number }, // Map to amount
  "Commission Amount": { type: Number }, // Map to commissionAmount
  "Customer Name": { type: String }, // Map to customerName
  "Customer VPA": { type: String }, // Map to customerVPA
  "Customer Contact No": { type: String }, // Map to customerContact
  "Merchant Name": { type: String }, // Map to merchantName
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for faster lookups
transactionSchema.index({ merchantId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ merchantOrderId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
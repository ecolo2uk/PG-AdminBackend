// backend/models/PayoutTransaction.js
import mongoose from 'mongoose';

const payoutTransactionSchema = new mongoose.Schema({
  utr: { // Unique Transaction Reference - from the bank or payment network
    type: String,
    unique: true,
    sparse: true, // Allows nulls to not violate uniqueness
  },
  merchantId: { // The merchant *initiating* the payout (or whose balance is affected)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  merchantName: { // Denormalized for quick access
    type: String,
    required: true,
  },
  recipientMerchantId: { // Optional: if payout is to another merchant in your system
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
  paymentMode: { // e.g., IMPS, NEFT, RTGS, Bank Transfer, Wallet Transfer
    type: String,
    required: true,
    enum: ['IMPS', 'NEFT', 'RTGS', 'Bank Transfer', 'Wallet Transfer'], // Add more as needed
  },
  transactionType: { // Debit or Credit (for the initiating merchant's balance)
    type: String,
    enum: ['Debit', 'Credit'], // Debit for outgoing payout, Credit for incoming adjustment
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Success", "Failed", "Initiated", "Processing", "Cancelled"],
    default: 'Pending',
  },
  connectorId: { // Which connector handled this payout (if external)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connector',
    sparse: true,
  },
  connectorAccountId: { // Which connector account was used
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConnectorAccount',
    sparse: true,
  },
  connectorTxnId: { // Transaction ID from the external connector
    type: String,
    sparse: true,
  },
  customerEmail: { type: String },
  customerPhoneNumber: { type: String },
  remark: { type: String },
  responseUrl: { type: String }, // For webhook callbacks from external providers
  webhookUrl: { type: String }, // For sending callbacks to the initiating merchant
  applyFee: { // If a fee was applied to this payout
    type: Boolean,
    default: false,
  },
  feeAmount: { // The amount of fee applied
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const PayoutTransaction = mongoose.model('PayoutTransaction', payoutTransactionSchema);
export default PayoutTransaction;
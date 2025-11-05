import mongoose from 'mongoose';

const payoutTransactionSchema = new mongoose.Schema({
  utr: {
    type: String,
    unique: true,
    sparse: true,
  },
    transactionId: {
    type: String,
    unique: true,
    sparse: true, // ✅ This allows multiple null values
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  merchantName: {
    type: String,
    required: true,
  },
  recipientMerchantId: {
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
  customerEmail: { type: String },
  customerPhoneNumber: { type: String },
  remark: { type: String },
  responseUrl: { type: String },
  webhookUrl: { type: String },
  applyFee: {
    type: Boolean,
    default: false,
  },
  feeAmount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const PayoutTransaction = mongoose.model('PayoutTransaction', payoutTransactionSchema);
export default PayoutTransaction;
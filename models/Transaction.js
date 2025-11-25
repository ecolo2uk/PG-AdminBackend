
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // Core transaction identifiers
  transactionId: { type: String, required: true, unique: true },
  merchantOrderId: { type: String, required: true },
  merchantHashId: { type: String, required: true },
  merchantVpa: { type: String, required: true },
  txnRefId: { type: String, required: true, unique: true },
  shortLinkId: { type: String, unique: true, sparse: true },
  
  // Merchant information
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  merchantName: { type: String, required: true },
  mid: { type: String, required: true },
  
  // Payment details
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REDIRECTED'],
    default: 'INITIATED' 
  },
  paymentMethod: { type: String, required: true },
  paymentOption: { type: String, required: true },
  paymentUrl: { type: String, default: '' },
  
  // Connector information
  connectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector' },
  connectorAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConnectorAccount' },
  connectorName: { type: String, required: true },
  connectorUsed: { type: String, required: true },
  terminalId: { type: String, required: true },
  
  // Customer information
  customerName: { type: String, default: '' },
  customerVpa: { type: String, default: '' },
  customerContact: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  
  // Additional fields
  txnNote: { type: String, default: '' },
  source: { type: String, default: 'payment_gateway' },
  qrCode: { type: String, default: '' },
  encryptedPaymentPayload: { type: String, default: '' },
   gatewayTxnId: { type: String, default: '' }, // सर्व gateways साठी common field
  gatewayPaymentLink: { type: String, default: '' },
  gatewayOrderId: { type: String, default: '' }, // Cashfree order_id साठी
  // Enpay specific fields
  enpayTxnId: { type: String, default: '' },
  enpayQrCode: { type: String, default: '' },
  enpayPaymentLink: { type: String, default: '' },
   commissionAmount: { type: Number, default: 0 },
  settlementStatus: { type: String, default: 'PENDING' },
  // Timestamps
   cfOrderId: { type: String, default: '' },
  cfPaymentLink: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  redirectedAt: { type: Date }
}, {
  timestamps: true
});

// Generate short link ID
transactionSchema.methods.generateShortLink = function() {
  const shortId = require('shortid').generate();
  this.shortLinkId = shortId;
  return shortId;
};

export default mongoose.model('Transaction', transactionSchema);
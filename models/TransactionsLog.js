import mongoose from "mongoose";

const TransactionsLogSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Reference to source transaction
  referenceType: {
    type: String,
    enum: ["PAYIN", "PAYOUT", "REFUND", "REVERSAL", "SETTLEMENT"],
    required: true,
  },

  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },

  referenceNo: {
    type: String, // transactionId / payoutId
    index: true,
  },
  referenceTxnId: String,

  description: String,

  // =========================
  // BANK STATEMENT FIELDS
  // =========================
  debit: {
    type: Number,
    default: 0,
  },

  credit: {
    type: Number,
    default: 0,
  },

  balance: {
    type: Number,
    required: true, // balance AFTER txn
  },

  currency: {
    type: String,
    default: "INR",
  },

  status: {
    type: String,
    enum: [
      "INITIATED",
      "Processed",
      "PENDING",
      "SUCCESS",
      "FAILED",
      "REVERSED",
    ],
    default: "INITIATED",
    index: true,
  },

  /* ===== CONNECTOR INFO ===== */
  connector: {
    name: String,
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connector",
    },
    connectorAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectorAccount",
    },
    gatewayTransactionId: String,
    gatewayOrderId: String,
    gatewayRefId: String,
  },

  /* ===== PAYOUT BANK INFO ===== */
  payoutAccount: {
    beneficiaryName: String,
    bankName: String,
    accountNumber: String,
    ifsc: String,
    payoutMethod: String,
  },

  // Meta
  source: {
    type: String,
    enum: ["SYSTEM", "API", "WEBHOOK", "CRON"],
    default: "SYSTEM",
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },

  txnInitiatedDate: Date,
  txnCompletedDate: Date,
});

TransactionsLogSchema.index({ merchantId: 1, createdAt: -1 });
TransactionsLogSchema.index(
  { referenceType: 1, referenceId: 1 },
  { unique: true }
);

export default mongoose.model("TransactionsLog", TransactionsLogSchema);

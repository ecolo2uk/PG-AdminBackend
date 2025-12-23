import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC TRANSACTION INFO
    // =========================
    transactionId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },

    merchantOrderId: { type: String },
    merchantHashId: { type: String },
    merchantVpa: { type: String },

    txnRefId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },

    shortLinkId: {
      type: String,
      unique: true,
      sparse: true,
    },

    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    merchantName: {
      type: String,
      required: true,
    },

    transactionMerchantName: String,
    transactionMerchantID: String,
    transactionOrderID: String,
    utr: String,

    mid: {
      type: String,
      default: "DEFAULT_MID",
    },

    // =========================
    // AMOUNT & STATUS
    // =========================
    amount: {
      type: Number,
      default: null,
    },

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      default: "INITIATED",
      enum: [
        "INITIATED",
        "PENDING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
        "REDIRECTED",
      ],
    },

    payInApplied: { type: Boolean, default: false },
    wasFailed: { type: Boolean, default: false },
    totalApplied: { type: Boolean, default: false },

    previousStatus: {
      type: String,
    },

    // =========================
    // PAYMENT DETAILS
    // =========================
    paymentMethod: {
      type: String,
      default: "UPI",
    },

    paymentOption: String,

    paymentUrl: {
      type: String,
      default: "",
    },

    source: {
      type: String,
      default: "payment_gateway",
    },

    txnNote: {
      type: String,
      default: "",
    },

    // =========================
    // CONNECTOR INFO
    // =========================
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connector",
    },

    connectorAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectorAccount",
    },

    connectorName: String,
    connectorUsed: String,

    terminalId: {
      type: String,
      default: "N/A",
    },

    paymentGateway: String,
    gatewayTransactionId: String,

    // =========================
    // QR & PAYMENT LINK INFO
    // =========================
    qrCode: {
      type: String,
      default: "",
    },

    encryptedPaymentPayload: {
      type: String,
      default: "",
    },

    gatewayTxnId: {
      type: String,
      default: "",
    },

    gatewayPaymentLink: {
      type: String,
      default: "",
    },

    gatewayOrderId: {
      type: String,
      default: "",
    },

    cfOrderId: {
      type: String,
      default: "",
    },

    cfPaymentLink: {
      type: String,
      default: "",
    },

    cfQrCode: {
      type: String,
      default: "",
    },

    cfError: String,
    cfResponse: mongoose.Schema.Types.Mixed,
    cfTransactionStatus: String,
    cfInitiationStatus: {
      type: String,
      default: "NOT_ATTEMPTED",
    },

    razorPayTxnId: {
      type: String,
      default: "",
    },

    razorPayPaymentLink: {
      type: String,
      default: "",
    },

    razorPayQrCode: {
      type: String,
      default: "",
    },

    razorPayError: String,
    razorPayResponse: mongoose.Schema.Types.Mixed,
    razorPayTransactionStatus: String,
    razorPayInitiationStatus: {
      type: String,
      default: "NOT_ATTEMPTED",
    },
    // =========================
    // ENPAY FIELDS (MERGED)
    // =========================
    enpayInitiationStatus: {
      type: String,
      enum: [
        "NOT_ATTEMPTED",
        "ATTEMPTED_SUCCESS",
        "ATTEMPTED_FAILED",
        "ENPAY_CREATED",
      ],
      default: "NOT_ATTEMPTED",
    },

    enpayTxnId: {
      type: String,
      default: "",
    },

    enpayQrCode: {
      type: String,
      default: "",
    },

    enpayPaymentLink: {
      type: String,
      default: "",
    },

    enpayError: String,
    enpayResponse: mongoose.Schema.Types.Mixed,
    enpayTransactionStatus: String,

    // =========================
    // CUSTOMER INFO
    // =========================
    customerName: {
      type: String,
      default: "",
    },

    customerVpa: {
      type: String,
      default: "",
    },

    customerContact: {
      type: String,
      default: "",
    },

    customerEmail: {
      type: String,
      default: "",
    },

    upiId: String,

    // =========================
    // SETTLEMENT INFO
    // =========================
    commissionAmount: {
      type: Number,
      default: 0,
    },

    netAmount: {
      type: Number,
      default: 0,
    },

    settlementStatus: {
      type: String,
      default: "UNSETTLED",
      enum: ["UNSETTLED", "SETTLED", "PROCESSING", "PENDING"],
    },

    vendorRefId: String,

    // =========================
    // FLAGS
    // =========================
    isDefaultQR: {
      type: Boolean,
      default: false,
    },

    isStaticQR: {
      type: Boolean,
      default: false,
    },

    // =========================
    // DATE FIELDS
    // =========================
    transactionCompletedAt: Date,
    transactionInitiatedAt: Date,
    redirectedAt: Date,

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "transactions",
    timestamps: true,
  }
);

// =========================
// INDEXES (MERGED)
// =========================
transactionSchema.index({ merchantId: 1, createdAt: -1 });
// transactionSchema.index({ transactionId: 1 });
// transactionSchema.index({ txnRefId: 1 });
transactionSchema.index({ enpayTxnId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ paymentMethod: 1, createdAt: -1 });
transactionSchema.index({ status: 1, payInApplied: 1 });

// =========================
// METHODS
// =========================
transactionSchema.methods.generateShortLink = function () {
  const shortId = require("shortid").generate();
  this.shortLinkId = shortId;
  return shortId;
};

export default mongoose.model("Transaction", transactionSchema);

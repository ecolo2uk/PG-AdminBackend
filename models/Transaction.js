import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    merchantOrderId: { type: String, required: true },
    merchantHashId: { type: String, required: true },
    merchantVpa: { type: String, required: true },
    txnRefId: { type: String, required: true, unique: true },
    shortLinkId: { type: String, unique: true, sparse: true },

    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    merchantName: { type: String, required: true },
    transactionMerchantName: { type: String },
    transactionMerchantID: { type: String },
    transactionOrderID: { type: String },
    mid: { type: String, required: true },

    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: [
        "INITIATED",
        "PENDING",
        "SUCCESS",
        "FAILED",
        "REFUNDED",
        "CANCELLED",
        // "REDIRECTED",
      ],
      default: "INITIATED",
    },
    paymentMethod: { type: String, required: true },
    paymentOption: { type: String, required: true },
    paymentUrl: { type: String, default: "" },

    connectorId: { type: mongoose.Schema.Types.ObjectId, ref: "Connector" },
    connectorAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectorAccount",
    },
    connectorName: { type: String, required: true },
    connectorUsed: { type: String },
    terminalId: { type: String, default: "N/A" },

    customerName: { type: String, default: "" },
    customerVpa: { type: String, default: "" },
    customerContact: { type: String, default: "" },
    customerEmail: { type: String, default: "" },

    txnNote: { type: String, default: "" },
    source: { type: String, default: "payment_gateway" },
    qrCode: { type: String, default: "" },
    encryptedPaymentPayload: { type: String, default: "" },
    gatewayTxnId: { type: String, default: "" },
    gatewayPaymentLink: { type: String, default: "" },
    gatewayOrderId: { type: String, default: "" },
    enpayTxnId: { type: String, default: "" },
    enpayQRCode: { type: String, default: "" },
    enpayPaymentLink: { type: String, default: "" },
    commissionAmount: { type: Number, default: 0 },
    settlementStatus: { type: String, default: "PENDING" },
    cfOrderId: { type: String, default: "" },
    cfPaymentLink: { type: String, default: "" },
    transactionCompletedAt: { type: Date },
    transactionInitiatedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    redirectedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

transactionSchema.methods.generateShortLink = function () {
  const shortId = require("shortid").generate();
  this.shortLinkId = shortId;
  return shortId;
};

export default mongoose.model("Transaction", transactionSchema);

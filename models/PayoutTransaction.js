import mongoose from "mongoose";

const payoutTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true
    },
    orderId: {
      type: String,
    },
    utr: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: ["Success", "Pending", "Failed", "Processing", "Refund"],
      default: "Pending"
    },
    merchantName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    connector: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    paymentMode: {
      type: String,
      enum: ["IMPS", "NEFT", "RTGS", "UPI"],
      default: "IMPS"
    },
    type: {
      type: String,
      enum: ["API", "Manual"],
      default: "Manual"
    },
    webhook: {
      type: String,
      default: "0 / 0"
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    connectorAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectorAccount"
    },
    remark: {
      type: String,
      default: ""
    },
    feeApplied: {
      type: Boolean,
      default: false
    },
    feeAmount: {
      type: Number,
      default: 0
    },
    netAmount: {
      type: Number,
      default: 0
    },
    transactionType: {
      type: String,
      enum: ["Debit", "Credit"],
      required: true,
      default: "Debit"
    }
  },
  { timestamps: true }
);

payoutTransactionSchema.pre("save", async function(next) {
  if (this.isModified('amount') || this.isModified('feeAmount') || this.isNew) {
    this.netAmount = this.amount - (this.feeApplied ? this.feeAmount : 0);
  }

  if (this.isNew && !this.utr) {
    this.utr = `UTR${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  if (this.isNew && !this.transactionId) {
    this.transactionId = `TXN${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  if (this.isNew && !this.orderId) {
    this.orderId = `ORD${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  next();
});

const PayoutTransaction = mongoose.model("PayoutTransaction", payoutTransactionSchema);
export default PayoutTransaction;
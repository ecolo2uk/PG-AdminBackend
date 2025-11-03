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
      required: true
    },
    utr: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["Success", "Pending", "Failed", "Processing"],
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
      default: "API"
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
    }
  },
  { timestamps: true }
);

// Pre-save middleware to calculate net amount
payoutTransactionSchema.pre("save", function(next) {
  if (this.feeApplied && this.amount) {
    this.netAmount = this.amount - this.feeAmount;
  } else {
    this.netAmount = this.amount;
  }
  next();
});

const PayoutTransaction = mongoose.model("PayoutTransaction", payoutTransactionSchema);
export default PayoutTransaction;
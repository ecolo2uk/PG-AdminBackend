// models/BankSettlement.js
import mongoose from "mongoose";

const bankSettlementSchema = new mongoose.Schema(
  {
    settlementId: {
      type: String,
      required: true,
      unique: true,
    },
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connector",
      required: true,
    },
    connectorAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectorAccount",
      required: true,
    },
    connectorName: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    settlementAmount: {
      type: Number,
      required: true,
    },
    settlementDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
    remarks: {
      type: String,
      default: "",
    },
    processedBy: {
      type: String,
      default: "Admin",
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better performance
bankSettlementSchema.index({ settlementDate: -1 });
bankSettlementSchema.index({ connectorId: 1 });
// bankSettlementSchema.index({ settlementId: 1 });

export default mongoose.model("BankSettlement", bankSettlementSchema);

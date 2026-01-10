// models/MerchantPayoutConnectorAccount.js
import mongoose from "mongoose";

const MerchantPayoutConnectorAccountSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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
  terminalId: { type: String, unique: true },
  industry: { type: String, default: "Gaming" },
  percentage: { type: Number, default: 100 },
  isPrimary: { type: Boolean, default: false },
  status: { type: String, default: "Active", enum: ["Active", "Inactive"] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model(
  "MerchantPayoutConnectorAccount",
  MerchantPayoutConnectorAccountSchema
);

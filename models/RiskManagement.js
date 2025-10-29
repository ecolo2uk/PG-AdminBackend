import mongoose from "mongoose";

const RiskManagementSchema = new mongoose.Schema(
  {
    riskType: {
      type: String,
      required: true,
      enum: ["Email", "UPI", "USER_ID", "Transaction", "IP", "Country"]
    },
    riskValue: {
      type: String,
      required: true
    },
    email: {
      type: String
    },
    upi: {
      type: String
    },
    userId: {
      type: String
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

const RiskManagement = mongoose.model("RiskManagement", RiskManagementSchema);
export default RiskManagement;
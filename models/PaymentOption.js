import mongoose from "mongoose";

const paymentOptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    iconClass: {
      type: String,
      required: false, // Optional
      trim: true,
    },
    iconImage: {
      type: String,
      required: false, // Optional, could be a URL to an image
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
); // Adds createdAt and updatedAt fields

const PaymentOption = mongoose.model("PaymentOption", paymentOptionSchema);

export default PaymentOption;

// models/BusinessSize.js
import mongoose from "mongoose";

const businessSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    iconClass: {
      type: String,
      default: "",
    },
    iconImage: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

const BusinessSize = mongoose.model("BusinessSize", businessSizeSchema);

export default BusinessSize;

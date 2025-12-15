// models/featureModel.js
import mongoose from "mongoose";

const featureSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    iconClass: {
      type: String,
      default: "", // Optional field
    },
    iconImage: {
      type: String,
      default: "", // Optional field for image URL or path
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

const Feature = mongoose.model("Feature", featureSchema);

export default Feature;

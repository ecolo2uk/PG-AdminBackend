import mongoose from "mongoose";

const requiredFieldSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    field: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["String", "Number", "Boolean", "Date", "Email", "Array"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    validation: {
      type: String,
      trim: true,
      default: "nullable",
    },
  },
  {
    timestamps: true,
  }
);

const RequiredField = mongoose.model("RequiredField", requiredFieldSchema);

export default RequiredField;

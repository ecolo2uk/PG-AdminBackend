import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    company: { type: String, required: true }, // Merchant name
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["admin", "merchant", "psp"],
      default: "merchant"
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    contact: { type: String },
    mid: { type: String, unique: true, sparse: true },
    pspId: { type: String, unique: true, sparse: true },
    // Merchant specific fields
    businessName: { type: String },
    businessType: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    bankDetails: {
      accountNumber: String,
      accountHolderName: String,
      bankName: String,
      ifscCode: String,
      branch: String
    },
    documents: [
      {
        documentName: { type: String },
        documentType: { type: String },
        fileUrl: { type: String },
      },
    ],
    balance: {
      type: Number,
      default: 0,
    },
    unsettleBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
export default User;
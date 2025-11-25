// models/User.js - VERIFY THIS SCHEMA
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firstname: { 
      type: String, 
      required: [true, 'First name is required'],
      trim: true
    },
    lastname: { 
      type: String, 
      required: [true, 'Last name is required'],
      trim: true
    },
    company: { 
      type: String, 
      default: "",
      trim: true
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { 
      type: String, 
      required: [true, 'Password is required'] 
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ["admin", "merchant", "psp"]
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    contact: { 
      type: String, 
     
      trim: true
    },
    mid: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    pspId: { 
      type: String, 
      unique: true, 
      sparse: true 
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
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
      accountHolderName: { type: String },
      accountType: { type: String, enum: ['Saving', 'Current'] },
    },
    merchantRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant'
    }
  }, 
  { 
    timestamps: true 
  }
);

// TEMPORARILY REMOVE THE POST-SAVE HOOK
/*
UserSchema.post('save', async function(doc) {
  // Remove this to avoid duplicate merchant creation
});
*/

const User = mongoose.model("User", UserSchema);
export default User;
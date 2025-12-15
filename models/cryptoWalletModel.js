import mongoose from "mongoose";

const cryptoWalletSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    iconClass: {
      type: String,
      trim: true,
      default: null,
    },
    iconImage: {
      type: String,
      trim: true,
      default: null,
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

const CryptoWallet = mongoose.model("CryptoWallet", cryptoWalletSchema);
export default CryptoWallet;

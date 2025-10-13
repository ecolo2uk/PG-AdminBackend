import mongoose from 'mongoose';

const MerchantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  contact: { type: String },
  active: { type: Boolean, default: true },
  documents: [
    {
      documentName: String,
      documentType: String,
      fileUrl: String,
    }
  ],
  createdBy: { type: String, default: "Admin" },
  createdOn: { type: Date, default: Date.now }
});

const Merchant = mongoose.model("Merchant", MerchantSchema); // Stored in a variable
export default Merchant;
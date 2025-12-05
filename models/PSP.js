import mongoose from 'mongoose';

const PSPSchema = new mongoose.Schema({
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

const PSP = mongoose.model("PSP", PSPSchema); 
export default PSP; 
// backend/models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    company: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["admin", "merchant", "psp"]
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    contact: { type: String },
    mid: { type: String, unique: true, sparse: true }, // Merchant ID
    pspId: { type: String, unique: true, sparse: true }, // Payment Service Provider ID
    documents: [
      {
        documentName: { type: String },
        documentType: { type: String },
        fileUrl: { type: String },
      },
    ],
    // ADDED: balance field for merchants (already present, good!)
    balance: { // Available balance for payouts
        type: Number,
        default: 0,
    },
    unsettleBalance: { // Balance that hasn't been settled yet
        type: Number,
        default: 0,
    },
    // Payout specific details for a merchant if they are a recipient
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
}, { timestamps: true });

UserSchema.post('save', async function(doc) {
  if (doc.role === 'merchant') {
    try {
      // Check if merchant already exists
      const existingMerchant = await Merchant.findOne({ userId: doc._id });
      
      if (!existingMerchant) {
        const merchant = new Merchant({
          userId: doc._id,
          merchantName: doc.company || `${doc.firstname} ${doc.lastname}`,
          company: doc.company || '',
          email: doc.email,
          contact: doc.contact,
          mid: doc.mid,
          availableBalance: doc.balance || 0,
          unsettledBalance: doc.unsettleBalance || 0,
          totalCredits: 0,
          totalDebits: 0,
          netEarnings: 0,
          status: 'Active'
        });

        await merchant.save();
        console.log(`✅ Auto-created merchant for user: ${doc.email}`);
        
        // Update user with merchant reference
        doc.merchantRef = merchant._id;
        await doc.save();
      }
    } catch (error) {
      console.error('❌ Error auto-creating merchant:', error);
    }
  }
});


const User = mongoose.model("User", UserSchema);
export default User;
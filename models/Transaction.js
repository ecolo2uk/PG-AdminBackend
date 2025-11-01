// import mongoose from 'mongoose';

// const transactionSchema = new mongoose.Schema({
//   transactionId: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   merchantOrderId: {
//     type: String,
//     required: true
//   },
//   merchantHashId: {
//     type: String,
//     required: true
//   },
//   merchantId: {
//     type: String, // Changed to String to match your static merchant IDs
//     required: true
//   },
//   merchantName: {
//     type: String,
//     required: true
//   },
//   amount: {
//     type: Number,
//     required: true
//   },
//   currency: {
//     type: String,
//     default: 'INR'
//   },
//   status: {
//     type: String,
//      enum: ["Pending", "Success", "Failed", "Cancelled", "Refund"],
//     default: 'Pending'
//   },
//   upiId: {
//     type: String,
//     default: ''
//   },
//   qrCode: {
//     type: String,
//     default: ''
//   },
//   paymentUrl: {
//     type: String,
//     default: ''
//   },
//   txnNote: {
//     type: String,
//     default: ''
//   },
//   txnRefId: {
//     type: String,
//     default: ''
//   },
//   merchantVpa: {
//     type: String,
//     default: ''
//   },
//   paymentMethod: {
//     type: String,
//     default: 'UPI'
//   },
//   paymentOption: {
//     type: String,
//     default: ''
//   },
//   enpayTxnId: {
//     type: String,
//     default: ''
//   },
//   source: {
//     type: String,
//     default: 'enpay'
//   },
//   isMock: {
//     type: Boolean,
//     default: false
//   }
// }, { 
//   timestamps: true 
// });

// const Transaction = mongoose.model('Transaction', transactionSchema);
// export default Transaction;



// models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // New unified fields
  transactionId: {
    type: String,
    // Note: If you have duplicate IDs from different sources,
    // 'unique' constraint might cause issues during migration.
    // Consider if you really need it, or handle duplicates during unification.
    // For now, removing 'unique' to allow for initial data flexibility if needed.
  },
  merchantOrderId: {
    type: String,
  },
  merchantHashId: {
    type: String,
  },
  merchantId: { // This needs to be consistent: either String or ObjectId
    type: mongoose.Schema.Types.ObjectId, // Assuming merchants are stored with ObjectId
    ref: 'User', // Reference to the User model (assuming User is your merchant model)
  },
  merchantName: { // This field will store the merchant's company/name for easy access
    type: String,
  },
  amount: {
    type: Number,
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ["Pending", "Success", "Failed", "Cancelled", "Refund", "SUCCESS", "FAILED", "PENDING", "REFUND", "INITIATED"], // Include all possible statuses from both schemas
    default: 'Pending'
  },
  // Fields from the first image example (if not already covered)
  commissionAmount: { type: Number },
  customerName: { type: String },
  customerVPA: { type: String },
  customerContact: { type: String }, // Assuming this is directly a string

  // Fields from the second image example (if not already covered)
  upiId: { type: String },
  qrCode: { type: String },
  paymentUrl: { type: String },
  txnNote: { type: String },
  txnRefId: { type: String },
  merchantVpa: { type: String },
  // createdAt and updatedAt are handled by timestamps: true

  // Old schema fields (to be un-set after migration, but can exist initially)
  "Transaction Reference ID": { type: String },
  "Vendor Ref ID": { type: String },
  "Vendor Txn ID": { type: String },
  "Transaction Status": { type: String },
  "Settlement Status": { type: String },
  "Transaction Date": { type: String }, // Store as string to parse
  "Amount": { type: Number },
  "Commission Amount": { type: Number },
  "Customer Name": { type: String },
  "Customer VPA": { type: String },
  "Customer Contact No": { type: String }, // Old contact field
  "Merchant Name": { type: String }, // Old merchant name field


}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
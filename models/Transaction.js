// // backend/models/Transaction.js (Already provided, just confirming changes)
// import mongoose from 'mongoose';

// const transactionSchema = new mongoose.Schema({
//   transactionId: {
//     type: String,
//     unique: true, // Added unique constraint back, important for idempotency
//     sparse: true,
//   },
//   merchantOrderId: { type: String },
//   merchantHashId: { type: String },
//   merchantId: { // MUST be ObjectId to reference User model
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true, // A transaction must belong to a merchant
//   },
//   merchantName: { type: String }, // Denormalized
//   amount: { type: Number, required: true },
//   currency: { type: String, default: 'INR' },
//   status: {
//     type: String,
//     enum: ["Pending", "Success", "Failed", "Cancelled", "Refund", "SUCCESS", "FAILED", "PENDING", "REFUND", "INITIATED"],
//     default: 'Pending'
//   },
//   commissionAmount: { type: Number, default: 0 },
//   customerName: { type: String },
//   customerVPA: { type: String },
//   customerContact: { type: String },
//   upiId: { type: String },
//   qrCode: { type: String },
//   paymentUrl: { type: String },
//   txnNote: { type: String },
//   txnRefId: { type: String }, // Our internal reference
//   merchantVpa: { type: String },
//   paymentMethod: { type: String },
//   paymentOption: { type: String },
//   enpayTxnId: { type: String }, // Could be a general `connectorTxnId`
//   source: { type: String, default: 'enpay' },
//   isMock: { type: Boolean, default: false },

//   // Fields from the first image example (if not already covered)
//   // These seem to be covered by commissionAmount, customerName, customerVPA, customerContact

//   // Fields from the second image example (if not already covered)
//   // These seem to be covered by upiId, qrCode, paymentUrl, txnNote, txnRefId, merchantVpa

//   // If you need to map old fields during migration:
//   "Vendor Ref ID": { type: String }, // Potentially map to connectorTxnId
//   "Vendor Txn ID": { type: String }, // Potentially map to connectorTxnId
//   "Transaction Status": { type: String }, // Map to status
//   "Settlement Status": { type: String }, // Needs a separate settlement model/field if distinct
//   "Transaction Date": { type: Date }, // Convert to Date type
//   "Amount": { type: Number }, // Map to amount
//   "Commission Amount": { type: Number }, // Map to commissionAmount
//   "Customer Name": { type: String }, // Map to customerName
//   "Customer VPA": { type: String }, // Map to customerVPA
//   "Customer Contact No": { type: String }, // Map to customerContact
//   "Merchant Name": { type: String }, // Map to merchantName
// }, {
//   timestamps: true // Automatically adds createdAt and updatedAt
// });

// // Index for faster lookups
// transactionSchema.index({ merchantId: 1, createdAt: -1 });
// transactionSchema.index({ transactionId: 1 });
// transactionSchema.index({ merchantOrderId: 1 });

// const Transaction = mongoose.model('Transaction', transactionSchema);
// export default Transaction;


// backend/models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // Mongoose automatically handles _id as ObjectId

  transactionId: {
    type: String,
    unique: true,
    sparse: true,
    required: true // Added based on schema
  },
  merchantOrderId: {
    type: String
  },
  merchantHashId: {
    type: String
  },
  merchantId: {
    // Schema allows objectId or string. For static mock data, String is practical.
    // If you ever integrate with a real User collection, you might switch to ObjectId.
    type: String, // Changed to String as per your current static merchants, and schema allows it
    required: true
  },
  merchantName: {
    type: String,
    required: true // Added based on schema
  },
  mid: { // NEW FIELD: Added based on your schema
    type: String,
    required: true
  },
  amount: {
    type: Number, // Mongoose Number can store double/int
    required: true
  },
  // Mapping schema field "Commission Amount" to Mongoose field
  // Mongoose allows fields with spaces, but it's generally discouraged
  // For strict schema adherence, we will use the exact name.
  "Commission Amount": { // Using the exact field name from your schema
    type: Number, // Mongoose Number can store double/int
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ["Pending", "Success", "Failed", "Cancelled", "Refund", "SUCCESS", "FAILED", "PENDING", "REFUND", "INITIATED"],
    default: 'Pending',
    required: true // Added based on schema
  },
  // Mapping schema field "Settlement Status"
  "Settlement Status": { // Using the exact field name from your schema
    type: String,
    required: true
  },
  customerName: { // Mapping schema field "Customer Name"
    type: String
  },
  customerVPA: { // Mapping schema field "Customer VPA"
    type: String
  },
  // "Customer Contact No" in schema is { "": { bsonType: "long" } }. This is very problematic.
  // I will define it as a simple String or Number, as an empty key is not practical in Mongoose.
  // Assuming it should store a contact number as a string.
  "Customer Contact No": { // Using the exact field name from your schema
    type: String // Changed to String for practical contact number storage
  },
  upiId: {
    type: String
  },
  qrCode: {
    type: String
  },
  paymentUrl: {
    type: String
  },
  txnNote: {
    type: String
  },
  txnRefId: {
    type: String
  },
  merchantVpa: {
    type: String
  },
  paymentMethod: {
    type: String
  },
  paymentOption: {
    type: String
  },
  enpayTxnId: {
    type: String
  },
  source: {
    type: String,
    default: 'enpay'
  },
  isMock: {
    type: Boolean,
    default: false
  },
  // Mapping schema field "Vendor Ref ID"
  "Vendor Ref ID": { // Using the exact field name from your schema
    type: String,
    required: true
  },
  "Vendor Txn ID": { // Using the exact field name from your schema
    type: String
  },
  "Failure Reasons": { // Using the exact field name from your schema
    type: String
  },
  enpayError: {
    type: String
  },
  enpayInitiationStatus: {
    type: String
  },
  enpayQRCode: {
    type: String
  },
  // createdAt and updatedAt from timestamps: true are Date objects.
  // Your schema requires createdAt to be a "string".
  // Mongoose will store it as a Date, and when queried, it will be a Date.
  // If a *strict* string representation is needed, you'd have to handle it on output.
  // For now, we rely on `timestamps: true` which is generally better.
}, {
  timestamps: true // Automatically adds createdAt and updatedAt as Date objects
});

// Index for faster lookups
transactionSchema.index({
  merchantId: 1,
  createdAt: -1
});
transactionSchema.index({
  transactionId: 1
});
transactionSchema.index({
  merchantOrderId: 1
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
// backend/models/Connector.js
import mongoose from 'mongoose';

const connectorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  className: { type: String, required: true },
  connectorType: { type: String, required: true, enum: ['UPI', 'Card'] },
  expireAfterMinutes: { type: Number, default: 60 },
  isPayoutSupport: { type: Boolean, default: false },
  isPayoutBulkUploadSupport: { type: Boolean, default: false },
  status: { type: String, default: 'Active', enum: ['Active', 'Deactivated'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Dynamic credentials - stored as an array of objects
  credentials: [{
    credentialTitle: { type: String, required: true },
    credentialName: { type: String, required: true },
  }],
  
  // Dynamic start/end times
  times: [{
    startTime: { type: String },
    endTime: { type: String },
  }],

  // Required Fields from checkboxes
  requiredFields: {
    firstName: { type: Boolean, default: false },
    lastName: { type: Boolean, default: false },
    country: { type: Boolean, default: false },
    state: { type: Boolean, default: false },
    ipAddress: { type: Boolean, default: false },
    phoneNumbers: { type: Boolean, default: false },
    cardNumbers: { type: Boolean, default: false },
    cardExpiryMonth: { type: Boolean, default: false },
    upi: { type: Boolean, default: false },
    userId: { type: Boolean, default: false },
    address: { type: Boolean, default: false },
    city: { type: Boolean, default: false },
    amount: { type: Boolean, default: false },
    cardExpiryYear: { type: Boolean, default: false },
    customerUserId: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    zip: { type: Boolean, default: false },
    currency: { type: Boolean, default: false },
    cardCvv: { type: Boolean, default: false },
  }
});

connectorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Connector = mongoose.model("Connector", connectorSchema);
export default Connector;
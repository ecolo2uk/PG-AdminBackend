// backend/models/ConnectorAccount.js
import mongoose from 'mongoose';

const connectorAccountSchema = new mongoose.Schema({
  connectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connector',
    required: true,
  },
  name: { type: String, required: true },
  currency: { type: String, required: true, default: 'INR' },
  status: { type: String, default: 'Active', enum: ['Active', 'Deactivated'] },
  
  // Integration Keys - stores dynamic key-value pairs based on connector credentials
  integrationKeys: {
    type: Map,
    of: String,
    default: {}
  },
  
  // Limits
  limits: {
    defaultCurrency: { type: String, default: 'INR' },
    minTransactionAmount: { type: Number, default: 100 },
    maxTransactionAmount: { type: Number, default: 10000 },
    perDaySuccessAmount: { type: Number, default: 0 },
    gatewayFeePercentage: { type: Number, default: 0 },
    
    perDayCardLimit: { type: Number, default: 0 },
    perWeekCardLimit: { type: Number, default: 0 },
    perMonthCardLimit: { type: Number, default: 0 },
    dailyCardDeclineLimit: { type: Number, default: 0 },

    perDayEmailLimit: { type: Number, default: 0 },
    perWeekEmailLimit: { type: Number, default: 0 },
    perMonthEmailLimit: { type: Number, default: 0 },
    dailyEmailDeclineLimit: { type: Number, default: 0 },

    acceptedCountries: [{ type: String }],
    blockedCountries: [{ type: String }],
    acceptedCardTypes: [{ type: String }],
    description: { type: String },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

connectorAccountSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const ConnectorAccount = mongoose.model("ConnectorAccount", connectorAccountSchema);
export default ConnectorAccount;
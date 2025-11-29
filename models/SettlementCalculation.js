// models/SettlementCalculation.js
import mongoose from 'mongoose';

const settlementCalculationSchema = new mongoose.Schema({
  connectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connector',
    required: true
  },
  connectorAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConnectorAccount',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  calculatedAmount: {
    type: Number,
    required: true
  },
  totalTransactions: {
    type: Number,
    default: 0
  },
  successTransactions: {
    type: Number,
    default: 0
  },
  failedTransactions: {
    type: Number,
    default: 0
  },
  gatewayCharges: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  calculationData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default mongoose.model('SettlementCalculation', settlementCalculationSchema);
// models/AutoSettlement.js
import mongoose from 'mongoose';

const autoSettlementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
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
  connectorName: {
    type: String,
    required: true
  },
  startTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  endTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  day: {
    type: Number,
    default: 0
  },
  cronRunTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PAUSED'],
    default: 'ACTIVE'
  },
  settlementType: {
    type: String,
    enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
    default: 'DAILY'
  },
  minimumAmount: {
    type: Number,
    default: 100
  },
  lastRun: Date,
  nextRun: Date,
  lastRunStatus: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'PARTIAL'],
    default: 'SUCCESS'
  },
  lastRunMessage: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
autoSettlementSchema.index({ connectorId: 1, isActive: 1 });
autoSettlementSchema.index({ nextRun: 1 });

export default mongoose.model('AutoSettlement', autoSettlementSchema);
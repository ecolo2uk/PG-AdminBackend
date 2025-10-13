// backend/models/Solution.js
import mongoose from 'mongoose';

const SolutionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Solution names should ideally be unique
  },
  iconClass: {
    type: String,
    required: false, // Optional
  },
  iconImage: {
    type: String,
    required: false, // Optional, can be a URL or reference to an uploaded image
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the 'updatedAt' field automatically on save
SolutionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Solution = mongoose.model('Solution', SolutionSchema);
export default Solution;
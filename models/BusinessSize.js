// models/BusinessSize.js
import mongoose from 'mongoose';

const businessSizeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  iconClass: {
    type: String,
    default: '',
  },
  iconImage: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const BusinessSize = mongoose.model('BusinessSize', businessSizeSchema);

export default BusinessSize;
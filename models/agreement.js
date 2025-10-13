import mongoose from 'mongoose';

const agreementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const Agreement = mongoose.model('Agreement', agreementSchema);
export default Agreement;
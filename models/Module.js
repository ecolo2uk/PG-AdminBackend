import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema({
  moduleId: {
    type: String,
    required: true,
    unique: true,
    
  },
  title: {
    type: String,
    required: true,
    unique: true,
  },
  url: {
    type: String,
    default: null
  }
}, { timestamps: true });

const Module = mongoose.model('Module', moduleSchema);
export default Module;
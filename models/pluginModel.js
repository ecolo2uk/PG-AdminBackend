import mongoose from 'mongoose';

const pluginSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, 
  },
  iconClass: {
    type: String,
    default: null, 
  },
  iconImage: {
    type: String,
    default: null, 
  },

}, {
  timestamps: true, 
});

const Plugin = mongoose.model('Plugin', pluginSchema);

export default Plugin;
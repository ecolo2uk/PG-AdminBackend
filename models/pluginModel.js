import mongoose from 'mongoose';

const pluginSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Plugins should probably have unique names
  },
  iconClass: {
    type: String,
    default: null, // Optional icon class (e.g., for FontAwesome)
  },
  iconImage: {
    type: String,
    default: null, // Optional URL for an icon image
  },
  // You might want to add other fields like 'description', 'version', 'isActive', etc.
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

const Plugin = mongoose.model('Plugin', pluginSchema);

export default Plugin;
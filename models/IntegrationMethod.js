import mongoose from 'mongoose';

const IntegrationMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    iconClass: {
        type: String,
        trim: true,
        default: ''
    },
    iconImage: {
        type: String, // Assuming URL or path to image
        trim: true,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update `updatedAt` field on save
IntegrationMethodSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const IntegrationMethod = mongoose.model('IntegrationMethod', IntegrationMethodSchema);
export default IntegrationMethod;
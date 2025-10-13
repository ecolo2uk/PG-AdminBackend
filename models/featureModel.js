// models/featureModel.js
import mongoose from 'mongoose';

const featureSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        iconClass: {
            type: String,
            default: '', // Optional field
        },
        iconImage: {
            type: String,
            default: '', // Optional field for image URL or path
        },
    },
    {
        timestamps: true,
    }
);

const Feature = mongoose.model('Feature', featureSchema);

export default Feature;
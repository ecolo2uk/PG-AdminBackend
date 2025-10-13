import mongoose from 'mongoose';

const requiredFieldSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true,
    },
    field: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['String', 'Number', 'Boolean', 'Date', 'Email', 'Array'], // Example types
    },
    validation: {
        type: String,
        trim: true,
        default: 'nullable', // e.g., 'required', 'nullable|min:5|max:100', 'required|email'
    },
}, {
    timestamps: true,
});

const RequiredField = mongoose.model('RequiredField', requiredFieldSchema);

export default RequiredField;
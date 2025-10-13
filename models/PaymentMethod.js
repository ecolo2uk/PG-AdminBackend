import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    iconClass: {
        type: String,
        required: false // Optional
    },
    iconImage: {
        type: String,
        required: false // Optional, could be a URL to an image
    }
}, { timestamps: true });

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);
export default PaymentMethod;
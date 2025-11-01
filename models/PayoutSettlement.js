import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const PayoutSettlementSchema = new mongoose.Schema({
    settlementAmount: { // Total amount for this specific settlement batch
        type: Number,
        required: true,
    },
    settledBy: { // Who initiated the settlement (e.g., admin user ID)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    settlementDate: {
        type: Date,
        default: Date.now,
    },
    merchantsSettled: [ // An array to track which merchants were part of this settlement batch
        {
            merchantId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            merchantName: { // Storing name here for denormalization and easier display
                type: String,
                required: true,
            },
            merchantEmail: {
                type: String,
                required: true,
            },
            settledBalance: { // Amount specifically settled for THIS merchant in THIS batch
                type: Number,
                required: true,
                default: 0
            }
        }
    ],
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    }
}, { timestamps: true });

PayoutSettlementSchema.plugin(mongoosePaginate);

const PayoutSettlement = mongoose.model('PayoutSettlement', PayoutSettlementSchema);
export default PayoutSettlement;
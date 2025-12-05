import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const PayoutSettlementSchema = new mongoose.Schema({
    settlementAmount: { 
        type: Number,
        required: true,
    },
    settledBy: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    settlementDate: {
        type: Date,
        default: Date.now,
    },
    merchantsSettled: [ 
        {
            merchantId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            merchantName: { 
                type: String,
                required: true,
            },
            merchantEmail: {
                type: String,
                required: true,
            },
            settledBalance: { 
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
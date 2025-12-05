import express from 'express';
import {
    getAllPaymentOptions,
    getPaymentOptionById,
    createPaymentOption,
    updatePaymentOption,
    deletePaymentOption
} from '../controllers/paymentOptionController.js';

const router = express.Router();

router.get('/', getAllPaymentOptions);
router.get('/:id', getPaymentOptionById);
router.post('/', createPaymentOption);
router.put('/:id', updatePaymentOption);
router.delete('/:id', deletePaymentOption);

export default router;
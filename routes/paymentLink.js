// backend/routes/paymentRoutes.js
import express from 'express';
import { generatePaymentLink, handleSuccess, handleReturn, getMerchants, getPaymentMethods } from '../controllers/paymentLinkController.js';

const router = express.Router();

router.get('/merchants', getMerchants);
router.get('/methods', getPaymentMethods); // Make sure this is present
router.post('/generate-link', generatePaymentLink);
router.get('/success', handleSuccess);
router.get('/return', handleReturn);

export default router;
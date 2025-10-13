import express from 'express';
import { generatePaymentLink, handleSuccess, handleReturn, getMerchants } from '../controllers/paymentLinkController.js';

const router = express.Router();

router.get('/merchants', getMerchants); // नवीन route
router.post('/generate-link', generatePaymentLink);
router.get('/success', handleSuccess);
router.get('/return', handleReturn);

export default router;
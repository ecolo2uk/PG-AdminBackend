// backend/routes/paymentRoutes.js (Consolidated file)
import express from 'express';
import { generatePaymentLink, handleSuccess, handleReturn, getMerchants, getPaymentMethods } from '../controllers/paymentLinkController.js';
import { decrypt } from '../utils/encryption.js';
import Transaction from '../models/Transaction.js'; // Needed for the short link route
import { encrypt } from '../utils/encryption.js'; // Ensure encrypt is also available if needed for short link generation logic

const router = express.Router();

// Public API endpoints for the frontend to call
router.get('/merchants', getMerchants);
router.get('/methods', getPaymentMethods);
router.post('/generate-link', generatePaymentLink);

// Enpay callbacks (these are called by Enpay, not directly by your frontend)
router.get('/success', handleSuccess);
router.get('/return', handleReturn);

// Decryption endpoint for frontend (used by PaymentProcessPage to get enpayLink)
router.post('/decrypt-payload', (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, message: 'Payload is required' });
    }
    const decryptedData = decrypt(payload);
    res.json({ success: true, decryptedData });
  } catch (error) {
    console.error('Error decrypting payload:', error);
    res.status(500).json({ success: false, message: 'Failed to decrypt payload', error: error.message });
  }
});

// backend/routes/paymentRoutes.js
router.get('/process/:shortLinkId', async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    console.log('Processing short link:', shortLinkId);

    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });
    
    if (!transaction) {
      console.error('Transaction not found for shortLinkId:', shortLinkId);
      return res.status(404).send('Payment link not found');
    }

    if (!transaction.paymentUrl) {
      console.error('Payment URL missing for transaction:', transaction.transactionId);
      return res.status(404).send('Payment URL not available');
    }

    console.log('Redirecting to Enpay:', transaction.paymentUrl);
    
    // Direct redirect to Enpay
    res.redirect(302, transaction.paymentUrl);

  } catch (error) {
    console.error('Error in process route:', error);
    res.status(500).send('Error processing payment');
  }
});
export default router;
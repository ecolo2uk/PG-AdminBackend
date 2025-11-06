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

// In backend/routes/paymentRoutes.js
// This route now directly follows the /api/payment prefix set in app.js
router.get('/process/:shortLinkId', async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    console.log('⚡ Short link handler called for shortLinkId:', shortLinkId);

    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });

    if (!transaction || !transaction.encryptedPaymentPayload) {
      console.error('❌ Short link ID not found or payload missing for:', shortLinkId);
      // It's good practice to render a user-friendly page here, not just send text
      return res.status(404).send('Payment link not found or expired.');
    }

    const decryptedData = decrypt(transaction.encryptedPaymentPayload);
    const { enpayLink, transactionId } = JSON.parse(decryptedData);

    console.log(`➡️ Redirecting user for transaction ${transactionId} to: ${enpayLink}`);

    res.redirect(enpayLink);

  } catch (error) {
    console.error('🔥 Error processing short payment link:', error);
    res.status(500).send('An error occurred while processing your payment link.');
  }
});


export default router;
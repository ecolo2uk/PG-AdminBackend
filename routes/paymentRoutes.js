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
    console.log(`[Backend Debug] 1. Short link handler entered for shortLinkId: ${shortLinkId}`);

    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });

    if (!transaction) {
      console.error(`[Backend Debug] ❌ 2. Transaction not found for shortLinkId: ${shortLinkId}`);
      return res.status(404).send('Payment link not found or expired.');
    }
    console.log(`[Backend Debug] ✅ 2. Transaction found. Transaction ID: ${transaction.transactionId}`);

    if (!transaction.encryptedPaymentPayload) {
      console.error(`[Backend Debug] ❌ 3. encryptedPaymentPayload missing for transaction ID: ${transaction.transactionId}`);
      return res.status(404).send('Payment link payload missing.');
    }
    console.log(`[Backend Debug] ✅ 3. encryptedPaymentPayload found.`);

    const decryptedData = decrypt(transaction.encryptedPaymentPayload);
    console.log(`[Backend Debug] ✅ 4. Decrypted Payload (raw): ${decryptedData}`);

    let enpayLink;
    try {
        const parsedPayload = JSON.parse(decryptedData);
        enpayLink = parsedPayload.enpayLink;
        console.log(`[Backend Debug] ✅ 5. Parsed payload. Extracted enpayLink: ${enpayLink}`);
        if (!enpayLink) {
            console.error(`[Backend Debug] ❌ 5a. enpayLink is null or undefined after parsing.`);
            return res.status(500).send('Enpay payment URL not found in payload.');
        }
    } catch (parseError) {
        console.error(`[Backend Debug] ❌ 5b. Error parsing decryptedData as JSON: ${parseError.message}`);
        console.error(`[Backend Debug]    Decrypted data content: ${decryptedData}`);
        return res.status(500).send('Invalid payment payload format.');
    }

    // THIS IS THE CRUCIAL REDIRECTION
    console.log(`[Backend Debug] ➡️ 6. Attempting to redirect to Enpay: ${enpayLink}`);
    res.redirect(enpayLink);
    console.log(`[Backend Debug] ✅ 7. Redirect command issued.`); // Note: This might not always log if redirect happens immediately.

  } catch (error) {
    console.error(`[Backend Debug] 🔥 8. Error in /process/:shortLinkId: ${error.message}`);
    console.error(error.stack); // Log the full stack trace for better debugging
    res.status(500).send('An error occurred while processing your payment link.');
  }
});

export default router;
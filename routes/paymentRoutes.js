// In your routes/paymentRoutes.js or similar
import express from 'express';
import { decrypt } from '../utils/encryption.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

// ... existing routes ...

router.get('/payments/process/:shortLinkId', async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    console.log('⚡ Short link handler called for shortLinkId:', shortLinkId);

    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });

    if (!transaction || !transaction.encryptedPaymentPayload) {
      console.error('❌ Short link ID not found or payload missing for:', shortLinkId);
      return res.status(404).send('Payment link not found or expired.');
    }

    const decryptedData = decrypt(transaction.encryptedPaymentPayload);
    const { enpayLink, transactionId } = JSON.parse(decryptedData);

    console.log(`➡️ Redirecting user for transaction ${transactionId} to: ${enpayLink}`);
    // You might want to do additional checks here before redirecting
    // e.g., check if the transaction is still pending.

    res.redirect(enpayLink);

  } catch (error) {
    console.error('🔥 Error processing short payment link:', error);
    res.status(500).send('An error occurred while processing your payment link.');
  }
});

export default router;
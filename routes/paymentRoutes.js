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
    console.log('🔄 Process route called for shortLinkId:', shortLinkId);

    // Check database connection
    console.log('📊 Database state:', {
      connectionState: mongoose.connection.readyState,
      dbName: mongoose.connection.name
    });

    // Find transaction
    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });
    console.log('🔍 Transaction search result:', transaction);

    if (!transaction) {
      console.error('❌ Transaction not found for shortLinkId:', shortLinkId);
      
      // Check all transactions for debugging
      const allTransactions = await Transaction.find({}).limit(5);
      console.log('📋 Recent transactions:', allTransactions.map(t => ({
        shortLinkId: t.shortLinkId,
        transactionId: t.transactionId,
        merchantName: t.merchantName
      })));
      
      return res.status(404).send(`
        <html>
          <body>
            <h2>Payment Link Not Found</h2>
            <p>Short Link ID: ${shortLinkId}</p>
            <p>This payment link may have expired or is invalid.</p>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `);
    }

    if (!transaction.encryptedPaymentPayload) {
      console.error('❌ Encrypted payload missing for transaction:', transaction.transactionId);
      return res.status(404).send('Payment link payload missing.');
    }

    console.log('✅ Transaction found:', transaction.transactionId);
    console.log('🔐 Encrypted payload exists');

    // Decrypt payload
    let decryptedData;
    try {
      decryptedData = decrypt(transaction.encryptedPaymentPayload);
      console.log('✅ Decrypted payload:', decryptedData);
    } catch (decryptError) {
      console.error('❌ Decryption error:', decryptError);
      return res.status(500).send('Error processing payment link.');
    }

    let enpayLink;
    try {
      const parsedPayload = JSON.parse(decryptedData);
      enpayLink = parsedPayload.enpayLink;
      console.log('🔗 Enpay Link extracted:', enpayLink);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return res.status(500).send('Invalid payment payload.');
    }

    if (!enpayLink) {
      console.error('❌ Enpay link is empty');
      return res.status(500).send('Payment URL not available.');
    }

    console.log('➡️ Redirecting to Enpay:', enpayLink);
    
    // Update transaction status
    await Transaction.findOneAndUpdate(
      { shortLinkId: shortLinkId },
      { status: 'REDIRECTED' }
    );

    res.redirect(302, enpayLink);

  } catch (error) {
    console.error('🔥 ERROR in process route:', error);
    res.status(500).send(`
      <html>
        <body>
          <h2>Payment Processing Error</h2>
          <p>An error occurred while processing your payment.</p>
          <a href="/">Return to Home</a>
        </body>
      </html>
    `);
  }
});

export default router;
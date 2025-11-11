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

    // Find transaction with detailed logging
    console.log('🔍 Searching for transaction with shortLinkId:', shortLinkId);
    
    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });
    
    if (!transaction) {
      console.error('❌ Transaction not found in database');
      
      // List all transactions for debugging
      const allTransactions = await Transaction.find({}).sort({ createdAt: -1 }).limit(5);
      console.log('📋 Recent transactions:', allTransactions.map(t => ({
        id: t._id,
        shortLinkId: t.shortLinkId,
        transactionId: t.transactionId,
        merchantName: t.merchantName,
        createdAt: t.createdAt
      })));
      
      return res.status(404).send(`
        <html>
          <head><title>Payment Link Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #dc3545;">Payment Link Not Found</h2>
            <p>Short Link ID: <strong>${shortLinkId}</strong></p>
            <p>This payment link may have expired or is invalid.</p>
            <p><a href="/" style="color: #007bff;">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    console.log('✅ Transaction found:', {
      id: transaction._id,
      transactionId: transaction.transactionId,
      shortLinkId: transaction.shortLinkId,
      merchantName: transaction.merchantName,
      amount: transaction.amount,
      paymentUrl: transaction.paymentUrl,
      hasEncryptedPayload: !!transaction.encryptedPaymentPayload
    });

    if (!transaction.encryptedPaymentPayload) {
      console.error('❌ Encrypted payload missing');
      
      // If no encrypted payload but has direct payment URL, use that
      if (transaction.paymentUrl) {
        console.log('🔄 Using direct payment URL:', transaction.paymentUrl);
        return res.redirect(302, transaction.paymentUrl);
      }
      
      return res.status(404).send('Payment link payload missing.');
    }

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
      { status: 'REDIRECTED', redirectedAt: new Date() }
    );

    // Final redirect to Enpay
    res.redirect(302, enpayLink);

  } catch (error) {
    console.error('🔥 ERROR in process route:', error);
    res.status(500).send(`
      <html>
        <head><title>Payment Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #dc3545;">Payment Processing Error</h2>
          <p>An error occurred while processing your payment.</p>
          <p><a href="/" style="color: #007bff;">Return to Home</a></p>
        </body>
      </html>
    `);
  }
});

export default router;
import express from 'express';
import { generatePaymentLink, handleSuccess, handleReturn, getMerchants, getPaymentMethods } from '../controllers/paymentLinkController.js';
import { decrypt } from '../utils/encryption.js'; // Import the decrypt function

const router = express.Router();

router.get('/merchants', getMerchants);
router.get('/methods', getPaymentMethods);
router.post('/generate-link', generatePaymentLink);
router.get('/success', handleSuccess); // For Enpay callback
router.get('/return', handleReturn);   // For Enpay callback

// NEW: Decryption endpoint for frontend
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

export default router;
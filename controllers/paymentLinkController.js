import Transaction from '../models/Transaction.js';
import axios from 'axios';
import { encrypt } from '../utils/encryption.js'; // Import encrypt
import crypto from 'crypto'; // Needed for a robust ENCRYPTION_KEY check

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000'; // Ensure this is correct

// Ensure ENCRYPTION_KEY is always defined and consistent
const ENCRYPTION_KEY_RAW = process.env.PAYMENT_LINK_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY_RAW || ENCRYPTION_KEY_RAW.length !== 64) { // 32 bytes = 64 hex characters
    console.warn("⚠️ WARNING: PAYMENT_LINK_ENCRYPTION_KEY is missing or invalid in .env. Using a randomly generated key for this session. THIS IS UNSAFE FOR PRODUCTION!");
    process.env.PAYMENT_LINK_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}


export const generatePaymentLink = async (req, res) => {
  try {
    console.log('🔵 generatePaymentLink called with body:', req.body);

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // Validation
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      return res.status(400).json({
        success: false,
        message: 'Merchant ID, Amount, Payment Method, and Payment Option are required'
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    if (amountNum < 500) {
      return res.status(400).json({
        success: false,
        message: 'Minimum amount should be at least 500 INR for Enpay'
      });
    }

    if (amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum amount cannot exceed 10,000 INR for Enpay'
      });
    }

    // Static merchant data (from your payments.jsx)
    const staticMerchants = [
      { _id: "MERCHANT001", firstname: "John", lastname: "Doe", mid: "MID123456", hashId: "MERCDSH51Y7CD4YJLFIZR8NF", vpa: "enpay1.skypal@fino" },
      { _id: "MERCHANT002", firstname: "Jane", lastname: "Smith", mid: "MID789012", hashId: "MERCDSH52Y8CD5YJLFIZR9NG", vpa: "enpay3.skypal@fino" }
    ];

    const merchant = staticMerchants.find(m => m._id === merchantId);
    if (!merchant) {
      console.error('Merchant not found for ID:', merchantId);
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`; // Our internal system transaction ID
    const txnRefId = `TXN${timestamp}${randomSuffix}`; // A reference for Enpay or external systems
    const formattedAmount = amountNum.toFixed(2);

    // Create initial transaction record with ALL required fields from your schema
    const transaction = new Transaction({
      transactionId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      merchantHashId: merchant.hashId,
      merchantId: merchant._id,
      merchantName: `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      amount: amountNum,
      currency: currency,
      status: 'Pending',
      "Commission Amount": 0, // Placeholder as per schema
      "Settlement Status": 'Pending', // Placeholder as per schema
      "Vendor Ref ID": `VENDOR_REF_${merchantTrnId}`, // Placeholder as per schema
      upiId: merchant.vpa, // Default to merchant VPA for UPI
      merchantVpa: merchant.vpa,
      txnRefId: txnRefId,
      txnNote: `Payment for Order ${merchantOrderId}`,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      source: 'enpay',
      isMock: false, // Assume real initially
    });

    try {
      await transaction.save();
      console.log('✅ Transaction saved as PENDING:', transaction.transactionId);
    } catch (saveError) {
      console.error('❌ Error saving transaction:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save transaction to database',
        error: saveError.message,
        validationErrors: saveError.errors // Mongoose validation errors will be here
      });
    }

    // Enpay API request data
    const requestData = {
      "amount": formattedAmount,
      "merchantHashId": merchant.hashId,
      "merchantOrderId": merchantOrderId,
      "merchantTrnId": merchantTrnId,
      "merchantVpa": merchant.vpa,
      // Enpay's callback URLs should point back to your backend
      "returnURL": `${process.env.API_BASE_URL}/payment/return?transactionId=${merchantTrnId}`, // Point to backend
      "successURL": `${process.env.API_BASE_URL}/payment/success?transactionId=${merchantTrnId}`, // Point to backend
      "txnNote": `Payment for Order ${merchantOrderId}`
    };

    console.log('📤 Sending to Enpay API:', JSON.stringify(requestData, null, 2));

    const options = {
      method: 'POST',
      url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Key': process.env.ENPAY_MERCHANT_KEY || 'YOUR_DEFAULT_ENPAY_KEY', // Use a default or ensure env is set
        'X-Merchant-Secret': process.env.ENPAY_MERCHANT_SECRET || 'YOUR_DEFAULT_ENPAY_SECRET' // Use a default or ensure env is set
      },
      data: requestData,
      timeout: 30000
    };

    // Mask sensitive keys for logs
    console.log('🔑 Using Merchant Key:', process.env.ENPAY_MERCHANT_KEY ? '******' : 'YOUR_DEFAULT_ENPAY_KEY');

    let finalPaymentLink = '';
    let isMockPayment = false;
    let enpayTxnId = merchantTrnId; // Default to our ID if Enpay doesn't provide one

    try {
      const response = await axios(options);
      console.log('✅ Enpay API Response:', response.data);

      const enpayResponse = response.data;

      if (enpayResponse.code === 200 || enpayResponse.status?.toLowerCase() === 'success') {
        // Robustly extract the payment link
        if (enpayResponse.details && enpayResponse.details.includes('https://enpay.in')) {
            finalPaymentLink = enpayResponse.details;
        } else if (enpayResponse.data && enpayResponse.data.paymentLink) {
            finalPaymentLink = enpayResponse.data.paymentLink;
        } else if (enpayResponse.paymentLink) {
            finalPaymentLink = enpayResponse.paymentLink;
        } else if (enpayResponse.data && enpayResponse.data.token) {
            finalPaymentLink = `https://enpay.in/enpay/ui/pg?token=${enpayResponse.data.token}`;
        } else {
            throw new Error('No valid payment link found in Enpay response');
        }

        enpayTxnId = enpayResponse.data?.txnId || enpayResponse.txnId || merchantTrnId;
        isMockPayment = false;
        console.log('🔗 Generated Real Enpay Payment Link:', finalPaymentLink);

      } else {
        throw new new Error(enpayResponse.message || 'Enpay API returned non-success status');
      }

    } catch (apiError) {
      console.error('❌ Enpay API error (falling back to mock):', apiError.response?.data || apiError.message);
      isMockPayment = true;
      finalPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?transactionId=${merchantTrnId}&amount=${amountNum}`;
      console.log('🔄 Using mock payment as fallback:', finalPaymentLink);
    }

    // Update the transaction in DB with the actual link/mock link and status
    await Transaction.findOneAndUpdate(
      { transactionId: merchantTrnId },
      {
        enpayTxnId: enpayTxnId,
        paymentUrl: finalPaymentLink,
        qrCode: finalPaymentLink, // Often QR code is generated from the payment URL
        isMock: isMockPayment,
        status: 'INITIATED' // Change status to initiated after getting a link
      },
      { new: true, runValidators: true } // Return updated doc, run schema validators
    );

    // --- CUSTOM LINK GENERATION (for frontend processing) ---
    // Data to encrypt: We need the actual payment link (Enpay or mock) and our internal transaction ID.
    const dataToEncrypt = JSON.stringify({
        enpayLink: finalPaymentLink, // The actual link to redirect to
        transactionId: merchantTrnId // Your internal transaction ID
    });

    const encryptedPayload = encrypt(dataToEncrypt);
    const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process?payload=${encodeURIComponent(encryptedPayload)}`;

    console.log('🔗 Generated Custom (Encoded) Payment Link for frontend:', customPaymentLink);

    return res.json({
      success: true,
      paymentLink: customPaymentLink, // Always return your custom wrapped link to the frontend
      transactionRefId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      isMock: isMockPayment,
      message: isMockPayment ? 'Mock payment link generated (Enpay API unavailable or error)' : 'Real payment link generated successfully'
    });

  } catch (error) {
    console.error('🔥 generatePaymentLink top-level ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment link generation',
      error: error.message,
      stack: error.stack
    });
  }
};


export const handleSuccess = async (req, res) => {
  try {
    const { transactionId } = req.query; // This transactionId is YOUR internal merchantTrnId
    console.log('✅ Success callback called for transaction:', transactionId);

    if (transactionId) {
      // Find the transaction by your internal ID and update its status
      const updatedTransaction = await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: 'SUCCESS' },
        { new: true } // Return the updated document
      );

      if (updatedTransaction) {
        console.log(`Transaction ${transactionId} updated to SUCCESS.`);
      } else {
        console.warn(`Transaction ${transactionId} not found for success callback.`);
      }
    }

    // Redirect to your frontend success page
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=success&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Success callback error:', error);
    // Redirect to frontend success page with an error status
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=error&message=${encodeURIComponent(error.message)}`);
  }
};

export const handleReturn = async (req, res) => {
  try {
    const { transactionId, status } = req.query; // transactionId is YOUR internal merchantTrnId
    console.log('↩️ Return callback called for transaction:', transactionId, 'with status:', status);

    if (transactionId) {
      let newStatus = 'FAILED'; // Default to FAILED
      switch (status?.toLowerCase()) {
        case 'success': // Enpay might send success to returnURL in some cases
          newStatus = 'SUCCESS';
          break;
        case 'failed':
          newStatus = 'FAILED';
          break;
        case 'cancelled':
          newStatus = 'CANCELLED';
          break;
        default:
          newStatus = 'FAILED'; // Fallback for unknown statuses
      }

      const updatedTransaction = await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: newStatus },
        { new: true }
      );

      if (updatedTransaction) {
        console.log(`Transaction ${transactionId} updated to ${newStatus}.`);
      } else {
        console.warn(`Transaction ${transactionId} not found for return callback.`);
      }
    }

    // Redirect to your frontend return/failure page
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=${status || 'failed'}&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Return callback error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error&message=${encodeURIComponent(error.message)}`);
  }
};

export const getMerchants = async (req, res) => {
  try {
    const staticMerchants = [
      {
        _id: "MERCHANT001",
        firstname: "John",
        lastname: "Doe",
        mid: "MID123456"
      },
      {
        _id: "MERCHANT002",
        firstname: "Jane",
        lastname: "Smith",
        mid: "MID789012"
      }
    ];

    res.json({
      success: true,
      merchants: staticMerchants
    });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching merchants',
      error: error.message
    });
  }
};

export const getPaymentMethods = async (req, res) => {
  try {
    const mockPaymentMethods = [
      { id: "upi", name: "UPI" },
      { id: "card", name: "Credit/Debit Card" },
      { id: "netbanking", name: "Net Banking" }
    ];

    res.json({
      success: true,
      methods: mockPaymentMethods
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: error.message
    });
  }
};
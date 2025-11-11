import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose'; // ✅ ADD THIS IMPORT

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';


// Environment variables

const ENPAY_MERCHANT_KEY = process.env.ENPAY_MERCHANT_KEY;
const ENPAY_MERCHANT_SECRET = process.env.ENPAY_MERCHANT_SECRET;

// backend/controllers/paymentLinkController.js
export const generatePaymentLink = async (req, res) => {
  try {
    console.log('🚀 Starting payment link generation...');
    console.log('📦 Request body:', req.body);

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // 1. Validation
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 500 || amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 500 and 10,000 INR'
      });
    }

    // 2. Merchant data
    const staticMerchants = [
      {
        _id: "68fb0322970e105debcc26e7",
        firstname: "John",
        lastname: "Doe",
        mid: "MID123456",
        hashId: "MERCDSH51Y7CD4YJLFIZR8NF",
        vpa: "enpay1.skypal@fino",
        merchantName: "SKYPAL SYSTEM PRIVATE LIMITED" // ✅ ADD THIS
      }
    ];

    const merchant = staticMerchants.find(m => m._id === merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // 3. Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;

    console.log('🆔 Generated IDs:', { merchantOrderId, merchantTrnId });

    // 4. Prepare Enpay API request with PROPER DATA
    const enpayRequestData = {
      "amount": amountNum.toFixed(2),
      "merchantHashId": merchant.hashId,
      "merchantOrderId": merchantOrderId,
      "merchantTrnId": merchantTrnId,
      "merchantVpa": merchant.vpa,
      "returnURL": `${API_BASE_URL}/api/payment/return?transactionId=${merchantTrnId}`,
      "successURL": `${API_BASE_URL}/api/payment/success?transactionId=${merchantTrnId}`,
      "txnNote": `Payment for ${merchant.merchantName}`,
      "merchantName": merchant.merchantName, // ✅ ADD MERCHANT NAME
      "currency": currency // ✅ ADD CURRENCY
    };

    console.log('📤 Enpay Request Data:', JSON.stringify(enpayRequestData, null, 2));

    // 5. Enpay API call
    let enpayResponse;
    try {
      enpayResponse = await axios({
        method: 'POST',
        url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': ENPAY_MERCHANT_KEY,
          'X-Merchant-Secret': ENPAY_MERCHANT_SECRET
        },
        data: enpayRequestData,
        timeout: 30000
      });

      console.log('✅ Enpay API Response:', JSON.stringify(enpayResponse.data, null, 2));

    } catch (apiError) {
      console.error('❌ Enpay API Error:', apiError.response?.data || apiError.message);
      throw new Error(`Enpay API failed: ${apiError.response?.data?.message || apiError.message}`);
    }

    // 6. Validate Enpay response
    if (!enpayResponse.data || !enpayResponse.data.details) {
      console.error('❌ Invalid Enpay response structure');
      throw new Error('Invalid response from payment gateway');
    }

    const finalPaymentLink = enpayResponse.data.details;
    console.log('🔗 Enpay Payment Link:', finalPaymentLink);

    // 7. Save transaction
    const transactionData = {
      transactionId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      merchantHashId: merchant.hashId,
      merchantId: merchant._id,
      merchantName: merchant.merchantName,
      mid: merchant.mid,
      amount: amountNum,
      currency: currency,
      status: 'INITIATED',
      merchantVpa: merchant.vpa,
      txnRefId: merchantTrnId,
      txnNote: `Payment for ${merchant.merchantName}`,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: finalPaymentLink,
      enpayTxnId: enpayResponse.data.data?.transactionId || merchantTrnId
    };

    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();

    // 8. Generate short link
    const shortLinkId = newTransaction._id.toString();
    const encryptedPayload = encrypt(JSON.stringify({
      enpayLink: finalPaymentLink,
      transactionId: merchantTrnId,
      merchantName: merchant.merchantName,
      amount: amountNum.toFixed(2),
      orderId: merchantOrderId
    }));

    await Transaction.findByIdAndUpdate(newTransaction._id, {
      encryptedPaymentPayload: encryptedPayload,
      shortLinkId: shortLinkId
    });

    const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process/${shortLinkId}`;

    return res.json({
      success: true,
      paymentLink: customPaymentLink,
      transactionRefId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      isMock: false,
      message: 'Payment link generated successfully!'
    });

  } catch (error) {
    console.error('🔥 Error in generatePaymentLink:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
// Keep other functions the same...
export const getMerchants = async (req, res) => {
  try {
   const staticMerchants = [
      {
        _id: "68fb0322970e105debcc26e7", // ✅ Update this too
        firstname: "John",
        lastname: "Doe", 
        mid: "MID123456"
      }
    ];

    res.json({
      success: true,
      merchants: staticMerchants
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching merchants'
    });
  }
};

export const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      { id: "upi", name: "UPI" },
      { id: "card", name: "Credit/Debit Card" },
      { id: "netbanking", name: "Net Banking" }
    ];

    res.json({
      success: true,
      methods: methods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods'
    });
  }
};

export const handleSuccess = async (req, res) => {
  try {
    const { transactionId } = req.query;
    console.log('✅ Success callback for:', transactionId);

    if (transactionId) {
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: 'SUCCESS' }
      );
    }

    // Direct redirect to frontend success page
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=success&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Success callback error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=error`);
  }
};

export const handleReturn = async (req, res) => {
  try {
    const { transactionId, status } = req.query;
    console.log('↩️ Return callback for:', transactionId, 'status:', status);

    if (transactionId) {
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: status || 'FAILED' }
      );
    }

    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=${status || 'failed'}&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Return callback error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error`);
  }
};
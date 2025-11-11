import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose'; // ✅ ADD THIS IMPORT
import axios from 'axios'; // ✅ IMPORTANT: Add this import

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';


// Environment variables

const ENPAY_MERCHANT_KEY = process.env.ENPAY_MERCHANT_KEY;
const ENPAY_MERCHANT_SECRET = process.env.ENPAY_MERCHANT_SECRET;

// backend/controllers/paymentLinkController.js
// backend/controllers/paymentLinkController.js
export const generatePaymentLink = async (req, res) => {
  console.log('🚀 generatePaymentLink function called');
  
  try {
    console.log('📦 Request body:', req.body);

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // Validation
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

    const staticMerchants = [
  {
    _id: "6905b4b5a1ocf16df46bb2", // ✅ Real merchant ID
    firstname: "SKYPAL SYSTEM",
    lastname: "PRIVATE LIMITED", 
    mid: "M1761981621943857",
    hashId: "MERCDSH51Y7CD4YJLFIZR8NF", // Enpay hash ID
    vpa: "enpay1.skypal@fino",
    merchantName: "SKYPAL SYSTEM PRIVATE LIMITED"
  },
  {
    _id: "690af75c8ca79a8525c0ba03",
    firstname: "abc",
    lastname: "efd",
    mid: "M1762326364850484",
    hashId: "MERCDSH51Y7CD4YJLFIZR8NF",
    vpa: "enpay1.skypal@fino", 
    merchantName: "SKYPAL SYSTEM PRIVATE LIMITED"
  }
];

    const merchant = staticMerchants.find(m => m._id === merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;
    const shortLinkId = `pay_${timestamp}${randomSuffix}`;

    console.log('🆔 Generated IDs:', { merchantOrderId, merchantTrnId, shortLinkId });

    // ✅ REAL ENPAY API CALL
    const API_BASE_URL = process.env.API_BASE_URL || 'https://pg-admin-backend.vercel.app';
    const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

    const enpayRequestData = {
      "amount": amountNum.toFixed(2),
      "merchantHashId": merchant.hashId,
      "merchantOrderId": merchantOrderId,
      "merchantTrnId": merchantTrnId,
      "merchantVpa": merchant.vpa,
      "returnURL": `${API_BASE_URL}/api/payment/return?transactionId=${merchantTrnId}`,
      "successURL": `${API_BASE_URL}/api/payment/success?transactionId=${merchantTrnId}`,
      "txnNote": `Payment for ${merchant.merchantName}`
    };

    console.log('📤 Enpay API Request Data:', JSON.stringify(enpayRequestData, null, 2));

    let enpayResponse;
    let finalPaymentLink = '';
    let isMock = false;

    try {
      console.log('🔄 Calling REAL Enpay API...');
      
      enpayResponse = await axios({
        method: 'POST',
        url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': process.env.ENPAY_MERCHANT_KEY,
          'X-Merchant-Secret': process.env.ENPAY_MERCHANT_SECRET
        },
        data: enpayRequestData,
        timeout: 30000
      });

      console.log('✅ Enpay API Response Status:', enpayResponse.status);
      console.log('✅ Enpay API Response Data:', JSON.stringify(enpayResponse.data, null, 2));

      // Validate Enpay response
      if (enpayResponse.data && enpayResponse.data.details) {
        finalPaymentLink = enpayResponse.data.details;
        console.log('🔗 Real Enpay Payment Link:', finalPaymentLink);
        isMock = false;
      } else {
        throw new Error('Invalid response from Enpay API');
      }

    } catch (apiError) {
      console.error('❌ Enpay API Error:', apiError.response?.data || apiError.message);
      
      // Fallback to mock
      console.log('🔄 Falling back to mock payment...');
      finalPaymentLink = "https://enpay.in/payment-page"; // Mock Enpay URL
      isMock = true;
    }

    // ✅ CRITICAL: Create transaction record in database
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
      shortLinkId: shortLinkId,
      isMock: isMock,
      enpayTxnId: enpayResponse?.data?.data?.transactionId || merchantTrnId
    };

    console.log('💾 Saving transaction to database...');
    
    let newTransaction;
    try {
      newTransaction = new Transaction(transactionData);
      await newTransaction.save();
      console.log('✅ Transaction saved with ID:', newTransaction._id);
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
      throw new Error(`Failed to save transaction: ${dbError.message}`);
    }

    // ✅ Encrypt and save payment payload
    const encryptedPayload = encrypt(JSON.stringify({
      enpayLink: finalPaymentLink,
      transactionId: merchantTrnId,
      merchantName: merchant.merchantName,
      amount: amountNum.toFixed(2),
      orderId: merchantOrderId,
      isMock: isMock
    }));

    // Update transaction with encrypted payload
    await Transaction.findByIdAndUpdate(newTransaction._id, {
      encryptedPaymentPayload: encryptedPayload
    });

    const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process/${shortLinkId}`;

    console.log('🎉 Payment link generation completed!');
    console.log('🔗 Custom Payment Link:', customPaymentLink);
    console.log('🔗 Final Enpay Link:', finalPaymentLink);
    console.log('📱 Is Mock:', isMock);

    return res.json({
      success: true,
      paymentLink: customPaymentLink,
      transactionRefId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      isMock: isMock,
      message: isMock ? 
        'Mock payment link generated (Enpay API issue)' : 
        'Real payment link generated successfully!'
    });

  } catch (error) {
    console.error('🔥 ERROR in generatePaymentLink:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


export const getMerchants = async (req, res) => {
  try {
 const staticMerchants = [
  {
    _id: "6905b4b5a1ocf16df46bb2", // ✅ Real merchant ID
    firstname: "SKYPAL SYSTEM",
    lastname: "PRIVATE LIMITED", 
    mid: "M1761981621943857",
    hashId: "MERCDSH51Y7CD4YJLFIZR8NF", // Enpay hash ID
    vpa: "enpay1.skypal@fino",
    merchantName: "SKYPAL SYSTEM PRIVATE LIMITED"
  },
  {
    _id: "690af75c8ca79a8525c0ba03",
    firstname: "abc",
    lastname: "efd",
    mid: "M1762326364850484",
    hashId: "MERCDSH51Y7CD4YJLFIZR8NF",
    vpa: "enpay1.skypal@fino", 
    merchantName: "SKYPAL SYSTEM PRIVATE LIMITED"
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
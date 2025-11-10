import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose'; // ✅ ADD THIS IMPORT

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

export const generatePaymentLink = async (req, res) => {
  console.log('🚀 Starting payment link generation...');
  
  try {
    console.log('📦 Request body:', req.body);

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // Basic validation
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

    console.log('✅ Input validation passed');

    // Static merchant data
   // In paymentLinkController.js - update the static merchants
const staticMerchants = [
  { 
    _id: "68fb0322970e105debcc26e7", // ✅ Change this to match your frontend
    firstname: "John", 
    lastname: "Doe", 
    mid: "MID123456", 
    hashId: "MERCDSH51Y7CD4YJLFIZR8NF", 
    vpa: "enpay1.skypal@fino" 
  }
];

    const merchant = staticMerchants.find(m => m._id === merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    console.log('✅ Merchant found:', merchant.firstname, merchant.lastname);

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;

    console.log('🆔 Generated IDs:', { merchantOrderId, merchantTrnId });

    // Create transaction with ALL required fields
    const transactionData = {
      transactionId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      merchantHashId: merchant.hashId,
      merchantId: merchant._id, // Use string ID for static merchants
      merchantName: `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      amount: amountNum,
      currency: currency,
      status: 'Pending',
      "Commission Amount": 0,
      "Settlement Status": 'Pending',
      "Vendor Ref ID": `VENDOR_REF_${merchantTrnId}`,
      "Vendor Txn ID": '',
      merchantVpa: merchant.vpa,
      txnRefId: merchantTrnId,
      txnNote: `Payment for Order ${merchantOrderId}`,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      source: 'enpay',
      isMock: false,
      "Customer Name": '',
      "Customer VPA": '',
      "Customer Contact No": null
    };

    console.log('💾 Saving transaction to database...');

    // Save transaction
    let transaction;
    try {
      transaction = new Transaction(transactionData);
      await transaction.save();
      console.log('✅ Transaction saved successfully:', transaction.transactionId);
    } catch (saveError) {
      console.error('❌ TRANSACTION SAVE ERROR:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save transaction',
        error: saveError.message,
        details: saveError.errors || 'Check database connection'
      });
    }

    // Prepare Enpay API request
    const requestData = {
      "amount": amountNum.toFixed(2),
      "merchantHashId": merchant.hashId,
      "merchantOrderId": merchantOrderId,
      "merchantTrnId": merchantTrnId,
      "merchantVpa": merchant.vpa,
      "returnURL": `${API_BASE_URL}/api/payment/return?transactionId=${merchantTrnId}`,
      "successURL": `${API_BASE_URL}/api/payment/success?transactionId=${merchantTrnId}`,
      "txnNote": `Payment for Order ${merchantOrderId}`
    };

    console.log('📤 Calling Enpay API...');

    let finalPaymentLink = '';
    let isMockPayment = false;

    // Enpay API call
    try {
      const axios = await import('axios');
      const response = await axios.default({
        method: 'POST',
        url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': process.env.ENPAY_MERCHANT_KEY,
          'X-Merchant-Secret': process.env.ENPAY_MERCHANT_SECRET
        },
        data: requestData,
        timeout: 30000
      });

      const enpayResponse = response.data;
      console.log('✅ Enpay API Response:', enpayResponse);

      if (enpayResponse.code === 200 || enpayResponse.code === 299) {
        finalPaymentLink = enpayResponse.details;
        isMockPayment = false;
        console.log('🔗 Real Enpay Payment Link:', finalPaymentLink);
        
        // Update transaction with Enpay data
        await Transaction.findOneAndUpdate(
          { transactionId: merchantTrnId },
          {
            paymentUrl: finalPaymentLink,
            status: 'INITIATED',
            enpayTxnId: enpayResponse.data?.transactionId || merchantTrnId
          }
        );
      } else {
        throw new Error(enpayResponse.message || 'Enpay API error');
      }

    } catch (apiError) {
      console.error('❌ Enpay API failed, using mock payment');
      isMockPayment = true;
      finalPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?transactionId=${merchantTrnId}&amount=${amountNum}`;
      
      // Update transaction as mock
      await Transaction.findOneAndUpdate(
        { transactionId: merchantTrnId },
        {
          paymentUrl: finalPaymentLink,
          isMock: true,
          status: 'INITIATED'
        }
      );
    }

    // Generate short link
    try {
      const shortLinkId = crypto.createHash('sha256')
        .update(merchantTrnId)
        .digest('base64url')
        .substring(0, 10);

      const encryptedPayload = encrypt(JSON.stringify({
        enpayLink: finalPaymentLink,
        transactionId: merchantTrnId
      }));

      await Transaction.findOneAndUpdate(
        { transactionId: merchantTrnId },
        {
          encryptedPaymentPayload: encryptedPayload,
          shortLinkId: shortLinkId
        }
      );

      const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process/${shortLinkId}`;

      console.log('🎉 PAYMENT LINK GENERATION COMPLETED!');
      console.log('🔗 Short Link:', customPaymentLink);

      return res.json({
        success: true,
        paymentLink: customPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: isMockPayment,
        message: isMockPayment ? 
          'Mock payment link generated' : 
          'Real payment link generated successfully!'
      });

    } catch (linkError) {
      console.error('❌ Short link error, returning direct link');
      
      return res.json({
        success: true,
        paymentLink: finalPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: isMockPayment,
        message: 'Payment link generated'
      });
    }

  } catch (error) {
    console.error('🔥 TOP-LEVEL ERROR:', error);
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
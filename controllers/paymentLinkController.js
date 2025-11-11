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


export const generatePaymentLink = async (req, res) => {
  console.log('🚀 generatePaymentLink function called');
  
  try {
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    // Environment variables check
    console.log('🔑 Environment Variables:', {
      ENPAY_MERCHANT_KEY: process.env.ENPAY_MERCHANT_KEY ? 'SET' : 'MISSING',
      ENPAY_MERCHANT_SECRET: process.env.ENPAY_MERCHANT_SECRET ? 'SET' : 'MISSING',
      API_BASE_URL: process.env.API_BASE_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      NODE_ENV: process.env.NODE_ENV
    });

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

    console.log('✅ Validation passed');

    // Merchant data
    const staticMerchants = [
      {
        _id: "68fb0322970e105debcc26e7",
        firstname: "John",
        lastname: "Doe",
        mid: "MID123456",
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

    console.log('✅ Merchant found:', merchant.merchantName);

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;

    console.log('🆔 Generated IDs:', { merchantOrderId, merchantTrnId });

    // Prepare Enpay API request
    const API_BASE_URL = process.env.API_BASE_URL || 'https://pg-admin-backend.vercel.app';
    
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

    // Check environment variables
    if (!process.env.ENPAY_MERCHANT_KEY || !process.env.ENPAY_MERCHANT_SECRET) {
      console.error('❌ MISSING ENPAY CREDENTIALS');
      throw new Error('Enpay credentials not configured in environment variables');
    }

    console.log('🔄 Calling Enpay API...');

    let enpayResponse;
    try {
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

    } catch (apiError) {
      console.error('❌ ENPAY API ERROR:');
      console.error('Error Message:', apiError.message);
      console.error('Response Status:', apiError.response?.status);
      console.error('Response Data:', apiError.response?.data);
      
      // Mock fallback
      console.log('🔄 Using mock payment fallback...');
      
      const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
      const mockPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?amount=${amountNum}&orderId=${merchantOrderId}`;
      
      return res.json({
        success: true,
        paymentLink: mockPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: true,
        message: 'Mock payment link generated (Enpay API unavailable)'
      });
    }

    // Validate Enpay response
    if (!enpayResponse.data || !enpayResponse.data.details) {
      console.error('❌ Invalid Enpay response structure');
      throw new Error('Invalid response from payment gateway');
    }

    const finalPaymentLink = enpayResponse.data.details;
    console.log('🔗 Enpay Payment Link:', finalPaymentLink);

    // Generate short link
    const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
    const shortLinkId = `pay_${timestamp}${randomSuffix}`;
    
    const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process/${shortLinkId}`;

    console.log('🎉 Payment link generation completed!');
    console.log('🔗 Custom Payment Link:', customPaymentLink);

    return res.json({
      success: true,
      paymentLink: customPaymentLink,
      transactionRefId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      isMock: false,
      message: 'Payment link generated successfully!'
    });

  } catch (error) {
    console.error('🔥 TOP-LEVEL ERROR in generatePaymentLink:');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
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
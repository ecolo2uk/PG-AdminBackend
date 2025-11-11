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
export const generatePaymentLink = async (req, res) => {
  console.log('🚀 generatePaymentLink function called');
  
  try {
    // Check if body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ req.body is empty or undefined');
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
        receivedBody: req.body
      });
    }

    console.log('📦 Full request object:', {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body
    });

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // Check individual fields
    if (!merchantId) {
      console.log('❌ merchantId missing');
      return res.status(400).json({
        success: false,
        message: 'Merchant ID is required',
        received: { merchantId, amount, paymentMethod, paymentOption }
      });
    }

    console.log('✅ All fields received:', { merchantId, amount, paymentMethod, paymentOption });

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
    console.log('🔍 Looking for merchant ID:', merchantId);
    console.log('📋 Available merchants:', staticMerchants.map(m => ({ id: m._id, name: m.firstname })));

    const merchant = staticMerchants.find(m => m._id === merchantId);
    
    if (!merchant) {
      console.log(`❌ Merchant not found for ID: ${merchantId}`);
      return res.status(404).json({
        success: false,
        message: 'Merchant not found',
        requestedId: merchantId,
        availableMerchants: staticMerchants.map(m => ({ id: m._id, name: `${m.firstname} ${m.lastname}` }))
      });
    }

    console.log('✅ Merchant found:', merchant.merchantName);

    // Rest of your existing code...
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 500 || amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 500 and 10,000 INR'
      });
    }

    // Continue with Enpay API call...
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;

    console.log('🆔 Generated IDs:', { merchantOrderId, merchantTrnId });

    // Mock response for testing
    const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
    const shortLinkId = `pay_${timestamp}${randomSuffix}`;
    const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process/${shortLinkId}`;

    console.log('🎉 Payment link generation completed!');

    return res.json({
      success: true,
      paymentLink: customPaymentLink,
      transactionRefId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      isMock: true, // Temporary for testing
      message: 'Payment link generated successfully! (Mock mode)'
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
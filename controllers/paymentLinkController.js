import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose';

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

export const generatePaymentLink = async (req, res) => {
  try {
    console.log('🔵 generatePaymentLink called with body:', req.body);

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
        message: 'Amount must be a valid number between 500 and 10,000 INR'
      });
    }

    // Static merchant data - तुमच्या actual merchant ID वापरा
    const staticMerchants = [
      { 
        _id: "6905b4b5a10cf16d1f46b6b2", // तुमचा actual merchant ObjectId
        firstname: "SKYPAL", 
        lastname: "SYSTEM", 
        mid: "M1761981621943857", // तुमचा actual MID
        hashId: "MERCDSH51Y7CD4YJLFIZR8NF", 
        vpa: "enpay1.skypal@fino" 
      },
      { 
        _id: "MERCHANT001", 
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

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;

    // Create transaction with EXACT field names from your database
    const transactionData = {
      transactionId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      merchantHashId: merchant.hashId,
      merchantId: new mongoose.Types.ObjectId(merchant._id), // Use ObjectId
      merchantName: merchant.firstname + " " + merchant.lastname + " PRIVATE LIMITED",
      mid: merchant.mid,
      amount: amountNum,
      currency: currency,
      status: 'Pending',
      "Commission Amount": 0, // Exact field name
      "Settlement Status": 'Pending', // Exact field name  
      "Vendor Ref ID": `VENDOR_REF_${merchantTrnId}`, // Exact field name
      "Vendor Txn ID": '', // Will be updated by Enpay
      merchantVpa: merchant.vpa,
      txnRefId: merchantTrnId,
      txnNote: `Payment for Order ${merchantOrderId}`,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      source: 'enpay',
      isMock: false,
      // Customer fields
      "Customer Name": '',
      "Customer VPA": '',
      "Customer Contact No": null
    };

    console.log('💾 Creating transaction with data:', transactionData);

    let transaction;
    try {
      transaction = new Transaction(transactionData);
      await transaction.save();
      console.log('✅ Transaction saved successfully:', transaction.transactionId);
    } catch (saveError) {
      console.error('❌ Transaction save error:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save transaction to database',
        error: saveError.message,
        validationErrors: saveError.errors
      });
    }

    // Enpay API call
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

    console.log('📤 Sending to Enpay API:', JSON.stringify(requestData, null, 2));

    let finalPaymentLink = '';
    let isMockPayment = false;
    let enpayResponse = null;

    try {
      const axios = await import('axios');
      const response = await axios.default({
        method: 'POST',
        url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': process.env.ENPAY_MERCHANT_KEY || '0851439b-03df-4983-88d6-32399b1e4514',
          'X-Merchant-Secret': process.env.ENPAY_MERCHANT_SECRET || 'bae97f533a594af9bf3dded47f09c34e15e053d1'
        },
        data: requestData,
        timeout: 30000
      });

      enpayResponse = response.data;
      console.log('✅ Enpay API Response:', enpayResponse);

      if (enpayResponse.code === 200 || enpayResponse.code === 299) {
        finalPaymentLink = enpayResponse.details;
        isMockPayment = false;
        console.log('🔗 Real Enpay Link:', finalPaymentLink);
      } else {
        throw new Error(enpayResponse.message || 'Enpay API returned error');
      }

    } catch (apiError) {
      console.error('❌ Enpay API failed:', apiError.response?.data || apiError.message);
      isMockPayment = true;
      finalPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?transactionId=${merchantTrnId}&amount=${amountNum}`;
      console.log('🔄 Using mock payment:', finalPaymentLink);
    }

    // Update transaction with payment URL and Enpay response
    try {
      const updateData = {
        paymentUrl: finalPaymentLink,
        isMock: isMockPayment,
        status: 'INITIATED'
      };

      // Add Enpay transaction ID if available
      if (enpayResponse?.data?.transactionId) {
        updateData.enpayTxnId = enpayResponse.data.transactionId;
      }

      await Transaction.findOneAndUpdate(
        { transactionId: merchantTrnId },
        updateData,
        { new: true }
      );
      console.log('✅ Transaction updated with payment URL');
    } catch (updateError) {
      console.error('❌ Transaction update error:', updateError);
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

      console.log('🎉 Payment link generation completed');
      console.log('🔗 Short Link:', customPaymentLink);

      return res.json({
        success: true,
        paymentLink: customPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: isMockPayment,
        message: isMockPayment ? 
          'Mock payment link generated (Enpay API unavailable)' : 
          'Real payment link generated successfully',
        enpayResponse: enpayResponse
      });

    } catch (linkError) {
      console.error('❌ Short link generation error:', linkError);
      
      // Return direct payment link if short link fails
      return res.json({
        success: true,
        paymentLink: finalPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: isMockPayment,
        message: 'Payment link generated (short link failed)'
      });
    }

  } catch (error) {
    console.error('🔥 generatePaymentLink top-level ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment link generation',
      error: error.message
    });
  }
};

// Add mongoose import at top if not already there

export const getMerchants = async (req, res) => {
  try {
    // तुमचे actual merchants द्या
    const staticMerchants = [
      {
        _id: "6905b4b5a10cf16d1f46b6b2", // तुमचा actual merchant ID
        firstname: "SKYPAL",
        lastname: "SYSTEM", 
        mid: "M1761981621943857",
        company: "SKYPAL SYSTEM PRIVATE LIMITED"
      },
      {
        _id: "MERCHANT001", 
        firstname: "John",
        lastname: "Doe",
        mid: "MID123456",
        company: "Test Merchant"
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
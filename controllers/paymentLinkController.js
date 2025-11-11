import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose'; // ✅ ADD THIS IMPORT

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';


// Environment variables

const ENPAY_MERCHANT_KEY = process.env.ENPAY_MERCHANT_KEY;
const ENPAY_MERCHANT_SECRET = process.env.ENPAY_MERCHANT_SECRET;

export const generatePaymentLink = async (req, res) => {
  console.log('🚀 Starting payment link generation...');

  try {
    console.log('📦 Request body:', req.body);

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // 1. Basic validation
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      console.log('❌ Validation failed: All fields are required');
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 500 || amountNum > 10000) {
      console.log('❌ Validation failed: Amount must be between 500 and 10,000 INR');
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 500 and 10,000 INR'
      });
    }

    console.log('✅ Input validation passed');

    // 2. Static merchant data (consider fetching from DB in a real app)
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
      console.log('❌ Merchant not found for ID:', merchantId);
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    console.log('✅ Merchant found:', merchant.firstname, merchant.lastname);

    // 3. Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000); // Increased randomness
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;

    console.log('🆔 Generated IDs:', { merchantOrderId, merchantTrnId });

    // 4. Create transaction with ALL required fields
    const transactionData = {
      transactionId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      merchantHashId: merchant.hashId,
      merchantId: merchant._id,
      merchantName: `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      amount: amountNum,
      currency: currency,
      status: 'Pending', // Initial status
      "Commission Amount": 0, // Default for now
      "Settlement Status": 'Pending', // Default
      "Vendor Ref ID": `VENDOR_REF_${merchantTrnId}`,
      "Vendor Txn ID": '',
      merchantVpa: merchant.vpa,
      txnRefId: merchantTrnId, // Our internal transaction reference
      txnNote: `Payment for Order ${merchantOrderId}`,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      source: 'enpay',
      isMock: false,
      "Customer Name": '', // To be filled if available
      "Customer VPA": '', // To be filled if available
      "Customer Contact No": null // To be filled if available
    };

    console.log('💾 Saving initial transaction to database...');

    let newTransaction;
    try {
      newTransaction = new Transaction(transactionData);
      await newTransaction.save();
      console.log('✅ Initial transaction saved successfully:', newTransaction.transactionId);
    } catch (saveError) {
      console.error('❌ TRANSACTION SAVE ERROR:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save initial transaction',
        error: saveError.message,
        details: saveError.errors || 'Check database connection'
      });
    }

    // 5. Prepare Enpay API request
    const enpayRequestData = {
      "amount": amountNum.toFixed(2),
      "merchantHashId": merchant.hashId,
      "merchantOrderId": merchantOrderId,
      "merchantTrnId": merchantTrnId, // Our internal transaction ID for Enpay
      "merchantVpa": merchant.vpa,
      "returnURL": `${API_BASE_URL}/api/payment/return?transactionId=${merchantTrnId}`,
      "successURL": `${API_BASE_URL}/api/payment/success?transactionId=${merchantTrnId}`,
      "txnNote": `Payment for Order ${merchantOrderId}`
    };

    console.log('📤 Calling Enpay API with data:', JSON.stringify(enpayRequestData, null, 2));

    let finalPaymentLink = '';
    let isMockPayment = false;
    let enpayTxnId = null; // To store Enpay's transaction ID

    // 6. Enpay API call
    try {
      const enpayResponse = await axios({
        method: 'POST',
        url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': ENPAY_MERCHANT_KEY,
          'X-Merchant-Secret': ENPAY_MERCHANT_SECRET
        },
        data: enpayRequestData,
        timeout: 30000 // 30 seconds timeout
      });

      console.log('✅ Raw Enpay API Response:', JSON.stringify(enpayResponse.data, null, 2));

      // Validate Enpay's successful response structure
      if (enpayResponse.data && (enpayResponse.data.code === 200 || enpayResponse.data.code === 299) && enpayResponse.data.details) {
        finalPaymentLink = enpayResponse.data.details; // This should be the payment URL
        enpayTxnId = enpayResponse.data.data?.transactionId || merchantTrnId; // Enpay's internal txn ID if provided
        isMockPayment = false;
        console.log('🔗 Real Enpay Payment Link:', finalPaymentLink);

        // Update transaction with Enpay data
        await Transaction.findOneAndUpdate(
          { transactionId: merchantTrnId },
          {
            paymentUrl: finalPaymentLink,
            status: 'INITIATED', // Set status to INITIATED
            enpayTxnId: enpayTxnId // Store Enpay's transaction ID
          },
          { new: true }
        );
      } else {
        // If Enpay responds but with an error code or missing data
        console.error('❌ Enpay API responded with an error or invalid structure:', enpayResponse.data.message || 'Unknown Enpay error');
        throw new Error(enpayResponse.data.message || 'Enpay API error, using mock payment');
      }

    } catch (apiError) {
      console.error('❌ Enpay API failed (or responded with error), falling back to mock payment:', apiError.message);
      isMockPayment = true;
      finalPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?transactionId=${merchantTrnId}&amount=${amountNum.toFixed(2)}`;

      // Update transaction as mock
      await Transaction.findOneAndUpdate(
        { transactionId: merchantTrnId },
        {
          paymentUrl: finalPaymentLink,
          isMock: true,
          status: 'INITIATED' // Still mark as initiated
        },
        { new: true }
      );
    }

    // 7. Generate short link and encrypt payload
    try {
      // Create a shortLink ID from a hash of the transactionId for uniqueness and brevity
      const shortLinkId = newTransaction._id.toString(); // Use MongoDB _id for a short, unique ID

      const encryptedPayload = encrypt(JSON.stringify({
        enpayLink: finalPaymentLink,
        transactionId: merchantTrnId,
        isMock: isMockPayment
      }));

      // Update the transaction with the encrypted payload and short link ID
      await Transaction.findOneAndUpdate(
        { transactionId: merchantTrnId },
        {
          encryptedPaymentPayload: encryptedPayload,
          shortLinkId: shortLinkId
        },
        { new: true }
      );

      const customPaymentLink = `${FRONTEND_BASE_URL}/payments/process/${shortLinkId}`;

      console.log('🎉 PAYMENT LINK GENERATION COMPLETED!');
      console.log('🔗 Short Link for Frontend:', customPaymentLink);

      return res.json({
        success: true,
        paymentLink: customPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: isMockPayment,
        message: isMockPayment ?
          'Mock payment link generated due to Enpay API failure or issue.' :
          'Real payment link generated successfully!'
      });

    } catch (linkError) {
      console.error('❌ Error generating short link or encrypting payload:', linkError);
      console.log('⚠️ Falling back to returning the direct payment link...');

      // If short link generation fails, return the direct Enpay link or mock link
      return res.status(200).json({ // Still success, but without the custom short link
        success: true,
        paymentLink: finalPaymentLink, // Direct link
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: isMockPayment,
        message: 'Payment link generated, but custom short link creation failed.'
      });
    }

  } catch (error) {
    console.error('🔥 TOP-LEVEL ERROR IN generatePaymentLink:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Provide stack in dev
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
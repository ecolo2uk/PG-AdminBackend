import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';

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
    if (amountNum < 500 || amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 500 and 10,000 INR'
      });
    }

    // Static merchant data
    const staticMerchants = [
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

    // Create transaction
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
      merchantVpa: merchant.vpa,
      txnRefId: merchantTrnId,
      txnNote: `Payment for Order ${merchantOrderId}`,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      source: 'enpay'
    });

    await transaction.save();
    console.log('✅ Transaction saved:', transaction.transactionId);

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

    console.log('📤 Sending to Enpay API:', requestData);

    let finalPaymentLink = '';
    let isMockPayment = false;

    try {
      // Using axios for API call
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

      console.log('✅ Enpay API Response:', response.data);

      if (response.data.code === 200) {
        finalPaymentLink = response.data.details;
        isMockPayment = false;
        console.log('🔗 Real Enpay Link:', finalPaymentLink);
      } else {
        throw new Error('Enpay API error');
      }

    } catch (apiError) {
      console.error('❌ Enpay API failed, using mock:', apiError.message);
      isMockPayment = true;
      finalPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?transactionId=${merchantTrnId}&amount=${amountNum}`;
    }

    // Update transaction with payment URL
    await Transaction.findOneAndUpdate(
      { transactionId: merchantTrnId },
      {
        paymentUrl: finalPaymentLink,
        isMock: isMockPayment,
        status: 'INITIATED'
      }
    );

    // Generate short link
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

    res.json({
      success: true,
      paymentLink: customPaymentLink,
      transactionRefId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      isMock: isMockPayment,
      message: isMockPayment ? 
        'Mock payment link generated' : 
        'Real payment link generated successfully'
    });

  } catch (error) {
    console.error('🔥 generatePaymentLink ERROR:', error);
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
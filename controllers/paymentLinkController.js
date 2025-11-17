import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose'; // ✅ ADD THIS IMPORT
import axios from 'axios'; // ✅ IMPORTANT: Add this import
import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import User from '../models/User.js';
 
const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';


// Environment variables

const ENPAY_MERCHANT_KEY = process.env.ENPAY_MERCHANT_KEY;
const ENPAY_MERCHANT_SECRET = process.env.ENPAY_MERCHANT_SECRET;

export const generatePaymentLink = async (req, res) => {
  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // Validation
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // ✅ STEP 1: Get merchant's PRIMARY connector account
    const primaryAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      isPrimary: true,
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId');

    if (!primaryAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active primary connector account found for this merchant'
      });
    }

    console.log('🔗 Using Connector:', primaryAccount.connectorId.name);
    console.log('💰 Using Account:', primaryAccount.connectorAccountId.name);

    // ✅ STEP 2: Get merchant details
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // ✅ STEP 3: Get connector account credentials
    const connectorAccount = await ConnectorAccount.findById(primaryAccount.connectorAccountId._id);
    if (!connectorAccount) {
      return res.status(404).json({
        success: false,
        message: 'Connector account not found'
      });
    }

    // ✅ STEP 4: Dynamic API call based on connector type
    let paymentLink;
    let isMock = false;

    if (primaryAccount.connectorId.name === 'Enpay') {
      paymentLink = await generateEnpayPaymentLink({
        merchant,
        amount,
        connectorAccount,
        primaryAccount
      });
    } 
    // Add other connectors here
    else if (primaryAccount.connectorId.name === 'Razorpay') {
      paymentLink = await generateRazorpayPaymentLink({
        merchant,
        amount,
        connectorAccount,
        primaryAccount
      });
    }
    else {
      return res.status(400).json({
        success: false,
        message: `Unsupported connector: ${primaryAccount.connectorId.name}`
      });
    }

    // ✅ STEP 5: Create transaction record
    const transactionData = {
      transactionId: `TRN${Date.now()}${Math.floor(Math.random() * 1000)}`,
      merchantOrderId: `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`,
      merchantHashId: connectorAccount.integrationKeys.get('merchantHashId') || merchant.mid,
      merchantId: merchant._id,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      amount: parseFloat(amount),
      currency: currency,
      status: 'INITIATED',
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: paymentLink,
      connectorId: primaryAccount.connectorId._id,
      connectorAccountId: primaryAccount.connectorAccountId._id,
      isMock: isMock
    };

    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();

    res.json({
      success: true,
      paymentLink: paymentLink,
      transactionRefId: transactionData.transactionId,
      connector: primaryAccount.connectorId.name,
      connectorAccount: primaryAccount.connectorAccountId.name,
      isMock: isMock
    });

  } catch (error) {
    console.error('Error generating payment link:', error);
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
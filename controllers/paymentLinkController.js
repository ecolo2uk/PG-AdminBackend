import Transaction from '../models/Transaction.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import User from '../models/User.js';

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// 🎯 GENERIC PAYMENT LINK FOR ALL CONNECTORS
const generateGenericPaymentLink = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption }) => {
  try {
    console.log('🔗 Generating Generic Payment Link for ALL connectors...');
    
    // Get basic details from database
    const terminalId = primaryAccount.terminalId || 'N/A';
    const connectorName = primaryAccount.connectorId?.name || 'Unknown';
    const merchantName = merchant.company || `${merchant.firstname} ${merchant.lastname}`;
    const merchantMID = merchant.mid;
    
    console.log('📦 Payment Details from DB:', {
      merchant: merchantName,
      merchantId: merchantMID,
      terminalId: terminalId,
      connector: connectorName,
      amount: amount,
      paymentMethod: paymentMethod,
      paymentOption: paymentOption
    });

    // ✅ GENERIC PAYMENT LINK STRUCTURE FOR ALL CONNECTORS
    const genericLink = `https://pay.skypal.com/process?` + 
      `mid=${encodeURIComponent(merchantMID)}` +
      `&amount=${amount}` +
      `&currency=INR` +
      `&terminal=${encodeURIComponent(terminalId)}` +
      `&connector=${encodeURIComponent(connectorName)}` +
      `&method=${encodeURIComponent(paymentMethod)}` +
      `&option=${encodeURIComponent(paymentOption)}` +
      `&timestamp=${Date.now()}`;
    
    console.log('✅ Generated Generic Payment URL for ALL connectors:', genericLink);
    
    return genericLink;
    
  } catch (error) {
    console.error('❌ Error generating generic payment link:', error);
    
    // Ultra simple fallback
    const fallbackUrl = `https://pay.skypal.com/pay?mid=${merchant.mid}&amount=${amount}`;
    return fallbackUrl;
  }
};


export const generatePaymentLink = async (req, res) => {
  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    console.log('🔄 Received payment link request:', req.body);

    // Enhanced Validation
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: merchantId, amount, paymentMethod, paymentOption'
      });
    }

    // Amount validation
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount format'
      });
    }

    if (amountNum < 500 || amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 500 and 10,000 INR'
      });
    }

    console.log('🔍 STEP 1: Looking for active connector account for merchant:', merchantId);

    // ✅ STEP 1: Get merchant's ANY ACTIVE connector account FROM DATABASE
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId');

    if (!activeAccount) {
      console.log('❌ No active connector account found for merchant:', merchantId);
      return res.status(404).json({
        success: false,
        message: 'No active connector account found for this merchant. Please assign a connector account first.'
      });
    }

    console.log('✅ Found Connector from DB:', activeAccount.connectorId?.name);
    console.log('💰 Using Account from DB:', activeAccount.connectorAccountId?.name);

    // ✅ STEP 2: Get merchant details FROM DATABASE
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      console.log('❌ Merchant not found in database:', merchantId);
      return res.status(404).json({
        success: false,
        message: 'Merchant not found in database'
      });
    }

    console.log('🎯 Merchant from DB:', {
      name: `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      email: merchant.email
    });

    // ✅ STEP 3: USE GENERIC PAYMENT LINK FOR ALL CONNECTORS
    console.log('🔗 Generating payment link...');
    const paymentLink = await generateGenericPaymentLink({
      merchant,
      amount: amountNum,
      primaryAccount: activeAccount,
      paymentMethod,
      paymentOption
    });

    console.log('✅ Generated Payment Link:', paymentLink);

    // ✅ STEP 4: Create transaction record IN DATABASE
    console.log('💾 Creating transaction record...');
    const transactionData = {
      transactionId: `TRN${Date.now()}${Math.floor(Math.random() * 1000)}`,
      merchantOrderId: `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`,
      merchantHashId: merchant.mid,
      merchantId: merchant._id,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      amount: amountNum,
      currency: currency,
      status: 'INITIATED',
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: paymentLink,
      connectorId: activeAccount.connectorId?._id,
      connectorAccountId: activeAccount.connectorAccountId?._id,
      terminalId: activeAccount.terminalId || 'N/A'
    };

    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();

    console.log('✅ Transaction saved to database:', transactionData.transactionId);

    // ✅ SUCCESS RESPONSE
    res.json({
      success: true,
      paymentLink: paymentLink,
      transactionRefId: transactionData.transactionId,
      connector: activeAccount.connectorId?.name || 'Unknown',
      connectorAccount: activeAccount.connectorAccountId?.name || 'Unknown',
      terminalId: activeAccount.terminalId || 'N/A',
      merchantName: `${merchant.firstname} ${merchant.lastname}`,
      message: `Payment link generated successfully using ${activeAccount.connectorId?.name || 'Generic'} connector`
    });

  } catch (error) {
    console.error('❌ ERROR in generatePaymentLink:', error);
    
    // Detailed error logging
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while generating payment link',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
};

// Add this debug route to check what's happening
export const debugPaymentLink = async (req, res) => {
  try {
    const { merchantId } = req.body;
    
    console.log('🔍 DEBUG: Checking payment link generation for merchant:', merchantId);
    
    // Check merchant exists
    const merchant = await User.findById(merchantId);
    console.log('🔍 DEBUG: Merchant found:', merchant ? `${merchant.firstname} ${merchant.lastname}` : 'NOT FOUND');
    
    // Check connector accounts
    const connectors = await MerchantConnectorAccount.find({ merchantId: merchantId, status: 'Active' })
      .populate('connectorId')
      .populate('connectorAccountId');
    
    console.log('🔍 DEBUG: Active connectors found:', connectors.length);
    connectors.forEach((conn, index) => {
      console.log(`🔍 DEBUG: Connector ${index + 1}:`, {
        connector: conn.connectorId?.name,
        account: conn.connectorAccountId?.name,
        terminalId: conn.terminalId,
        status: conn.status
      });
    });
    
    res.json({
      success: true,
      merchant: merchant ? {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
        email: merchant.email
      } : null,
      connectors: connectors.map(conn => ({
        connector: conn.connectorId?.name,
        account: conn.connectorAccountId?.name,
        terminalId: conn.terminalId,
        status: conn.status,
        isPrimary: conn.isPrimary
      })),
      totalConnectors: connectors.length
    });
    
  } catch (error) {
    console.error('❌ DEBUG Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 🎯 GET MERCHANTS FROM DATABASE
export const getMerchants = async (req, res) => {
  try {
    console.log('🔍 Fetching merchants from database...');
    
    // Fetch all merchant users from database
    const merchants = await User.find({ role: 'merchant' })
      .select('_id firstname lastname company email mid status contact balance unsettleBalance createdAt')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${merchants.length} merchants from database`);

    // Format the response
    const formattedMerchants = merchants.map(merchant => ({
      _id: merchant._id,
      firstname: merchant.firstname,
      lastname: merchant.lastname,
      company: merchant.company,
      email: merchant.email,
      mid: merchant.mid,
      status: merchant.status,
      contact: merchant.contact,
      balance: merchant.balance,
      unsettleBalance: merchant.unsettleBalance,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      hashId: merchant.mid,
      vpa: `${merchant.mid.toLowerCase()}@skypal`
    }));

    res.json({
      success: true,
      data: formattedMerchants,
      count: formattedMerchants.length
    });

  } catch (error) {
    console.error('❌ Error fetching merchants from database:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching merchants from database',
      error: error.message
    });
  }
};

// 🎯 GET MERCHANT CONNECTORS FROM DATABASE
export const getMerchantConnectors = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 Fetching connector accounts for merchant:', merchantId);

    // Validate merchantId
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    // Check if merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    console.log('🔄 Fetching connector accounts from database...');

    // Fetch connector accounts from database
    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name connectorType description')
    .populate('connectorAccountId', 'name currency integrationKeys terminalId')
    .select('terminalId industry percentage isPrimary status createdAt')
    .sort({ isPrimary: -1, createdAt: -1 })
    .lean();

    console.log(`✅ Found ${connectorAccounts.length} connector accounts for merchant: ${merchant.firstname} ${merchant.lastname}`);

    // Format the response with actual database data
    const formattedAccounts = connectorAccounts.map(account => {
      const connector = account.connectorId || {};
      const connectorAcc = account.connectorAccountId || {};
      
      return {
        _id: account._id,
        terminalId: account.terminalId || connectorAcc.terminalId || 'N/A',
        connector: connector.name || 'Unknown',
        connectorName: connector.name || 'Unknown',
        connectorType: connector.connectorType || 'Payment',
        assignedAccount: connectorAcc.name || 'Unknown',
        accountName: connectorAcc.name || 'Unknown',
        currency: connectorAcc.currency || 'INR',
        industry: account.industry || 'General',
        percentage: account.percentage || 100,
        isPrimary: account.isPrimary || false,
        status: account.status || 'Active',
        integrationKeys: connectorAcc.integrationKeys || {},
        createdAt: account.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedAccounts,
      merchantInfo: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
        email: merchant.email
      }
    });

  } catch (error) {
    console.error('❌ Error fetching merchant connectors from database:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching connector accounts from database',
      error: error.message
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

// 🎯 DEBUG ROUTE - Check database data
export const debugMerchantData = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 Debugging merchant data for:', merchantId);

    // Get merchant from database
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found in database'
      });
    }

    // Get connector accounts from database
    const connectors = await MerchantConnectorAccount.find({ merchantId: merchantId })
      .populate('connectorId')
      .populate('connectorAccountId');

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: `${merchant.firstname} ${merchant.lastname}`,
        company: merchant.company,
        email: merchant.email,
        mid: merchant.mid,
        status: merchant.status
      },
      connectors: connectors.map(conn => ({
        connector: conn.connectorId?.name,
        account: conn.connectorAccountId?.name,
        terminalId: conn.terminalId,
        status: conn.status,
        isPrimary: conn.isPrimary
      })),
      totalConnectors: connectors.length
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
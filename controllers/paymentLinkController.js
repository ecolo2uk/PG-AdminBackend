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


// In your generateGenericPaymentLink function, add timeout
const generateGenericPaymentLink = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption }) => {
  try {
    console.log('🔗 STEP 3.1: Generating Generic Payment Link...');
    
    // Add small delay to simulate processing (remove this in production)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get basic details from database
    const terminalId = primaryAccount.terminalId || 'N/A';
    const connectorName = primaryAccount.connectorId?.name || 'Unknown';
    const merchantName = merchant.company || `${merchant.firstname} ${merchant.lastname}`;
    const merchantMID = merchant.mid;
    
    console.log('📦 Payment Details:', { merchant: merchantName, terminalId, connector: connectorName, amount });

    // Validate required fields
    if (!merchantMID) {
      throw new Error('Merchant MID is required');
    }

    // ✅ GENERIC PAYMENT LINK
    const genericLink = `https://pay.skypal.com/process?` + 
      `mid=${encodeURIComponent(merchantMID)}` +
      `&amount=${amount}` +
      `&currency=INR` +
      `&terminal=${encodeURIComponent(terminalId)}` +
      `&connector=${encodeURIComponent(connectorName)}` +
      `&method=${encodeURIComponent(paymentMethod)}` +
      `&option=${encodeURIComponent(paymentOption)}` +
      `&timestamp=${Date.now()}`;
    
    console.log('✅ Generated Generic Payment URL:', genericLink);
    
    return genericLink;
    
  } catch (error) {
    console.error('❌ Error in generateGenericPaymentLink:', error);
    
    // Simple fallback
    const fallbackUrl = `https://pay.skypal.com/pay?mid=${merchant.mid}&amount=${amount}`;
    console.log('🔄 Using fallback URL:', fallbackUrl);
    return fallbackUrl;
  }
};

// Add to paymentLinkController.js
export const testPaymentGeneration = async (req, res) => {
  try {
    const { merchantId, amount = '1000', paymentMethod = 'upi', paymentOption = 'gpay' } = req.body;
    
    console.log('🧪 TEST: Testing payment generation for merchant:', merchantId);
    
    // Test data
    const testData = {
      merchantId,
      amount,
      currency: 'INR',
      paymentMethod,
      paymentOption
    };
    
    console.log('🧪 Test data:', testData);
    
    // Check merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }
    
    // Check connector accounts
    const connectors = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId');
    
    console.log('🧪 Found connectors:', connectors.length);
    
    if (connectors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active connectors found'
      });
    }
    
    // Test generic link generation
    const testLink = await generateGenericPaymentLink({
      merchant,
      amount: parseFloat(amount),
      primaryAccount: connectors[0],
      paymentMethod,
      paymentOption
    });
    
    res.json({
      success: true,
      testResults: {
        merchant: {
          name: `${merchant.firstname} ${merchant.lastname}`,
          mid: merchant.mid
        },
        connector: {
          name: connectors[0].connectorId?.name,
          account: connectors[0].connectorAccountId?.name,
          terminalId: connectors[0].terminalId
        },
        generatedLink: testLink,
        step: 'Test completed successfully'
      }
    });
    
  } catch (error) {
    console.error('❌ TEST Error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message,
      stack: error.stack
    });
  }
};


const testSimpleEndpoint = async () => {
  try {
    console.log('🧪 Testing simple endpoint...');
    
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/payment/simple-test`,
      {
        merchantId: "691aad24b2de5f1f7c80dbd1",
        amount: "1000",
        paymentMethod: "upi",
        paymentOption: "gpay"
      },
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Simple test response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Simple test failed:', error);
    throw error;
  }
};

// Add this to your paymentLinkController.js
export const debugRequestBody = async (req, res) => {
  try {
    console.log('🔍 DEBUG Request Info:');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Content-Type:', req.get('Content-Type'));

    res.json({
      success: true,
      debug: {
        headers: req.headers,
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: Object.keys(req.body),
        contentLength: req.get('Content-Length'),
        contentType: req.get('Content-Type')
      }
    });
  } catch (error) {
    console.error('❌ DEBUG Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const generatePaymentLink = async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 generatePaymentLink STARTED');
  
  // Set timeout for the entire function
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Function timeout after 25s')), 25000);
  });

  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;
    
    console.log('📦 Processing request for merchant:', merchantId);

    // Validate input quickly
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Use Promise.race to handle timeouts
    const result = await Promise.race([
      processPaymentLinkGeneration({ merchantId, amount, currency, paymentMethod, paymentOption }),
      timeoutPromise
    ]);

    console.log(`✅ Completed in ${Date.now() - startTime}ms`);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error(`❌ Failed after ${Date.now() - startTime}ms:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Payment link generation failed',
      error: error.message
    });
  }
};

// Separate function for the actual processing
const processPaymentLinkGeneration = async ({ merchantId, amount, currency, paymentMethod, paymentOption }) => {
  console.log('🔍 Step 1: Finding active connector account');
  
  const activeAccount = await MerchantConnectorAccount.findOne({
    merchantId: merchantId,
    status: 'Active'
  })
  .populate('connectorId', 'name')
  .populate('connectorAccountId', 'name terminalId integrationKeys')
  .maxTimeMS(10000)
  .lean();

  if (!activeAccount) {
    throw new Error('No active connector account found');
  }

  console.log('🔍 Step 2: Finding merchant');
  const merchant = await User.findById(merchantId)
    .select('firstname lastname company mid email contact')
    .maxTimeMS(10000)
    .lean();

  if (!merchant) {
    throw new Error('Merchant not found');
  }

  console.log('🔗 Step 3: Generating payment link');
  let paymentLink;
  const connectorName = activeAccount.connectorId?.name;

  if (connectorName === 'Enpay') {
    paymentLink = await generateEnpayPaymentLink({
      merchant,
      amount: parseFloat(amount),
      primaryAccount: activeAccount,
      paymentMethod,
      paymentOption
    });
  } else {
    paymentLink = await generateGenericPaymentLink({
      merchant,
      amount: parseFloat(amount),
      primaryAccount: activeAccount,
      paymentMethod,
      paymentOption
    });
  }

  console.log('💾 Step 4: Creating transaction with Enpay required fields');
  
  // Generate all required IDs
  const txnRefId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const merchantOrderId = `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const merchantHashId = activeAccount.connectorAccountId?.integrationKeys?.merchantHashId || merchant.mid;
  const merchantVpa = `${merchant.mid?.toLowerCase() || 'merchant'}@skypal`;

  const transactionData = {
    // Required fields for Enpay/Transaction model
    txnRefId: txnRefId,
    merchantVpa: merchantVpa,
    merchantHashId: merchantHashId,
    merchantOrderId: merchantOrderId,
    
    // Customer details for Enpay
    customerFirstName: merchant.firstname,
    customerLastName: merchant.lastname,
    customerEmail: merchant.email,
    customerPhone: merchant.contact,
    
    // Your existing fields
    transactionId: `TRN${Date.now()}${Math.floor(Math.random() * 1000)}`,
    merchantId: merchant._id,
    merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
    mid: merchant.mid,
    amount: parseFloat(amount),
    currency: currency,
    status: 'INITIATED',
    paymentMethod: paymentMethod,
    paymentOption: paymentOption,
    paymentUrl: paymentLink,
    connectorId: activeAccount.connectorId?._id,
    connectorAccountId: activeAccount.connectorAccountId?._id,
    terminalId: activeAccount.terminalId || 'N/A'
  };

  console.log('📝 Saving transaction with complete data');
  const newTransaction = new Transaction(transactionData);
  await newTransaction.save();

  console.log('✅ Transaction saved successfully with ID:', transactionData.transactionId);

  return {
    paymentLink: paymentLink,
    transactionRefId: transactionData.transactionId,
    txnRefId: txnRefId,
    connector: connectorName || 'Unknown',
    terminalId: activeAccount.terminalId || 'N/A',
    merchantName: `${merchant.firstname} ${merchant.lastname}`,
    message: 'Payment link generated successfully'
  };
};

// Add this to your paymentLinkController.js
export const simpleTest = async (req, res) => {
  console.log('🧪 SIMPLE TEST ROUTE CALLED');
  
  try {
    // Just return a simple response immediately
    res.json({
      success: true,
      message: 'Simple test route is working!',
      timestamp: new Date().toISOString(),
      data: req.body
    });
  } catch (error) {
    console.error('Simple test error:', error);
    res.status(500).json({ success: false, error: error.message });
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


// Add to paymentLinkController.js
export const healthCheck = async (req, res) => {
  try {
    // Test database connection
    const dbState = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    // Test User model
    const userCount = await User.countDocuments();
    
    // Test MerchantConnectorAccount model
    const connectorCount = await MerchantConnectorAccount.countDocuments();
    
    res.json({
      success: true,
      database: {
        state: dbStates[dbState],
        userCount,
        connectorCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
};

const generateEnpayPaymentLink = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption }) => {
  try {
    console.log('🔗 Generating Enpay payment link...');
    
    const integrationKeys = primaryAccount.connectorAccountId?.integrationKeys || {};
    const terminalId = primaryAccount.terminalId;
    
    // Generate unique transaction references
    const txnRefId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const merchantOrderId = `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    console.log('📦 Enpay transaction details:', {
      txnRefId,
      merchantOrderId,
      terminalId,
      amount,
      merchantHashId: integrationKeys.merchantHashId
    });

    // Prepare request data for Enpay API
    const requestData = {
      merchantHashId: integrationKeys.merchantHashId,
      txnAmount: parseFloat(amount),
      txnNote: `Payment to ${merchant.company || merchant.firstname}`,
      txnRefId: txnRefId,
      // Add required customer fields
      customerDetails: {
        firstName: merchant.firstname || "Customer",
        lastName: merchant.lastname || "User", 
        email: merchant.email || "customer@example.com",
        phone: merchant.contact || "9999999999"
      }
    };

    console.log('📤 Sending request to Enpay API:', requestData);

    // Call Enpay API to create dynamic QR/payment link
    const enpayResponse = await axios.post(
      `${integrationKeys.baseUrl}/dynamicQR`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': integrationKeys['X-Merchant-Key'],
          'X-Merchant-Secret': integrationKeys['X-Merchant-Secret']
        },
        timeout: 15000
      }
    );
    
    console.log('✅ Enpay API response received:', enpayResponse.data);
    
    // Check if response contains QR code or payment link
    if (enpayResponse.data && enpayResponse.data.qrCode) {
      console.log('🎯 Enpay QR code generated successfully');
      return enpayResponse.data.qrCode;
    } else if (enpayResponse.data && enpayResponse.data.paymentLink) {
      console.log('🎯 Enpay payment link generated successfully');
      return enpayResponse.data.paymentLink;
    } else {
      throw new Error('Enpay API did not return payment link or QR code');
    }
    
  } catch (error) {
    console.error('❌ Enpay payment link generation failed:', error);
    
    if (error.response) {
      console.error('Enpay API error response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
    // Fallback to generic payment link
    const fallbackLink = `https://pay.skypal.com/process?` + 
      `mid=${encodeURIComponent(merchant.mid)}` +
      `&amount=${amount}` +
      `&currency=INR` +
      `&terminal=${encodeURIComponent(primaryAccount.terminalId || 'N/A')}` +
      `&connector=Enpay` +
      `&method=${encodeURIComponent(paymentMethod)}` +
      `&option=${encodeURIComponent(paymentOption)}` +
      `&txnRefId=TXN${Date.now()}` +
      `&timestamp=${Date.now()}`;
    
    console.log('🔄 Using fallback URL:', fallbackLink);
    return fallbackLink;
  }
};
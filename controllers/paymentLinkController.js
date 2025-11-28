import Transaction from '../models/Transaction.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import User from '../models/User.js';
const ObjectId = mongoose.Types.ObjectId;

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Generate short ID utility
function generateShortId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateTransactionId() {
  return `TRN${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateTxnRefId() {
  return `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateMerchantOrderId() {
  return `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export const generatePaymentLink = async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 generatePaymentLink STARTED');
  
  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;
    
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));

    // Validation
    if (!merchantId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: merchantId, amount'
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 500 || amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 500 and 10,000 INR'
      });
    }

    // Find merchant
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // ✅ CRITICAL FIX: Updated population to get ALL data
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId'); // Remove select to get all fields

    console.log('🔍 Active Account Found:', {
      found: !!activeAccount,
      accountId: activeAccount?._id,
      connectorName: activeAccount?.connectorId?.name,
      connectorAccountName: activeAccount?.connectorAccountId?.name,
      // ✅ Check both locations for integrationKeys
      hasDirectIntegrationKeys: !!activeAccount?.integrationKeys,
      hasConnectorAccountIntegrationKeys: !!activeAccount?.connectorAccountId?.integrationKeys
    });

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active payment connector found'
      });
    }

    const connectorName = activeAccount.connectorId?.name;
    console.log('🎯 Using Connector:', connectorName);

    let paymentResult;


    // ✅ FIXED: SUPPORT BOTH ENPAY AND CASHFREE
    if (connectorName === 'Cashfree') {
      paymentResult = await generateCashfreePayment({
        merchant,
        amount: amountNum,
        paymentMethod, 
        paymentOption,
        connectorAccount: activeAccount.connectorAccountId
      });
    } else if (connectorName === 'Enpay') {
      paymentResult = await generateEnpayPayment({
        merchant,
        amount: amountNum,
        paymentMethod, 
        paymentOption,
        connectorAccount: activeAccount.connectorAccountId
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported connector: ' + connectorName
      });
    }

    // Create transaction record
    const transactionData = {
      transactionId: generateTransactionId(),
      merchantOrderId: paymentResult.merchantOrderId,
      merchantHashId: merchant.mid,
      merchantVpa: `${merchant.mid?.toLowerCase()}@skypal`,
      txnRefId: paymentResult.txnRefId,
      shortLinkId: generateShortId(),
      
      merchantId: merchant._id,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      
      amount: amountNum,
      currency: currency,
      status: 'INITIATED',
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: paymentResult.paymentLink,
      
      connectorId: activeAccount.connectorId?._id,
      connectorAccountId: activeAccount.connectorAccountId?._id,
      connectorName: connectorName,
      terminalId: activeAccount.terminalId || 'N/A',
      
      gatewayTxnId: paymentResult.gatewayTxnId,
      gatewayPaymentLink: paymentResult.paymentLink,
      gatewayOrderId: paymentResult.gatewayOrderId,
      
      customerName: `${merchant.firstname} ${merchant.lastname}`,
      customerVpa: `${merchant.mid?.toLowerCase()}@skypal`,
      customerContact: merchant.contact || '',
      customerEmail: merchant.email || '',
      
      txnNote: `Payment for ${merchant.company || merchant.firstname}`,
      source: connectorName.toLowerCase()
    };

    // Add connector-specific fields
    if (connectorName === 'Cashfree') {
      transactionData.cfOrderId = paymentResult.cfOrderId;
      transactionData.cfPaymentLink = paymentResult.cfPaymentLink;
      transactionData.paymentSessionId = paymentResult.paymentSessionId;
    } else if (connectorName === 'Enpay') {
      transactionData.enpayTxnId = paymentResult.enpayTxnId;
      transactionData.enpayPaymentLink = paymentResult.enpayPaymentLink;
    }

    // Encrypt payment payload for security
    transactionData.encryptedPaymentPayload = encrypt(JSON.stringify({
      amount: amountNum,
      currency: currency,
      merchantId: merchant._id,
      connector: connectorName,
      timestamp: new Date().toISOString()
    }));

    // Save transaction
    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();

    console.log(`✅ ${connectorName} payment link generated in ${Date.now() - startTime}ms`);

    res.json({
      success: true,
      paymentLink: paymentResult.paymentLink,
      transactionRefId: transactionData.transactionId,
      txnRefId: transactionData.txnRefId,
      shortLinkId: transactionData.shortLinkId,
      connector: connectorName,
      terminalId: activeAccount.terminalId || 'N/A',
      merchantName: `${merchant.firstname} ${merchant.lastname}`,
      amount: amountNum,
      currency: currency,
      message: `${connectorName} payment link generated successfully`
    });

  } catch (error) {
    console.error(`❌ Payment link generation failed:`, error);
    
    res.status(500).json({
      success: false,
      message: error.message,
      errorType: 'GENERATION_ERROR'
    });
  }
};

// ✅ FIXED: ENPAY PAYMENT GENERATION
const generateEnpayPayment = async ({ merchant, amount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Enpay Payment...');
    
    // ✅ CRITICAL: Enhanced debugging
    console.log('🔍 CONNECTOR ACCOUNT DEBUG:', {
      accountType: 'MerchantConnectorAccount',
      accountId: connectorAccount?._id,
      hasDirectIntegrationKeys: !!connectorAccount?.integrationKeys,
      hasConnectorAccountIntegrationKeys: !!connectorAccount?.connectorAccountId?.integrationKeys
    });
    
    let integrationKeys = {};
    
    // ✅ CRITICAL FIX: Check BOTH possible locations for integrationKeys
    if (connectorAccount?.integrationKeys) {
      // Case 1: integrationKeys are directly in merchant connector account
      console.log('🔍 Using DIRECT integrationKeys from merchant connector account');
      if (connectorAccount.integrationKeys instanceof Map) {
        integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
      } else if (typeof connectorAccount.integrationKeys === 'object') {
        integrationKeys = { ...connectorAccount.integrationKeys };
      }
    } else if (connectorAccount?.connectorAccountId?.integrationKeys) {
      // Case 2: integrationKeys are in the referenced connector account
      console.log('🔍 Using integrationKeys from connectorAccount reference');
      const connectorAccKeys = connectorAccount.connectorAccountId.integrationKeys;
      if (connectorAccKeys instanceof Map) {
        integrationKeys = Object.fromEntries(connectorAccKeys);
      } else if (typeof connectorAccKeys === 'object') {
        integrationKeys = { ...connectorAccKeys };
      }
    } else {
      console.error('❌ No integrationKeys found in either location!');
      throw new Error('No integration keys found for Enpay connector');
    }

    // ✅ CRITICAL: Log the ACTUAL credentials being used
    console.log('🔍 ACTUAL CREDENTIALS BEING USED:', {
      merchantKey: integrationKeys['X-Merchant-Key'],
      merchantSecret: integrationKeys['X-Merchant-Secret'] ? '***' + integrationKeys['X-Merchant-Secret'].slice(-8) : 'MISSING',
      merchantHashId: integrationKeys['merchantHashId'],
      baseUrl: integrationKeys['baseUrl']
    });

    // Validate Enpay credentials
    const requiredCredentials = ['X-Merchant-Key', 'X-Merchant-Secret', 'merchantHashId'];
    for (const cred of requiredCredentials) {
      if (!integrationKeys[cred]) {
        console.error(`❌ MISSING CREDENTIAL: ${cred}`);
        console.error(`❌ Available keys: ${Object.keys(integrationKeys)}`);
        throw new Error(`Missing required Enpay credential: ${cred}`);
      }
    }

    // Generate unique IDs
    const txnRefId = generateTxnRefId();
    const merchantOrderId = generateMerchantOrderId();
    const enpayTxnId = `ENP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare Enpay API request
    const requestData = {
      amount: amount.toFixed(2),
      merchantHashId: integrationKeys.merchantHashId,
      merchantOrderId: merchantOrderId,
      merchantTxnId: txnRefId,
      merchantVpa: `${merchant.mid?.toLowerCase()}@fino`,
      returnURL: `${API_BASE_URL}/api/payment/return?transactionId=${txnRefId}`,
      successURL: `${API_BASE_URL}/api/payment/success?transactionId=${txnRefId}`,
      txnnNote: `Payment for ${merchant.company || merchant.firstname}`
    };

    console.log('📤 Calling Enpay API with data:', {
      amount: requestData.amount,
      merchantHashId: requestData.merchantHashId,
      merchantOrderId: requestData.merchantOrderId
    });

    // Call Enpay API
    const enpayResponse = await axios.post(
      'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': integrationKeys['X-Merchant-Key'],
          'X-Merchant-Secret': integrationKeys['X-Merchant-Secret'],
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Enpay API response:', enpayResponse.data);

    let paymentLink = '';
    if (enpayResponse.data && enpayResponse.data.details) {
      paymentLink = enpayResponse.data.details;
    } else if (enpayResponse.data && enpayResponse.data.paymentUrl) {
      paymentLink = enpayResponse.data.paymentUrl;
    } else {
      throw new Error('Enpay API did not return payment link');
    }

    return {
      paymentLink: paymentLink,
      merchantOrderId: merchantOrderId,
      txnRefId: txnRefId,
      gatewayTxnId: enpayTxnId,
      enpayTxnId: enpayTxnId,
      enpayPaymentLink: paymentLink
    };

  } catch (error) {
    console.error('❌ Enpay payment generation failed:', error);
    
    if (error.response) {
      console.error('Enpay API error response:', {
        status: error.response.status,
        data: error.response.data
      });
      
      if (error.response.status === 401) {
        throw new Error('Enpay: Invalid Merchant Key/Secret');
      } else if (error.response.status === 400) {
        throw new Error(`Enpay: Bad request - ${error.response.data?.message}`);
      }
    }
    
    throw new Error(`Enpay payment failed: ${error.message}`);
  }
};

// ✅ FIXED: CASHFREE PAYMENT GENERATION
const generateCashfreePayment = async ({ merchant, amount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Cashfree Payment...');
    
    let integrationKeys = {};
    
    // ✅ CRITICAL FIX: Better integration keys extraction
    if (connectorAccount?.integrationKeys) {
      if (connectorAccount.integrationKeys instanceof Map) {
        integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
      } else if (typeof connectorAccount.integrationKeys === 'object') {
        integrationKeys = { ...connectorAccount.integrationKeys };
      } else if (typeof connectorAccount.integrationKeys === 'string') {
        try {
          integrationKeys = JSON.parse(connectorAccount.integrationKeys);
        } catch (e) {
          console.error('❌ Failed to parse integrationKeys string:', e);
        }
      }
    }

    console.log('🔍 Cashfree Integration Keys:', Object.keys(integrationKeys));

    // Extract credentials
    const clientId = integrationKeys['x-client-id'] || integrationKeys['client_id'] || integrationKeys['X-Client-Id'];
    const clientSecret = integrationKeys['x-client-secret'] || integrationKeys['client_secret'] || integrationKeys['X-Client-Secret'];
    const apiVersion = integrationKeys['x-api-version'] || integrationKeys['api_version'] || '2023-08-01';

    console.log('🔐 Cashfree Credentials Extracted:', {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
      clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING',
      apiVersion: apiVersion
    });

    if (!clientId || !clientSecret) {
      throw new Error('Missing Cashfree credentials: Client ID or Secret');
    }

    // ✅ FIXED: ALWAYS USE PRODUCTION FOR LIVE CREDENTIALS
    const cashfreeBaseURL = 'https://api.cashfree.com/pg';
    const paymentsBaseURL = 'https://payments.cashfree.com/order';

    console.log('🎯 Using PRODUCTION Environment:', cashfreeBaseURL);
  const returnUrl = process.env.NODE_ENV === 'production' 
  ? `https://pg-admin-backend.vercel.app/api/payment/cashfree/return`
  : `${API_BASE_URL}/api/payment/cashfree/return`;

const notifyUrl = process.env.NODE_ENV === 'production'
  ? `https://pg-admin-backend.vercel.app/api/payment/cashfree/webhook`
  : `${API_BASE_URL}/api/payment/cashfree/webhook`;
    // Generate order ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const orderId = `order_${timestamp}_${random}`;
    
    const orderAmount = parseFloat(amount);
    if (isNaN(orderAmount) || orderAmount < 1) {
      throw new Error('Invalid amount. Minimum is 1 INR');
    }

    // ✅ FIXED: Simplified payment methods
    const getCashfreePaymentMethods = (method) => {
      const methods = {
        upi: "upi",
        card: "cc,dc", 
        netbanking: "nb",
        wallet: "wallet"
      };
      return methods[method] || "upi";
    };

    const cashfreeMethods = getCashfreePaymentMethods(paymentMethod);

    // ✅ FIXED: Clean order data without extra fields
    const requestData = {
      order_amount: orderAmount.toFixed(2),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: merchant.mid || `cust_${timestamp}`,
        customer_phone: merchant.contact || "9876543210",
        customer_email: merchant.email || "customer@example.com",
        customer_name: `${merchant.firstname} ${merchant.lastname}`.trim() || "Customer"
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
        payment_methods: cashfreeMethods
      }
    };

    console.log('📤 Cashfree API Request:', {
      orderId: orderId,
      amount: orderAmount,
      methods: cashfreeMethods
    });

    // ✅ API CALL
    let response;
    try {
      response = await axios.post(
        `${cashfreeBaseURL}/orders`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId.trim(),
            'x-client-secret': clientSecret.trim(),
            'x-api-version': apiVersion,
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('✅ Cashfree API Response Status:', response.status);

    } catch (apiError) {
      console.error('❌ Cashfree API Call Failed:', apiError.message);
      
      if (apiError.response) {
        console.error('🔍 Cashfree API Error Details:', {
          status: apiError.response.status,
          data: apiError.response.data
        });

        if (apiError.response.status === 401) {
          throw new Error('Cashfree: Invalid credentials - Check Client ID/Secret');
        } else if (apiError.response.status === 403) {
          throw new Error('Cashfree: Account not activated or restricted');
        } else if (apiError.response.data?.message) {
          throw new Error(`Cashfree: ${apiError.response.data.message}`);
        }
      }
      
      throw new Error(`Cashfree API call failed: ${apiError.message}`);
    }

    // ✅ VALIDATE RESPONSE
    if (!response.data) {
      throw new Error('Cashfree API returned empty response');
    }

    if (!response.data.payment_session_id) {
      console.error('❌ No payment_session_id in response:', response.data);
      throw new Error('Cashfree API did not return payment session ID');
    }

    // ✅ FIXED: Generate proper payment link
    const paymentLink = `${paymentsBaseURL}/#${response.data.payment_session_id}`;

    console.log('🎯 Generated Payment Link Successfully');
    console.log('🔑 Payment Session ID:', response.data.payment_session_id.substring(0, 30) + '...');
    console.log('🔗 Full Payment Link:', paymentLink);

    return {
      paymentLink: paymentLink,
      merchantOrderId: orderId,
      txnRefId: `txn_${timestamp}_${random}`,
      gatewayTxnId: response.data.cf_order_id,
      gatewayOrderId: response.data.order_id,
      cfOrderId: response.data.cf_order_id,
      cfPaymentLink: paymentLink,
      paymentSessionId: response.data.payment_session_id,
      environment: 'production'
    };

  } catch (error) {
    console.error('❌ Cashfree payment generation failed:', error);
    
    // Improved error messages
    if (error.message.includes('client session is invalid')) {
      throw new Error('Cashfree: Session expired or invalid. Please try generating a new payment link.');
    } else if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      throw new Error('Cashfree: Invalid Client ID or Secret');
    }
    
    throw new Error(`Cashfree payment failed: ${error.message}`);
  }
};

// Add this route to get transaction by shortLinkId
export const getTransactionByShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    
    console.log('🔍 Fetching transaction for shortLinkId:', shortLinkId);

    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        merchantName: transaction.merchantName,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethod: transaction.paymentMethod,
        connectorName: transaction.connectorName,
        status: transaction.status,
        paymentUrl: transaction.paymentUrl,
        createdAt: transaction.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
      error: error.message
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
        { status: 'SUCCESS', updatedAt: new Date() }
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
        { status: status || 'FAILED', updatedAt: new Date() }
      );
    }

    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=${status || 'failed'}&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Return callback error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error`);
  }
};

export const getMerchantConnectors = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 Fetching connector accounts for merchant:', merchantId);

    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    console.log('🔄 Fetching connector accounts from database...');

    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name connectorType description')
    .populate('connectorAccountId', 'name currency integrationKeys terminalId')
    .select('terminalId industry percentage isPrimary status createdAt')
    .sort({ isPrimary: -1, createdAt: -1 });

    console.log(`✅ Found ${connectorAccounts.length} connector accounts for merchant: ${merchant.firstname} ${merchant.lastname}`);

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



// Add this to your controller
export const validatePaymentSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Quick validation - if session exists and is recent
    const transaction = await Transaction.findOne({ 
      paymentSessionId: sessionId,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // 15 minutes
    });
    
    if (!transaction) {
      return res.json({
        valid: false,
        message: 'Payment session expired or invalid'
      });
    }
    
    res.json({
      valid: true,
      transactionId: transaction.transactionId,
      amount: transaction.amount
    });
    
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
};

// Add this debug function to check environment
export const checkCashfreeEnvironment = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    const merchant = await User.findById(merchantId);
   const activeAccount = await MerchantConnectorAccount.findOne({
  merchantId: new mongoose.Types.ObjectId(merchantId),
  status: 'Active'
})
.populate('connectorId')
.populate({
  path: 'connectorAccountId',
  select: 'name integrationKeys terminalId currency'
})
.lean(); // Add lean() for better performance

console.log('🔍 Active Account Details:', {
  found: !!activeAccount,
  connectorId: activeAccount?.connectorId?._id,
  connectorAccountId: activeAccount?.connectorAccountId?._id,
  connectorName: activeAccount?.connectorId?.name,
  hasIntegrationKeys: !!activeAccount?.connectorAccountId?.integrationKeys
});

if (!activeAccount) {
  return res.status(404).json({
    success: false,
    message: 'No active payment connector found'
  });
}



    const connectorAccount = await ConnectorAccount.findById(activeAccount.connectorAccountId).lean();
if (!connectorAccount) {
  return res.status(404).json({
    success: false,
    message: 'Connector account not found'
  });
}


console.log('🔍 Fresh Connector Account Data:', {
  name: connectorAccount.name,
  integrationKeysType: typeof connectorAccount.integrationKeys,
  integrationKeysCount: connectorAccount.integrationKeys ? Object.keys(connectorAccount.integrationKeys).length : 0
});
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === 'object') {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject['x-client-id'] || keysObject['client_id'];
    
    // Check if credentials are for test or production
    const isTestCredentials = clientId && clientId.startsWith('TEST');
    const isLiveCredentials = clientId && !clientId.startsWith('TEST');

    res.json({
      success: true,
      environment: {
        usingProductionAPI: true,
        credentialsType: isTestCredentials ? 'TEST' : isLiveCredentials ? 'LIVE' : 'UNKNOWN',
        clientId: clientId ? `${clientId.substring(0, 15)}...` : 'Not Found',
        recommendedAction: isTestCredentials ? 
          'Use TEST environment: https://sandbox.cashfree.com' : 
          'Credentials match production environment'
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this debug function
export const debugIntegrationKeys = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 DEBUG: Checking integration keys for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Get active account with proper population
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId')
    .lean();

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    // Get fresh connector account data
    const connectorAccount = await ConnectorAccount.findById(activeAccount.connectorAccountId).lean();

    let integrationKeys = {};
    let keysSource = 'unknown';
    
    if (connectorAccount?.integrationKeys) {
      if (connectorAccount.integrationKeys instanceof Map) {
        integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
        keysSource = 'map';
      } else if (typeof connectorAccount.integrationKeys === 'object') {
        integrationKeys = { ...connectorAccount.integrationKeys };
        keysSource = 'object';
      } else if (typeof connectorAccount.integrationKeys === 'string') {
        try {
          integrationKeys = JSON.parse(connectorAccount.integrationKeys);
          keysSource = 'string_json';
        } catch (e) {
          integrationKeys = { raw_string: connectorAccount.integrationKeys };
          keysSource = 'string_raw';
        }
      }
    }

    const clientId = integrationKeys['x-client-id'] || integrationKeys['client_id'] || integrationKeys['X-Client-Id'];
    const isTest = clientId && clientId.startsWith('TEST');
    const isLive = clientId && !clientId.startsWith('TEST');

    res.json({
      success: true,
      debug: {
        merchant: {
          name: `${merchant.firstname} ${merchant.lastname}`,
          mid: merchant.mid
        },
        connector: {
          name: activeAccount.connectorId?.name,
          account: connectorAccount?.name
        },
        integrationKeys: {
          source: keysSource,
          rawType: typeof connectorAccount?.integrationKeys,
          isMap: connectorAccount?.integrationKeys instanceof Map,
          extractedType: typeof integrationKeys,
          keysCount: Object.keys(integrationKeys).length,
          allKeys: Object.keys(integrationKeys),
          values: integrationKeys
        },
        credentials: {
          clientId: clientId ? `${clientId.substring(0, 15)}...` : 'NOT FOUND',
          clientSecret: integrationKeys['x-client-secret'] ? 'PRESENT' : 'MISSING',
          environment: isTest ? 'SANDBOX' : isLive ? 'PRODUCTION' : 'UNKNOWN',
          isTest: isTest,
          isLive: isLive
        },
        recommendation: isTest ? 
          '⚠️ Using TEST credentials - Switch to LIVE for production' :
          isLive ? 
          '✅ Using LIVE credentials - Transactions should appear in production dashboard' :
          '❓ Cannot determine environment'
      }
    });

  } catch (error) {
    console.error('❌ Integration keys debug error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const testCashfreeConnectionEnhanced = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🧪 Enhanced Cashfree Test for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === 'object') {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject['x-client-id'] || keysObject['client_id'];
    const clientSecret = keysObject['x-client-secret'] || keysObject['client_secret'];
    const apiVersion = keysObject['x-api-version'] || keysObject['api_version'] || '2023-08-01';

    // Determine environment
    const isTestMode = clientId && clientId.startsWith('TEST');
    const cashfreeBaseURL = isTestMode 
      ? 'https://sandbox.cashfree.com/pg' 
      : 'https://api.cashfree.com/pg';

    console.log('🔍 Cashfree Environment Check:', {
      clientId: clientId ? `${clientId.substring(0, 15)}...` : 'MISSING',
      environment: isTestMode ? 'SANDBOX' : 'PRODUCTION',
      baseURL: cashfreeBaseURL
    });

    if (!clientId || !clientSecret) {
      return res.json({
        success: false,
        message: 'Missing Cashfree credentials',
        debug: {
          availableKeys: Object.keys(keysObject),
          integrationKeys: keysObject
        }
      });
    }

    // Test order data
    const testOrderData = {
      order_amount: "1.00",
      order_currency: "INR",
      order_id: `test_${Date.now()}`,
      customer_details: {
        customer_id: "test_customer_001",
        customer_phone: "9876543210",
        customer_email: "testcustomer@example.com",
        customer_name: "Test Customer"
      },
      order_meta: {
        return_url: "https://example.com/return",
        notify_url: "https://example.com/webhook",
        payment_methods: "cc,dc,upi"
      },
      order_note: "Test payment connection"
    };

    console.log('📤 Testing Cashfree API with:', {
      url: `${cashfreeBaseURL}/orders`,
      environment: isTestMode ? 'SANDBOX' : 'PRODUCTION'
    });

    const testResponse = await axios.post(
      `${cashfreeBaseURL}/orders`,
      testOrderData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId.trim(),
          'x-client-secret': clientSecret.trim(),
          'x-api-version': apiVersion
        },
        timeout: 15000
      }
    );

    console.log('✅ Cashfree Test Response:', testResponse.data);

    if (testResponse.data && testResponse.data.payment_session_id) {
      const paymentsBaseURL = isTestMode
        ? 'https://sandbox.cashfree.com/order'
        : 'https://payments.cashfree.com/order';
        
      const paymentLink = `${paymentsBaseURL}/#${testResponse.data.payment_session_id}`;
      
      res.json({
        success: true,
        message: `Cashfree ${isTestMode ? 'Sandbox' : 'Production'} connection successful!`,
        paymentLink: paymentLink,
        environment: isTestMode ? 'sandbox' : 'production',
        orderId: testResponse.data.order_id,
        cfOrderId: testResponse.data.cf_order_id,
        paymentSessionId: testResponse.data.payment_session_id,
        debug: {
          credentialsType: isTestMode ? 'TEST' : 'LIVE',
          baseURLUsed: cashfreeBaseURL
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Cashfree API response missing payment session',
        response: testResponse.data
      });
    }

  } catch (error) {
    console.error('❌ Enhanced Cashfree test failed:', error);
    
    let errorMessage = 'Cashfree connection test failed';
    let errorDetails = {};

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };

      if (error.response.status === 401) {
        errorMessage = 'Invalid Cashfree credentials (Unauthorized) - Check Client ID/Secret';
      } else if (error.response.status === 403) {
        errorMessage = 'Cashfree account not activated or restricted';
      } else if (error.response.status === 400) {
        errorMessage = `Bad request to Cashfree API: ${error.response.data?.message}`;
      } else if (error.response.status === 404) {
        errorMessage = 'Cashfree API endpoint not found - check environment (sandbox vs production)';
      }
    }

    res.json({
      success: false,
      message: errorMessage,
      error: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Cashfree Return URL Handler
// Cashfree Return URL Handler
export const handleCashfreeReturn = async (req, res) => {
  try {
    const { order_id, order_status, payment_status, reference_id } = req.query;
    
    console.log('🔁 Cashfree Return Callback:', {
      order_id,
      order_status, 
      payment_status,
      reference_id
    });

    // Update transaction status
    if (order_id) {
      const transaction = await Transaction.findOne({ 
        $or: [
          { merchantOrderId: order_id },
          { gatewayOrderId: order_id },
          { cfOrderId: order_id }
        ]
      });

      if (transaction) {
        let status = 'PENDING';
        if (order_status === 'PAID') status = 'SUCCESS';
        else if (order_status === 'EXPIRED') status = 'FAILED';

        await Transaction.findOneAndUpdate(
          { _id: transaction._id },
          { 
            status: status,
            updatedAt: new Date(),
            gatewayTxnId: reference_id || transaction.gatewayTxnId
          }
        );

        console.log(`✅ Transaction ${transaction.transactionId} updated to: ${status}`);
      }
    }

    // Use HTTPS for frontend redirect in production
    const frontendBaseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-frontend-domain.com' 
      : FRONTEND_BASE_URL;

    res.redirect(`${frontendBaseUrl}/payment-success?status=${order_status === 'PAID' ? 'success' : 'failed'}&transactionRefId=${order_id || ''}`);
    
  } catch (error) {
    console.error('❌ Cashfree return handler error:', error);
    const frontendBaseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-frontend-domain.com' 
      : FRONTEND_BASE_URL;
    res.redirect(`${frontendBaseUrl}/payment-return?status=error`);
  }
};

// Cashfree Webhook Handler
export const handleCashfreeWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log('📩 Cashfree Webhook Received:', webhookData);

    const { data, type } = webhookData;
    
    if (type === 'TRANSACTION_STATUS' && data) {
      const { orderId, referenceId, txStatus, txMsg, paymentMode, txTime } = data;
      
      let status = 'PENDING';
      if (txStatus === 'SUCCESS') status = 'SUCCESS';
      else if (txStatus === 'FAILED') status = 'FAILED';
      else if (txStatus === 'USER_DROPPED') status = 'CANCELLED';

      // Update transaction in database
      await Transaction.findOneAndUpdate(
        {
          $or: [
            { merchantOrderId: orderId },
            { gatewayOrderId: orderId },
            { cfOrderId: orderId }
          ]
        },
        {
          status: status,
          gatewayTxnId: referenceId,
          paymentMethod: paymentMode,
          updatedAt: new Date(),
          ...(txStatus === 'SUCCESS' && { settledAt: new Date(txTime) })
        }
      );

      console.log(`✅ Webhook: Order ${orderId} updated to ${status}`);
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('❌ Cashfree webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this to your paymentLinkController.js
// Add this debug function to check environment
export const debugCashfreeSetup = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 DEBUG: Checking Cashfree setup for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === 'object') {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject['x-client-id'] || keysObject['client_id'];
    const clientSecret = keysObject['x-client-secret'] || keysObject['client_secret'];
    
    const isTestCredentials = clientId && clientId.startsWith('TEST');
    const isLiveCredentials = clientId && !clientId.startsWith('TEST');

    res.json({
      success: true,
      merchant: {
        id: merchant._id,
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid
      },
      connector: {
        name: activeAccount.connectorId?.name,
        account: connectorAccount?.name,
        terminalId: activeAccount.terminalId
      },
      credentials: {
        clientId: clientId ? `${clientId.substring(0, 15)}...` : 'NOT FOUND',
        clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'NOT FOUND',
        type: isTestCredentials ? 'TEST' : isLiveCredentials ? 'LIVE' : 'UNKNOWN',
        environment: process.env.NODE_ENV || 'development'
      },
      urls: {
        apiBase: process.env.API_BASE_URL,
        frontendBase: process.env.FRONTEND_URL
      },
      recommendation: isTestCredentials ? 
        '⚠️ Switch to LIVE credentials for production' :
        '✅ Using LIVE credentials for production'
    });

  } catch (error) {
    console.error('❌ Cashfree debug setup error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const testCashfreeConnection = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🧪 Testing Cashfree connection for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    // Convert to plain object
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === 'object' && integrationKeys !== null) {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject['x-client-id'] || keysObject['client_id'];
    const clientSecret = keysObject['x-client-secret'] || keysObject['client_secret'];
    const apiVersion = keysObject['x-api-version'] || keysObject['api_version'] || '2023-08-01';

    console.log('🔍 Cashfree Credentials Found:', {
      clientId: clientId ? 'PRESENT' : 'MISSING',
      clientSecret: clientSecret ? 'PRESENT' : 'MISSING',
      apiVersion: apiVersion,
      allKeys: Object.keys(keysObject)
    });

    if (!clientId || !clientSecret) {
      return res.json({
        success: false,
        message: 'Missing Cashfree credentials',
        missing: {
          clientId: !clientId,
          clientSecret: !clientSecret
        },
        availableKeys: Object.keys(keysObject)
      });
    }

    // Test with a simple order creation
    const testOrderData = {
      order_amount: "1.00",
      order_currency: "INR",
      order_id: `test_${Date.now()}`,
      customer_details: {
        customer_id: "test_customer",
        customer_phone: "9999999999",
        customer_email: "test@example.com",
        customer_name: "Test Customer"
      }
    };

    console.log('📤 Testing Cashfree API with data:', testOrderData);

    const testResponse = await axios.post(
      'https://api.cashfree.com/pg/orders',
      testOrderData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId.trim(),
          'x-client-secret': clientSecret.trim(),
          'x-api-version': apiVersion
        },
        timeout: 15000
      }
    );

    console.log('✅ Cashfree Test Response:', testResponse.data);

    if (testResponse.data && testResponse.data.payment_session_id) {
      const paymentLink = `https://payments.cashfree.com/order/#${testResponse.data.payment_session_id}`;
      
      res.json({
        success: true,
        message: 'Cashfree connection test successful!',
        paymentLink: paymentLink,
        orderId: testResponse.data.order_id,
        cfOrderId: testResponse.data.cf_order_id,
        paymentSessionId: testResponse.data.payment_session_id,
        credentials: {
          clientId: `${clientId.substring(0, 10)}...`,
          clientSecret: `${clientSecret.substring(0, 10)}...`,
          apiVersion: apiVersion
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Cashfree API response missing payment session',
        response: testResponse.data
      });
    }

  } catch (error) {
    console.error('❌ Cashfree connection test failed:', error);
    
    let errorMessage = 'Cashfree connection test failed';
    let errorDetails = {};

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };

      if (error.response.status === 401) {
        errorMessage = 'Invalid Cashfree credentials (Unauthorized)';
      } else if (error.response.status === 403) {
        errorMessage = 'Cashfree account not activated or restricted';
      } else if (error.response.status === 400) {
        errorMessage = 'Bad request to Cashfree API';
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Cashfree API timeout';
    } else {
      errorMessage = error.message;
    }

    res.json({
      success: false,
      message: errorMessage,
      error: errorDetails,
      stack: error.stack
    });
  }
};

export const debugCashfreeCredentials = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 Debugging Cashfree credentials for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === 'object' && integrationKeys !== null) {
      keysObject = { ...integrationKeys };
    }

    console.log('🔍 Raw Integration Keys:', integrationKeys);
    console.log('🔍 Processed Keys Object:', keysObject);
    console.log('🔍 Keys Object Type:', typeof keysObject);
    console.log('🔍 Keys Object Keys:', Object.keys(keysObject));

    const clientId = keysObject['x-client-id'] || keysObject['x_client_id'] || keysObject['client_id'];
    const clientSecret = keysObject['x-client-secret'] || keysObject['x_client_secret'] || keysObject['client_secret'];
    const apiVersion = keysObject['x-api-version'] || keysObject['x_api_version'] || keysObject['api_version'];

    res.json({
      success: true,
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
        email: merchant.email
      },
      connector: {
        name: activeAccount.connectorId?.name,
        terminalId: activeAccount.terminalId
      },
      credentials: {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasApiVersion: !!apiVersion,
        clientId: clientId ? `${clientId.substring(0, 10)}...` : 'Not Found',
        clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'Not Found',
        apiVersion: apiVersion || 'Not Found'
      },
      allIntegrationKeys: Object.keys(keysObject),
      integrationKeys: keysObject,
      debug: {
        rawIntegrationKeysType: typeof integrationKeys,
        isMap: integrationKeys instanceof Map,
        connectorAccountId: connectorAccount?._id
      }
    });

  } catch (error) {
    console.error('❌ Cashfree debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Enpay Payment Generation

// Add this to your controller
export const debugCurrentEnpayCredentials = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 DEBUG: Checking current Enpay credentials for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    console.log('🔍 CURRENT CREDENTIALS IN DATABASE:', integrationKeys);

    res.json({
      success: true,
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid
      },
      connector: {
        name: activeAccount.connectorId?.name,
        terminalId: activeAccount.terminalId
      },
      credentials: {
        merchantKey: integrationKeys['X-Merchant-Key'],
        merchantSecret: integrationKeys['X-Merchant-Secret'] ? '***' + integrationKeys['X-Merchant-Secret'].slice(-4) : 'MISSING',
        merchantHashId: integrationKeys['merchantHashId'],
        baseUrl: integrationKeys['baseUrl']
      },
      matchWithCorrect: {
        merchantKey: integrationKeys['X-Merchant-Key'] === '0851439b-03df-4983-88d6-32399b1e4514',
        merchantHashId: integrationKeys['merchantHashId'] === 'MERCDSH51Y7CD4YJLFIZR8NF'
      }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Test endpoint
export const testEnpayConnection = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🧪 Testing Enpay connection for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    // Test with minimal data
    const testData = {
      amount: "100.00",
      merchantHashId: integrationKeys.merchantHashId,
      merchantOrderId: `TEST${Date.now()}`,
      merchantTxnId: `TXNTEST${Date.now()}`,
      merchantVpa: "test@fino",
      returnURL: "https://example.com/return",
      successURL: "https://example.com/success",
      txnnNote: "Test payment"
    };

    console.log('📤 Testing with credentials:', {
      merchantKey: integrationKeys['X-Merchant-Key'] ? 'PRESENT' : 'MISSING',
      merchantSecret: integrationKeys['X-Merchant-Secret'] ? 'PRESENT' : 'MISSING',
      merchantHashId: integrationKeys.merchantHashId
    });

    const enpayResponse = await axios.post(
      'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': integrationKeys['X-Merchant-Key'],
          'X-Merchant-Secret': integrationKeys['X-Merchant-Secret'],
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Enpay API Success:', enpayResponse.data);

    res.json({
      success: true,
      message: 'Enpay connection test successful!',
      paymentLink: enpayResponse.data.details || enpayResponse.data.paymentUrl,
      debug: {
        credentialsUsed: {
          merchantKey: integrationKeys['X-Merchant-Key'] ? `${integrationKeys['X-Merchant-Key'].substring(0, 10)}...` : 'MISSING',
          merchantHashId: integrationKeys.merchantHashId
        }
      }
    });

  } catch (error) {
    console.error('❌ Enpay connection test failed:', error);
    
    let errorMessage = 'Enpay connection test failed';
    let errorDetails = {};

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        data: error.response.data
      };

      if (error.response.status === 401) {
        errorMessage = 'Invalid Enpay credentials (Unauthorized) - Check Merchant Key/Secret';
      } else if (error.response.status === 400) {
        errorMessage = `Bad request to Enpay API: ${error.response.data?.message}`;
      }
    }

    res.json({
      success: false,
      message: errorMessage,
      error: errorDetails
    });
  }
};

export const testEnpayDirect = async (req, res) => {
  try {
    console.log('🧪 TEST: Enhanced Direct Enpay Connection');
    
    const connectorAccount = await ConnectorAccount.findOne({ name: 'enpay' });
    if (!connectorAccount) {
      return res.json({
        success: false,
        message: 'Enpay connector account not found'
      });
    }

    const integrationKeys = connectorAccount.integrationKeys || {};
    
    console.log('🔐 Credentials Check:', {
      hasMerchantKey: !!integrationKeys['X-Merchant-Key'],
      hasMerchantSecret: !!integrationKeys['X-Merchant-Secret'], 
      hasMerchantHashId: !!integrationKeys['merchantHashId'],
      merchantKeyLength: integrationKeys['X-Merchant-Key']?.length,
      merchantSecretLength: integrationKeys['X-Merchant-Secret']?.length
    });

    // Test data
    const testData = {
      amount: "1000.00",
      merchantHashId: integrationKeys.merchantHashId,
      merchantOrderId: `TEST${Date.now()}`,
      merchantTxnId: `TXNTEST${Date.now()}`,
      merchantVpa: "test@fino",
      returnURL: "https://example.com/return",
      successURL: "https://example.com/success", 
      txnnNote: "Test payment"
    };

    console.log('📤 Calling Enpay API with headers:', {
      'X-Merchant-Key': integrationKeys['X-Merchant-Key'] ? 'PRESENT' : 'MISSING',
      'X-Merchant-Secret': integrationKeys['X-Merchant-Secret'] ? 'PRESENT' : 'MISSING'
    });

    const enpayResponse = await axios.post(
      'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': integrationKeys['X-Merchant-Key'],
          'X-Merchant-Secret': integrationKeys['X-Merchant-Secret'],
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Enpay API Success:', enpayResponse.data);

    res.json({
      success: true,
      message: 'Direct Enpay test successful!',
      paymentLink: enpayResponse.data.details || enpayResponse.data.paymentUrl,
      debug: {
        credentialsValid: true,
        headersSent: true
      }
    });

  } catch (error) {
    console.error('❌ Enhanced Test failed:', error);
    
    let errorDetails = {
      message: error.message
    };
    
    if (error.response) {
      errorDetails = {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      };
      console.error('🔍 Full error response:', errorDetails);
    }
    
    res.json({
      success: false,
      error: 'Enpay API call failed',
      details: errorDetails
    });
  }
};

// Process Short Link
export const processShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    console.log('🔄 Process route called for shortLinkId:', shortLinkId);

    // Find transaction
    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });
    
    if (!transaction) {
      return res.status(404).send(`
        <html>
          <head><title>Payment Link Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #dc3545;">Payment Link Not Found</h2>
            <p>This payment link may have expired or is invalid.</p>
          </body>
        </html>
      `);
    }

    // ✅ CHECK IF SESSION IS RECENT (less than 15 minutes)
    const sessionAge = Date.now() - new Date(transaction.createdAt).getTime();
    const maxSessionAge = 15 * 60 * 1000; // 15 minutes
    
    if (sessionAge > maxSessionAge) {
      return res.status(410).send(`
        <html>
          <head><title>Payment Link Expired</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #dc3545;">Payment Link Expired</h2>
            <p>This payment link has expired. Please generate a new one.</p>
            <p>Session created: ${new Date(transaction.createdAt).toLocaleString()}</p>
          </body>
        </html>
      `);
    }

    console.log('✅ Transaction found, redirecting to:', transaction.paymentUrl);

    // Update status and redirect
    await Transaction.findOneAndUpdate(
      { shortLinkId: shortLinkId },
      { 
        status: 'REDIRECTED', 
        redirectedAt: new Date()
      }
    );

    // ✅ IMMEDIATE REDIRECT
    res.redirect(302, transaction.paymentUrl);

  } catch (error) {
    console.error('🔥 ERROR in process route:', error);
    res.status(500).send(`
      <html>
        <head><title>Payment Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #dc3545;">Payment Processing Error</h2>
          <p>An error occurred while processing your payment.</p>
        </body>
      </html>
    `);
  }
};

// Debug function for connector accounts
export const debugConnectorAccount = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 DEBUG: Checking connector account for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    console.log('✅ Merchant found:', merchant.firstname, merchant.lastname);

    // Check connector accounts
    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId');

    console.log(`🔍 Found ${connectorAccounts.length} connector accounts`);

    const detailedAccounts = [];
    for (const account of connectorAccounts) {
      let connectorAccountDetails = null;
      
      if (!account.connectorAccountId && account.connectorAccountId) {
        connectorAccountDetails = await ConnectorAccount.findById(account.connectorAccountId);
      } else {
        connectorAccountDetails = account.connectorAccountId;
      }

      const accountInfo = {
        _id: account._id,
        connectorId: account.connectorId?._id,
        connectorName: account.connectorId?.name,
        connectorAccountId: account.connectorAccountId?._id,
        connectorAccountName: connectorAccountDetails?.name || 'Not Found',
        terminalId: account.terminalId,
        status: account.status,
        isPrimary: account.isPrimary,
        hasConnectorAccount: !!connectorAccountDetails,
        hasIntegrationKeys: connectorAccountDetails?.integrationKeys ? true : false,
        integrationKeys: connectorAccountDetails?.integrationKeys || {}
      };

      detailedAccounts.push(accountInfo);
      
      console.log(`🔍 Account Details:`, accountInfo);
    }

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid
      },
      connectorAccounts: detailedAccounts,
      totalAccounts: connectorAccounts.length
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Debug function for Enpay credentials
export const debugEnpayCredentials = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 Debugging Enpay credentials for merchant:', merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name')
    .populate('connectorAccountId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    res.json({
      success: true,
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
        email: merchant.email
      },
      connector: {
        name: activeAccount.connectorId?.name,
        terminalId: activeAccount.terminalId
      },
      credentials: {
        hasMerchantKey: !!integrationKeys['X-Merchant-Key'],
        hasMerchantSecret: !!integrationKeys['X-Merchant-Secret'],
        hasMerchantHashId: !!integrationKeys['merchantHashId'],
        merchantHashId: integrationKeys['merchantHashId'],
        baseUrl: integrationKeys['baseUrl']
      },
      integrationKeys: integrationKeys
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Existing functions
export const getMerchants = async (req, res) => {
  try {
    console.log('🔍 Fetching merchants from database...');
    
    const merchants = await User.find({ role: 'merchant' })
      .select('_id firstname lastname company email mid status contact balance unsettleBalance createdAt')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${merchants.length} merchants from database`);

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


export const getPaymentMethods = async (req, res) => {
  try {
    console.log('🔍 Fetching payment methods...');
    
    const methods = [
      { id: "upi", name: "UPI" },
      { id: "card", name: "Credit/Debit Card" },
      { id: "netbanking", name: "Net Banking" },
      { id: "wallet", name: "Wallet" }
    ];

    console.log('✅ Payment methods:', methods);

    res.json({
      success: true,
      methods: methods
    });
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: error.message
    });
  }
};
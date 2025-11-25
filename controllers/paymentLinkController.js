// controllers/paymentLinkController.js
import Transaction from '../models/Transaction.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import User from '../models/User.js';
const ObjectId = mongoose.Types.ObjectId; // ✅ हे line add करा


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


// controllers/paymentLinkController.js
export const generatePaymentLink = async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 generatePaymentLink STARTED');
  
  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;
    
    console.log('📦 Request Body:', req.body);

    // Validation
    if (!merchantId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: merchantId, amount, paymentMethod'
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

    // Find active connector account
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: 'Active'
    })
    .populate('connectorId', 'name className connectorType')
    .populate('connectorAccountId', 'name currency integrationKeys terminalId');

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: 'No active connector account found'
      });
    }

    const connectorName = activeAccount.connectorId?.name;
    console.log('🎯 Selected Connector:', connectorName);

    let paymentResult;

    // Generate payment link based on connector type
    if (connectorName === 'Enpay') {
      paymentResult = await generateEnpayPayment({
        merchant,
        amount,
        paymentMethod,
        paymentOption,
        connectorAccount: activeAccount.connectorAccountId
      });
    } else if (connectorName === 'Cashfree') {
      paymentResult = await generateCashfreePayment({
        merchant,
        amount,
        paymentMethod, 
        paymentOption,
        connectorAccount: activeAccount.connectorAccountId
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported connector type'
      });
    }

    // Create transaction record
    const transactionData = {
      // Core identifiers
      transactionId: generateTransactionId(),
      merchantOrderId: paymentResult.merchantOrderId,
      merchantHashId: merchant.mid,
      merchantVpa: `${merchant.mid?.toLowerCase()}@skypal`,
      txnRefId: paymentResult.txnRefId,
      shortLinkId: generateShortId(),
      
      // Merchant information
      merchantId: merchant._id,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      mid: merchant.mid,
      
      // Payment details
      amount: amount,
      currency: currency,
      status: 'INITIATED',
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: paymentResult.paymentLink,
      
      // Connector information
      connectorId: activeAccount.connectorId?._id,
      connectorAccountId: activeAccount.connectorAccountId?._id,
      connectorName: connectorName,
      connectorUsed: connectorName, // यामध्ये connector चे नाम save करा
      terminalId: activeAccount.terminalId || 'N/A',
      
      // Gateway specific fields
      gatewayTxnId: paymentResult.gatewayTxnId || '',
      gatewayPaymentLink: paymentResult.paymentLink,
      gatewayOrderId: paymentResult.gatewayOrderId || '',
      
      // Cashfree specific
      cfOrderId: paymentResult.cfOrderId || '',
      cfPaymentLink: paymentResult.cfPaymentLink || '',
      
      // Enpay specific
      enpayTxnId: paymentResult.enpayTxnId || '',
      enpayPaymentLink: paymentResult.enpayPaymentLink || '',
      
      // Customer information
      customerName: `${merchant.firstname} ${merchant.lastname}`,
      customerVpa: `${merchant.mid?.toLowerCase()}@skypal`,
      customerContact: merchant.contact || '',
      customerEmail: merchant.email || '',
      
      // Additional fields
      txnNote: `Payment for ${merchant.company || merchant.firstname}`,
      source: connectorName.toLowerCase()
    };

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
      amount: amount,
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

// Cashfree Payment Generation
// controllers/paymentLinkController.js - Update the Cashfree function
// controllers/paymentLinkController.js - Fix the main Cashfree function
// controllers/paymentLinkController.js - Enhanced Cashfree function
const generateCashfreePayment = async ({ merchant, amount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Cashfree Payment...');
    
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    // Convert integrationKeys to plain object
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === 'object' && integrationKeys !== null) {
      keysObject = { ...integrationKeys };
    }

    console.log('🔍 Available Integration Keys:', Object.keys(keysObject));

    // Validate Cashfree credentials
    let clientId = keysObject['x-client-id'];
    let clientSecret = keysObject['x-client-secret'];
    let apiVersion = keysObject['x-api-version'] || '2023-08-01';

    console.log('🔐 Extracted Credentials:', {
      clientId: clientId ? 'PRESENT' : 'MISSING',
      clientSecret: clientSecret ? 'PRESENT' : 'MISSING',
      apiVersion: apiVersion
    });

    if (!clientId || !clientSecret) {
      throw new Error(`Missing required Cashfree credentials. Found keys: ${Object.keys(keysObject).join(', ')}`);
    }

    // Generate unique IDs
    const txnRefId = generateTxnRefId();
    const merchantOrderId = `order_${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const cfOrderId = `CF${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare Cashfree API request - FIXED structure
    const requestData = {
      order_amount: parseFloat(amount).toFixed(2),
      order_currency: "INR",
      order_id: merchantOrderId,
      customer_details: {
        customer_id: merchant.mid,
        customer_phone: merchant.contact || "9999999999",
        customer_email: merchant.email || "customer@example.com"
      }
    };

    console.log('📤 Calling Cashfree API with data:', JSON.stringify(requestData, null, 2));
    console.log('🔑 Using API Endpoint: https://api.cashfree.com/pg/orders');

    // Call Cashfree Orders API with enhanced error handling
    let cashfreeResponse;
    try {
      cashfreeResponse = await axios.post(
        'https://api.cashfree.com/pg/orders',
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
            'x-client-secret': clientSecret,
            'x-api-version': apiVersion,
            'Accept': 'application/json'
          },
          timeout: 30000,
          validateStatus: function (status) {
            return status < 500; // Resolve only if status code is less than 500
          }
        }
      );
    } catch (axiosError) {
      console.error('❌ Axios Error:', axiosError.message);
      if (axiosError.response) {
        console.error('Cashfree API Error Response:', {
          status: axiosError.response.status,
          data: axiosError.response.data,
          headers: axiosError.response.headers
        });
      }
      throw new Error(`Cashfree API call failed: ${axiosError.message}`);
    }

    console.log('✅ Cashfree API Response Status:', cashfreeResponse.status);
    console.log('✅ Cashfree API Response Data:', cashfreeResponse.data);

    // Check if response is successful
    if (cashfreeResponse.status !== 200 && cashfreeResponse.status !== 201) {
      throw new Error(`Cashfree API returned status ${cashfreeResponse.status}: ${JSON.stringify(cashfreeResponse.data)}`);
    }

    if (!cashfreeResponse.data) {
      throw new Error('Cashfree API returned empty response');
    }

    // Check for different possible response structures
    let paymentSessionId = cashfreeResponse.data.payment_session_id;
    let orderId = cashfreeResponse.data.order_id;
    let cfOrderIdFromResponse = cashfreeResponse.data.cf_order_id;

    if (!paymentSessionId) {
      console.warn('⚠️ No payment_session_id in response, checking alternative fields:', cashfreeResponse.data);
      // Try alternative field names
      paymentSessionId = cashfreeResponse.data.session_id || cashfreeResponse.data.payment_session_id;
    }

    if (!paymentSessionId) {
      throw new Error('Cashfree API did not return payment session ID. Response: ' + JSON.stringify(cashfreeResponse.data));
    }

    // Construct payment link - FIXED URL format
    const paymentLink = `https://payments.cashfree.com/order/#${paymentSessionId}`;

    console.log('🎯 Generated Payment Link:', paymentLink);

    return {
      paymentLink: paymentLink,
      merchantOrderId: merchantOrderId,
      txnRefId: txnRefId,
      gatewayTxnId: cfOrderId,
      gatewayOrderId: orderId,
      cfOrderId: cfOrderIdFromResponse || orderId,
      cfPaymentLink: paymentLink,
      paymentSessionId: paymentSessionId,
      apiResponse: cashfreeResponse.data
    };

  } catch (error) {
    console.error('❌ Cashfree payment generation failed:', error);
    
    // Enhanced error logging
    if (error.response) {
      console.error('🔍 Detailed Cashfree API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
        config: {
          url: error.response.config?.url,
          method: error.response.config?.method,
          headers: error.response.config?.headers
        }
      });
    }
    
    throw new Error(`Cashfree payment failed: ${error.message}`);
  }
};

// Add this debug function to your controller
// controllers/paymentLinkController.js - Fix the debug function
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
    
    // FIX: Properly access integrationKeys from Mongoose document
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    // Convert to plain JavaScript object if it's a Mongoose Map
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

    // Check for different possible key names
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

// Enpay Payment Generation (तुमचा existing code)
const generateEnpayPayment = async ({ merchant, amount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Enpay Payment...');
    
    const integrationKeys = connectorAccount?.integrationKeys || {};
    
    // Validate Enpay credentials
    const requiredCredentials = ['X-Merchant-Key', 'X-Merchant-Secret', 'merchantHashId'];
    for (const cred of requiredCredentials) {
      if (!integrationKeys[cred]) {
        throw new Error(`Missing required Enpay credential: ${cred}`);
      }
    }

    // Generate unique IDs
    const txnRefId = generateTxnRefId();
    const merchantOrderId = generateMerchantOrderId();
    const enpayTxnId = `ENP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare Enpay API request
    const requestData = {
      amount: parseFloat(amount).toFixed(2),
      merchantHashId: integrationKeys.merchantHashId,
      merchantOrderId: merchantOrderId,
      merchantTxnId: txnRefId,
      merchantVpa: `${merchant.mid?.toLowerCase()}@fino`,
      returnURL: `${API_BASE_URL}/api/payment/return?transactionId=${txnRefId}`,
      successURL: `${API_BASE_URL}/api/payment/success?transactionId=${txnRefId}`,
      txnnNote: `Payment for ${merchant.company || merchant.firstname}`
    };

    console.log('📤 Calling Enpay API...');

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
      console.error('Enpay API error:', error.response.data);
    }
    
    throw new Error(`Enpay payment failed: ${error.message}`);
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
    
    // ✅ ENHANCED VALIDATION
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


const processPaymentLinkGeneration = async ({ merchantId, amount, currency, paymentMethod, paymentOption }) => {
  console.log('🔍 Step 1: Finding merchant and active connector account');
  
  // Find merchant
  const merchant = await User.findById(merchantId)
    .select('firstname lastname company mid email contact')
    .maxTimeMS(10000);

  if (!merchant) {
    throw new Error('Merchant not found');
  }

  console.log('✅ Merchant found:', `${merchant.firstname} ${merchant.lastname}`, 'MID:', merchant.mid);

  // Find active connector account with better error handling
  const activeAccount = await MerchantConnectorAccount.findOne({
    merchantId: merchantId,
    status: 'Active'
  })
  .populate('connectorId', 'name className connectorType')
  .populate('connectorAccountId', 'name currency integrationKeys terminalId')
  .maxTimeMS(10000);

  if (!activeAccount) {
    throw new Error('No active connector account found for this merchant');
  }

  console.log('✅ Active connector account found:', {
    _id: activeAccount._id,
    connectorName: activeAccount.connectorId?.name,
    connectorId: activeAccount.connectorId?._id,
    connectorAccountId: activeAccount.connectorAccountId?._id,
    terminalId: activeAccount.terminalId
  });

  // Better handling for connector account population
  let connectorAccount = activeAccount.connectorAccountId;

  // If connectorAccount is not populated, fetch it separately
  if (!connectorAccount) {
    console.log('🔄 Connector account not populated, fetching separately...');
    
    if (!activeAccount.connectorAccountId) {
      throw new Error('Connector account ID not found in merchant connector account');
    }
    
    connectorAccount = await ConnectorAccount.findById(activeAccount.connectorAccountId)
      .select('name currency integrationKeys terminalId')
      .maxTimeMS(10000);
      
    if (!connectorAccount) {
      throw new Error('Connector account not found with ID: ' + activeAccount.connectorAccountId);
    }
    
    console.log('✅ Connector account fetched separately:', connectorAccount.name);
  }

  const connectorName = activeAccount.connectorId?.name;

  console.log('🔍 Connector Account Details:', {
    name: connectorAccount.name,
    currency: connectorAccount.currency,
    terminalId: connectorAccount.terminalId || activeAccount.terminalId,
    hasIntegrationKeys: !!connectorAccount.integrationKeys,
    integrationKeys: connectorAccount.integrationKeys ? Object.keys(connectorAccount.integrationKeys) : 'None'
  });

  // Check if integration keys exist
  if (!connectorAccount.integrationKeys || Object.keys(connectorAccount.integrationKeys).length === 0) {
    console.error('❌ No integration keys found in connector account');
    throw new Error('Connector account integration keys not found');
  }

  console.log('🔗 Step 2: Generating payment link based on connector type');
  
  let paymentLink;
  let enpayData = null;

  // Generate payment link based on connector type
  if (connectorName === 'Enpay') {
    console.log('🎯 Using Enpay connector for payment link generation');
    const enpayResult = await generateEnpayCollectRequest({
      merchant,
      amount,
      primaryAccount: activeAccount,
      paymentMethod,
      paymentOption,
      connectorAccount
    });
    
    paymentLink = enpayResult.paymentLink;
    enpayData = enpayResult.enpayData;
    console.log('✅ Enpay payment link generated:', paymentLink);
  } else {
    paymentLink = await generateGenericPaymentLink({
      merchant,
      amount,
      primaryAccount: activeAccount,
      paymentMethod,
      paymentOption
    });
    console.log('✅ Generic payment link generated');
  }

  console.log('💾 Step 3: Creating transaction record');
  
  // Generate all required IDs
  const transactionId = generateTransactionId();
  const txnRefId = generateTxnRefId();
  const merchantOrderId = generateMerchantOrderId();
  const merchantHashId = connectorAccount?.integrationKeys?.merchantHashId || merchant.mid;
  const merchantVpa = `${merchant.mid?.toLowerCase() || 'merchant'}@skypal`;
  const shortLinkId = generateShortId();

  console.log('📝 Generated IDs:', {
    transactionId,
    txnRefId,
    merchantOrderId,
    shortLinkId
  });

  // Create transaction data
  const transactionData = {
    // Core identifiers
    transactionId,
    merchantOrderId,
    merchantHashId,
    merchantVpa,
    txnRefId,
    shortLinkId,
    
    // Merchant information
    merchantId: merchant._id,
    merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
    mid: merchant.mid,
    
    // Payment details
    amount,
    currency,
    status: 'INITIATED',
    paymentMethod,
    paymentOption,
    paymentUrl: paymentLink,
    
    // Connector information
    connectorId: activeAccount.connectorId?._id,
    connectorAccountId: connectorAccount._id,
    connectorName: connectorName || 'Unknown',
    terminalId: activeAccount.terminalId || connectorAccount.terminalId || 'N/A',
    
    // Customer information
    customerName: `${merchant.firstname} ${merchant.lastname}`,
    customerVpa: merchantVpa,
    customerContact: merchant.contact || '',
    customerEmail: merchant.email || '',
    
    // Additional fields
    txnNote: `Payment for ${merchant.company || merchant.firstname}`,
    source: connectorName?.toLowerCase() || 'enpay',
    
    // Enpay specific fields
    enpayTxnId: enpayData?.txnId || '',
    enpayPaymentLink: paymentLink || ''
  };

  console.log('💾 Saving transaction to database...');
  
  try {
    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();
    console.log('✅ Transaction saved successfully');
  } catch (saveError) {
    console.error('❌ Transaction save error:', saveError);
    if (saveError.errors) {
      console.error('Validation errors:', saveError.errors);
    }
    throw new Error(`Failed to save transaction: ${saveError.message}`);
  }

  // Return the actual Enpay payment link for frontend
  return {
    paymentLink: paymentLink,
    transactionRefId: transactionId,
    txnRefId: txnRefId,
    shortLinkId: shortLinkId,
    connector: connectorName || 'Unknown',
    terminalId: activeAccount.terminalId || 'N/A',
    merchantName: `${merchant.firstname} ${merchant.lastname}`,
    amount: amount,
    currency: currency,
    message: 'Payment link generated successfully'
  };
};

// Enpay Collect Request API
const generateEnpayCollectRequest = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Enpay Collect Request...');
    
    const integrationKeys = connectorAccount?.integrationKeys || {};
    const terminalId = primaryAccount.terminalId || connectorAccount.terminalId;
    
    // Validate required Enpay credentials
    const requiredCredentials = ['X-Merchant-Key', 'X-Merchant-Secret', 'merchantHashId'];
    for (const cred of requiredCredentials) {
      if (!integrationKeys[cred]) {
        throw new Error(`Missing required Enpay credential: ${cred}`);
      }
    }

    console.log('✅ Enpay credentials validated:', {
      hasMerchantKey: !!integrationKeys['X-Merchant-Key'],
      hasMerchantSecret: !!integrationKeys['X-Merchant-Secret'],
      hasMerchantHashId: !!integrationKeys['merchantHashId'],
      merchantHashId: integrationKeys['merchantHashId']
    });

    // Generate unique transaction references
    const txnRefId = generateTxnRefId();
    const merchantOrderId = generateMerchantOrderId();
    const enpayTxnId = `ENP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    console.log('📦 Enpay transaction details:', {
      merchantHashId: integrationKeys.merchantHashId,
      amount,
      merchantOrderId,
      txnRefId,
      terminalId
    });

    // Prepare request data for Enpay Collect Request API
    const requestData = {
      amount: amount.toFixed(2),
      merchantHashId: integrationKeys.merchantHashId,
      merchantOrderId: merchantOrderId,
      merchantTxnId: txnRefId,
      merchantVpa: `${merchant.mid?.toLowerCase() || 'merchant'}@fino`,
      returnURL: `${API_BASE_URL}/api/payment/return?transactionId=${txnRefId}`,
      successURL: `${API_BASE_URL}/api/payment/success?transactionId=${txnRefId}`,
      txnnNote: `Payment for ${merchant.company || merchant.firstname} - Order ${merchantOrderId}`
    };

    console.log('📤 Sending Collect Request to Enpay API:', requestData);

    // Enpay API endpoint
    const enpayApiUrl = 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest';

    // Call Enpay API to initiate collect request
    const enpayResponse = await axios.post(
      enpayApiUrl,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Key': integrationKeys['X-Merchant-Key'],
          'X-Merchant-Secret': integrationKeys['X-Merchant-Secret'],
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Enpay API response received:', enpayResponse.data);
    
    let paymentLink = '';

    // Handle Enpay API response
    if (enpayResponse.data && enpayResponse.data.details) {
      paymentLink = enpayResponse.data.details;
      console.log('🎯 Enpay payment link generated successfully:', paymentLink);
    } else if (enpayResponse.data && enpayResponse.data.paymentUrl) {
      paymentLink = enpayResponse.data.paymentUrl;
      console.log('🎯 Enpay payment URL generated successfully');
    } else {
      console.warn('⚠️ Enpay API response structure unexpected:', enpayResponse.data);
      throw new Error('Enpay API did not return payment link in expected format');
    }
    
    return {
      paymentLink,
      enpayData: {
        txnId: enpayTxnId,
        paymentLink,
        apiResponse: enpayResponse.data,
        requestData: requestData
      }
    };
    
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
    const fallbackLink = await generateGenericPaymentLink({
      merchant,
      amount,
      primaryAccount,
      paymentMethod,
      paymentOption
    });
    
    console.log('🔄 Using fallback URL due to Enpay API failure');
    
    return {
      paymentLink: fallbackLink,
      enpayData: null
    };
  }
};

// Generic Payment Link Generation
const generateGenericPaymentLink = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption }) => {
  try {
    console.log('🔗 Generating Generic Payment Link...');
    
    const terminalId = primaryAccount.terminalId || 'N/A';
    const connectorName = primaryAccount.connectorId?.name || 'Unknown';
    const merchantName = merchant.company || `${merchant.firstname} ${merchant.lastname}`;
    const merchantMID = merchant.mid;
    
    console.log('📦 Payment Details:', { 
      merchant: merchantName, 
      terminalId, 
      connector: connectorName, 
      amount 
    });

    // Generate generic payment link
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
    console.log('🔄 Using ultimate fallback URL:', fallbackUrl);
    return fallbackUrl;
  }
};

// Process Short Link
export const processShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    console.log('🔄 Process route called for shortLinkId:', shortLinkId);

    // Find transaction by short link ID
    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });
    
    if (!transaction) {
      console.error('❌ Transaction not found in database');
      return res.status(404).send(`
        <html>
          <head><title>Payment Link Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #dc3545;">Payment Link Not Found</h2>
            <p>Short Link ID: <strong>${shortLinkId}</strong></p>
            <p>This payment link may have expired or is invalid.</p>
            <p><a href="/" style="color: #007bff;">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    console.log('✅ Transaction found:', transaction.transactionId);
    console.log('🔗 Payment URL:', transaction.paymentUrl);

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { shortLinkId: shortLinkId },
      { 
        status: 'REDIRECTED', 
        redirectedAt: new Date(),
        updatedAt: new Date()
      }
    );

    // Direct redirect to Enpay payment page
    if (transaction.paymentUrl && transaction.paymentUrl.includes('http')) {
      console.log('➡️ Redirecting to Enpay payment page:', transaction.paymentUrl);
      return res.redirect(302, transaction.paymentUrl);
    } else {
      throw new Error('No valid payment URL found');
    }

  } catch (error) {
    console.error('🔥 ERROR in process route:', error);
    res.status(500).send(`
      <html>
        <head><title>Payment Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #dc3545;">Payment Processing Error</h2>
          <p>An error occurred while processing your payment.</p>
          <p>Error: ${error.message}</p>
          <p><a href="/" style="color: #007bff;">Return to Home</a></p>
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

    // Enhanced debugging
    const detailedAccounts = [];
    for (const account of connectorAccounts) {
      let connectorAccountDetails = null;
      
      // If connectorAccountId is not populated, fetch it separately
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

// Add this to your PaymentLinkPage component

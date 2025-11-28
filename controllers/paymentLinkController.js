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

// controllers/paymentLinkController.js - CRITICAL FIX
// controllers/paymentLinkController.js - CRITICAL FIX
export const generatePaymentLink = async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 generatePaymentLink STARTED');
  
  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;
    
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));

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
    console.log('✅ Merchant found:', merchant.firstname, merchant.lastname);

    // ✅ CRITICAL FIX: Remove .lean() and fix population
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'Active'
    })
    .populate('connectorId')
    .populate('connectorAccountId'); // ✅ .lean() REMOVE करा

    console.log('🔍 Active Account Debug:', {
      found: !!activeAccount,
      merchantId: merchantId,
      connectorId: activeAccount?.connectorId?._id,
      connectorName: activeAccount?.connectorId?.name,
      connectorAccountId: activeAccount?.connectorAccountId?._id,
      connectorAccountName: activeAccount?.connectorAccountId?.name,
      hasIntegrationKeys: !!activeAccount?.connectorAccountId?.integrationKeys
    });

    if (!activeAccount) {
      console.error('❌ No active connector account found for merchant:', merchantId);
      return res.status(404).json({
        success: false,
        message: 'No active payment connector found for this merchant'
      });
    }

    const connectorName = activeAccount.connectorId?.name;
    console.log('🎯 Selected Connector:', connectorName);

    let paymentResult;

    // Generate payment link based on connector type
    if (connectorName === 'Enpay') {
      console.log('🔗 Using Enpay connector');
      paymentResult = await generateEnpayPayment({
        merchant,
        amount,
        paymentMethod,
        paymentOption,
        connectorAccount: activeAccount.connectorAccountId
      });
    } else if (connectorName === 'Cashfree') {
      console.log('🔗 Using Cashfree connector');
      paymentResult = await generateCashfreePayment({
        merchant,
        amount,
        paymentMethod, 
        paymentOption,
        connectorAccount: activeAccount.connectorAccountId // ✅ Directly pass the populated account
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported connector type: ' + connectorName
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
      
      amount: amount,
      currency: currency,
      status: 'INITIATED',
      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: paymentResult.paymentLink,
      
      connectorId: activeAccount.connectorId?._id,
      connectorAccountId: activeAccount.connectorAccountId?._id,
      connectorName: connectorName,
      terminalId: activeAccount.terminalId || 'N/A',
      
      gatewayTxnId: paymentResult.gatewayTxnId || '',
      gatewayPaymentLink: paymentResult.paymentLink,
      gatewayOrderId: paymentResult.gatewayOrderId || '',
      
      cfOrderId: paymentResult.cfOrderId || '',
      cfPaymentLink: paymentResult.cfPaymentLink || '',
      
      customerName: `${merchant.firstname} ${merchant.lastname}`,
      customerVpa: `${merchant.mid?.toLowerCase()}@skypal`,
      customerContact: merchant.contact || '',
      customerEmail: merchant.email || '',
      
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
    console.error(`❌ Error Stack:`, error.stack);
    
    res.status(500).json({
      success: false,
      message: error.message,
      errorType: 'GENERATION_ERROR',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// // FIXED Cashfree function - HTTPS URLs
// const generateCashfreePayment = async ({ merchant, amount, paymentMethod, paymentOption, connectorAccount }) => {
//   try {
//     console.log('🔗 Generating Cashfree Payment...');
    
//     // ✅ CRITICAL FIX: Properly handle integrationKeys from populated connectorAccount
//     let integrationKeys = {};
    
//     if (connectorAccount && connectorAccount.integrationKeys) {
//       console.log('🔐 Raw integrationKeys from database:', connectorAccount.integrationKeys);
      
//       // Handle different types of integrationKeys storage
//       if (connectorAccount.integrationKeys instanceof Map) {
//         integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
//       } else if (typeof connectorAccount.integrationKeys === 'object') {
//         integrationKeys = { ...connectorAccount.integrationKeys };
//       } else {
//         console.warn('⚠️ Unexpected integrationKeys type:', typeof connectorAccount.integrationKeys);
//         integrationKeys = {};
//       }
//     }

//     console.log('🔍 Integration Keys Found:', Object.keys(integrationKeys));

//     // ✅ CRITICAL FIX: Extract credentials with proper fallbacks
//     const clientId = integrationKeys['x-client-id'] || integrationKeys['client_id'] || integrationKeys['X-Client-Id'];
//     const clientSecret = integrationKeys['x-client-secret'] || integrationKeys['client_secret'] || integrationKeys['X-Client-Secret'];
//     const apiVersion = integrationKeys['x-api-version'] || integrationKeys['api_version'] || '2023-08-01';

//     console.log('🔐 Credentials Status:', {
//       clientId: clientId ? 'PRESENT' : 'MISSING',
//       clientSecret: clientSecret ? 'PRESENT' : 'MISSING',
//       apiVersion: apiVersion
//     });

//     // ✅ CRITICAL FIX: Better validation
//     if (!clientId || !clientSecret) {
//       const missing = [];
//       if (!clientId) missing.push('Client ID');
//       if (!clientSecret) missing.push('Client Secret');
//       throw new Error(`Missing Cashfree credentials: ${missing.join(', ')}. Available keys: ${Object.keys(integrationKeys).join(', ')}`);
//     }

//     // ✅ CRITICAL FIX: Generate unique order ID
//     const timestamp = Date.now();
//     const random = Math.floor(Math.random() * 10000);
//     const orderId = `order_${timestamp}_${random}`;
//     const txnRefId = `txn_${timestamp}_${random}`;
    
//     // ✅ CRITICAL FIX: Validate amount
//     const orderAmount = parseFloat(amount);
//     if (isNaN(orderAmount) || orderAmount <= 0) {
//       throw new Error('Invalid amount: ' + amount);
//     }

//     // ✅ CRITICAL FIX: Use HTTPS URLs for Cashfree (required by their API)
//     const returnUrl = `https://webhook.site/cashfree-return`; // Temporary HTTPS URL for testing
//     const notifyUrl = `https://webhook.site/cashfree-webhook`; // Temporary HTTPS URL for testing

//     console.log('🔐 Using HTTPS URLs for Cashfree:', {
//       return_url: returnUrl,
//       notify_url: notifyUrl
//     });

//     const requestData = {
//       order_amount: orderAmount.toFixed(2),
//       order_currency: "INR",
//       order_id: orderId,
//       customer_details: {
//         customer_id: merchant.mid || `cust_${timestamp}`,
//         customer_phone: merchant.contact || "9999999999",
//         customer_email: merchant.email || "customer@example.com",
//         customer_name: `${merchant.firstname} ${merchant.lastname}`.trim() || "Customer"
//       },
//       order_meta: {
//         return_url: returnUrl, // ✅ HTTPS URL
//         notify_url: notifyUrl  // ✅ HTTPS URL
//       },
//       order_note: `Payment for ${merchant.company || merchant.firstname}`
//     };

//     console.log('📤 Cashfree API Request Data:', JSON.stringify(requestData, null, 2));

//     // ✅ CRITICAL FIX: Enhanced API call with better error handling
//     let response;
//     try {
//       console.log('🌐 Calling Cashfree API...');
      
//       response = await axios.post(
//         'https://api.cashfree.com/pg/orders',
//         requestData,
//         {
//           headers: {
//             'Content-Type': 'application/json',
//             'x-client-id': clientId.trim(),
//             'x-client-secret': clientSecret.trim(),
//             'x-api-version': apiVersion,
//             'Accept': 'application/json'
//           },
//           timeout: 30000
//         }
//       );

//       console.log('✅ Cashfree API Response Status:', response.status);
//       console.log('✅ Cashfree API Response Data:', response.data);
      
//     } catch (apiError) {
//       console.error('❌ Cashfree API Call Failed:', apiError.message);
      
//       if (apiError.response) {
//         console.error('🔍 Cashfree API Error Response:', {
//           status: apiError.response.status,
//           statusText: apiError.response.statusText,
//           data: apiError.response.data,
//           headers: apiError.response.headers
//         });
        
//         // Handle specific Cashfree errors
//         if (apiError.response.status === 401) {
//           throw new Error('Cashfree: Invalid credentials (Unauthorized)');
//         } else if (apiError.response.status === 400) {
//           throw new Error(`Cashfree: Bad request - ${apiError.response.data?.message || 'Check request data'}`);
//         } else if (apiError.response.status === 403) {
//           throw new Error('Cashfree: Forbidden - Account may be inactive or restricted');
//         } else if (apiError.response.status === 500) {
//           throw new Error('Cashfree: Internal server error - please try again later');
//         }
//       } else if (apiError.request) {
//         throw new Error('Cashfree: No response received from server - check network connection');
//       }
      
//       throw new Error(`Cashfree API call failed: ${apiError.message}`);
//     }

//     // ✅ CRITICAL FIX: Validate response
//     if (!response.data) {
//       throw new Error('Cashfree API returned empty response');
//     }

//     if (!response.data.payment_session_id) {
//       console.error('❌ No payment_session_id in response:', response.data);
//       throw new Error('Cashfree API did not return payment session ID');
//     }

//     const paymentLink = `https://payments.cashfree.com/order/#${response.data.payment_session_id}`;
    
//     console.log('🎯 Generated Payment Link:', paymentLink);

//     return {
//       paymentLink: paymentLink,
//       merchantOrderId: orderId,
//       txnRefId: txnRefId,
//       gatewayTxnId: response.data.cf_order_id || orderId,
//       gatewayOrderId: response.data.order_id,
//       cfOrderId: response.data.cf_order_id,
//       cfPaymentLink: paymentLink,
//       paymentSessionId: response.data.payment_session_id,
//       apiResponse: response.data
//     };

//   } catch (error) {
//     console.error('❌ Cashfree payment generation failed:', error);
//     throw new Error(`Cashfree: ${error.message}`);
//   }
// };

const generateCashfreePayment = async ({ merchant, amount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Cashfree Payment...');
    
    // ✅ CRITICAL FIX: Properly handle integrationKeys
    let integrationKeys = {};
    
    if (connectorAccount && connectorAccount.integrationKeys) {
      console.log('🔐 Raw integrationKeys from database:', connectorAccount.integrationKeys);
      
      if (connectorAccount.integrationKeys instanceof Map) {
        integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
      } else if (typeof connectorAccount.integrationKeys === 'object') {
        integrationKeys = { ...connectorAccount.integrationKeys };
      }
    }

    console.log('🔍 Integration Keys Found:', Object.keys(integrationKeys));

    // ✅ Extract credentials with proper fallbacks
    const clientId = integrationKeys['x-client-id'] || integrationKeys['client_id'] || integrationKeys['X-Client-Id'];
    const clientSecret = integrationKeys['x-client-secret'] || integrationKeys['client_secret'] || integrationKeys['X-Client-Secret'];
    const apiVersion = integrationKeys['x-api-version'] || integrationKeys['api_version'] || '2023-08-01';

    console.log('🔐 Credentials Status:', {
      clientId: clientId ? 'PRESENT' : 'MISSING',
      clientSecret: clientSecret ? 'PRESENT' : 'MISSING',
      apiVersion: apiVersion
    });

    // ✅ Better validation
    if (!clientId || !clientSecret) {
      const missing = [];
      if (!clientId) missing.push('Client ID');
      if (!clientSecret) missing.push('Client Secret');
      throw new Error(`Missing Cashfree credentials: ${missing.join(', ')}`);
    }

    // ✅ Generate unique order ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const orderId = `order_${timestamp}_${random}`;
    const txnRefId = `txn_${timestamp}_${random}`;
    
    // ✅ Validate amount
    const orderAmount = parseFloat(amount);
    if (isNaN(orderAmount) || orderAmount <= 0) {
      throw new Error('Invalid amount: ' + amount);
    }

    // ✅ CRITICAL FIX: Use proper HTTPS URLs for Cashfree
    const returnUrl = `https://pg-admin-backend.vercel.app/api/payment/cashfree-return`;
    const notifyUrl = `https://pg-admin-backend.vercel.app/api/payment/cashfree-webhook`;

    console.log('🔐 Using HTTPS URLs for Cashfree:', {
      return_url: returnUrl,
      notify_url: notifyUrl
    });

    const requestData = {
      order_amount: orderAmount.toFixed(2),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: merchant.mid || `cust_${timestamp}`,
        customer_phone: merchant.contact || "9999999999",
        customer_email: merchant.email || "customer@example.com",
        customer_name: `${merchant.firstname} ${merchant.lastname}`.trim() || "Customer"
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
        payment_methods: "cc,dc,upi" // Specify allowed payment methods
      },
      order_note: `Payment for ${merchant.company || merchant.firstname}`,
      order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes expiry
    };

    console.log('📤 Cashfree API Request Data:', JSON.stringify(requestData, null, 2));

    // ✅ Enhanced API call
    let response;
    try {
      console.log('🌐 Calling Cashfree API...');
      
      response = await axios.post(
        'https://api.cashfree.com/pg/orders',
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
      console.log('✅ Cashfree API Response Data:', response.data);
      
    } catch (apiError) {
      console.error('❌ Cashfree API Call Failed:', apiError.message);
      
      if (apiError.response) {
        console.error('🔍 Cashfree API Error Response:', {
          status: apiError.response.status,
          statusText: apiError.response.statusText,
          data: apiError.response.data
        });
        
        if (apiError.response.status === 401) {
          throw new Error('Cashfree: Invalid credentials (Unauthorized)');
        } else if (apiError.response.status === 400) {
          throw new Error(`Cashfree: Bad request - ${apiError.response.data?.message || 'Check request data'}`);
        }
      }
      
      throw new Error(`Cashfree API call failed: ${apiError.message}`);
    }

    // ✅ CRITICAL FIX: Proper payment link generation
    if (!response.data.payment_session_id) {
      console.error('❌ No payment_session_id in response:', response.data);
      throw new Error('Cashfree API did not return payment session ID');
    }

    // ✅ CORRECT Payment Link Format
    const paymentLink = `https://payments.cashfree.com/order/#${response.data.payment_session_id}`;
    
    console.log('🎯 Generated Payment Link:', paymentLink);

    return {
      paymentLink: paymentLink,
      merchantOrderId: orderId,
      txnRefId: txnRefId,
      gatewayTxnId: response.data.cf_order_id || orderId,
      gatewayOrderId: response.data.order_id,
      cfOrderId: response.data.cf_order_id,
      cfPaymentLink: paymentLink,
      paymentSessionId: response.data.payment_session_id
    };

  } catch (error) {
    console.error('❌ Cashfree payment generation failed:', error);
    throw new Error(`Cashfree: ${error.message}`);
  }
};

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

    // Update transaction status based on callback
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

    // Redirect to frontend success page
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=${order_status === 'PAID' ? 'success' : 'failed'}&transactionRefId=${order_id || ''}`);
    
  } catch (error) {
    console.error('❌ Cashfree return handler error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error`);
  }
};

// Cashfree Webhook Handler
export const handleCashfreeWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log('📩 Cashfree Webhook Received:', webhookData);

    // Verify webhook signature (important for security)
    // Add signature verification logic here

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


// controllers/paymentLinkController.js मध्ये add करा
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
      order_amount: "1.00", // Small amount for testing
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

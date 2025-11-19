// import Transaction from '../models/Transaction.js';
// import { encrypt } from '../utils/encryption.js';
// import crypto from 'crypto';
// import mongoose from 'mongoose';
// import axios from 'axios';
// import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
// import ConnectorAccount from '../models/ConnectorAccount.js';
// import User from '../models/User.js';

// const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';


// // In your generateGenericPaymentLink function, add timeout
// const generateGenericPaymentLink = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption }) => {
//   try {
//     console.log('🔗 STEP 3.1: Generating Generic Payment Link...');
    
//     // Add small delay to simulate processing (remove this in production)
//     await new Promise(resolve => setTimeout(resolve, 100));
    
//     // Get basic details from database
//     const terminalId = primaryAccount.terminalId || 'N/A';
//     const connectorName = primaryAccount.connectorId?.name || 'Unknown';
//     const merchantName = merchant.company || `${merchant.firstname} ${merchant.lastname}`;
//     const merchantMID = merchant.mid;
    
//     console.log('📦 Payment Details:', { merchant: merchantName, terminalId, connector: connectorName, amount });

//     // Validate required fields
//     if (!merchantMID) {
//       throw new Error('Merchant MID is required');
//     }

//     // ✅ GENERIC PAYMENT LINK
//     const genericLink = `https://pay.skypal.com/process?` + 
//       `mid=${encodeURIComponent(merchantMID)}` +
//       `&amount=${amount}` +
//       `&currency=INR` +
//       `&terminal=${encodeURIComponent(terminalId)}` +
//       `&connector=${encodeURIComponent(connectorName)}` +
//       `&method=${encodeURIComponent(paymentMethod)}` +
//       `&option=${encodeURIComponent(paymentOption)}` +
//       `&timestamp=${Date.now()}`;
    
//     console.log('✅ Generated Generic Payment URL:', genericLink);
    
//     return genericLink;
    
//   } catch (error) {
//     console.error('❌ Error in generateGenericPaymentLink:', error);
    
//     // Simple fallback
//     const fallbackUrl = `https://pay.skypal.com/pay?mid=${merchant.mid}&amount=${amount}`;
//     console.log('🔄 Using fallback URL:', fallbackUrl);
//     return fallbackUrl;
//   }
// };

// // Add to paymentLinkController.js
// export const testPaymentGeneration = async (req, res) => {
//   try {
//     const { merchantId, amount = '1000', paymentMethod = 'upi', paymentOption = 'gpay' } = req.body;
    
//     console.log('🧪 TEST: Testing payment generation for merchant:', merchantId);
    
//     // Test data
//     const testData = {
//       merchantId,
//       amount,
//       currency: 'INR',
//       paymentMethod,
//       paymentOption
//     };
    
//     console.log('🧪 Test data:', testData);
    
//     // Check merchant exists
//     const merchant = await User.findById(merchantId);
//     if (!merchant) {
//       return res.status(404).json({
//         success: false,
//         message: 'Merchant not found'
//       });
//     }
    
//     // Check connector accounts
//     const connectors = await MerchantConnectorAccount.find({
//       merchantId: merchantId,
//       status: 'Active'
//     })
//     .populate('connectorId')
//     .populate('connectorAccountId');
    
//     console.log('🧪 Found connectors:', connectors.length);
    
//     if (connectors.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No active connectors found'
//       });
//     }
    
//     // Test generic link generation
//     const testLink = await generateGenericPaymentLink({
//       merchant,
//       amount: parseFloat(amount),
//       primaryAccount: connectors[0],
//       paymentMethod,
//       paymentOption
//     });
    
//     res.json({
//       success: true,
//       testResults: {
//         merchant: {
//           name: `${merchant.firstname} ${merchant.lastname}`,
//           mid: merchant.mid
//         },
//         connector: {
//           name: connectors[0].connectorId?.name,
//           account: connectors[0].connectorAccountId?.name,
//           terminalId: connectors[0].terminalId
//         },
//         generatedLink: testLink,
//         step: 'Test completed successfully'
//       }
//     });
    
//   } catch (error) {
//     console.error('❌ TEST Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Test failed',
//       error: error.message,
//       stack: error.stack
//     });
//   }
// };


// const testSimpleEndpoint = async () => {
//   try {
//     console.log('🧪 Testing simple endpoint...');
    
//     const response = await axios.post(
//       `${import.meta.env.VITE_API_BASE_URL}/payment/simple-test`,
//       {
//         merchantId: "691aad24b2de5f1f7c80dbd1",
//         amount: "1000",
//         paymentMethod: "upi",
//         paymentOption: "gpay"
//       },
//       {
//         timeout: 10000, // 10 second timeout
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       }
//     );
    
//     console.log('✅ Simple test response:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('❌ Simple test failed:', error);
//     throw error;
//   }
// };

// // Add this to your paymentLinkController.js
// export const debugRequestBody = async (req, res) => {
//   try {
//     console.log('🔍 DEBUG Request Info:');
//     console.log('Headers:', req.headers);
//     console.log('Body:', req.body);
//     console.log('Body type:', typeof req.body);
//     console.log('Body keys:', Object.keys(req.body));
//     console.log('Content-Type:', req.get('Content-Type'));

//     res.json({
//       success: true,
//       debug: {
//         headers: req.headers,
//         body: req.body,
//         bodyType: typeof req.body,
//         bodyKeys: Object.keys(req.body),
//         contentLength: req.get('Content-Length'),
//         contentType: req.get('Content-Type')
//       }
//     });
//   } catch (error) {
//     console.error('❌ DEBUG Error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// export const generatePaymentLink = async (req, res) => {
//   const startTime = Date.now();
//   console.log('🚀 generatePaymentLink STARTED');
  
//   // Set timeout for the entire function
//   const timeoutPromise = new Promise((_, reject) => {
//     setTimeout(() => reject(new Error('Function timeout after 25s')), 25000);
//   });

//   try {
//     const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;
    
//     console.log('📦 Processing request for merchant:', merchantId);

//     // Validate input quickly
//     if (!merchantId || !amount || !paymentMethod || !paymentOption) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields'
//       });
//     }

//     // Use Promise.race to handle timeouts
//     const result = await Promise.race([
//       processPaymentLinkGeneration({ merchantId, amount, currency, paymentMethod, paymentOption }),
//       timeoutPromise
//     ]);

//     console.log(`✅ Completed in ${Date.now() - startTime}ms`);
    
//     res.json({
//       success: true,
//       ...result
//     });

//   } catch (error) {
//     console.error(`❌ Failed after ${Date.now() - startTime}ms:`, error);
    
//     res.status(500).json({
//       success: false,
//       message: 'Payment link generation failed',
//       error: error.message
//     });
//   }
// };


// const processPaymentLinkGeneration = async ({ merchantId, amount, currency, paymentMethod, paymentOption }) => {
//   console.log('🔍 Step 1: Finding active connector account');
  
//   const activeAccount = await MerchantConnectorAccount.findOne({
//     merchantId: merchantId,
//     status: 'Active'
//   })
//   .populate('connectorId', 'name')
//   .populate('connectorAccountId', 'name terminalId integrationKeys')
//   .maxTimeMS(10000)
//   .lean();

//   if (!activeAccount) {
//     throw new Error('No active connector account found');
//   }

//   console.log('🔍 Step 2: Finding merchant');
//   const merchant = await User.findById(merchantId)
//     .select('firstname lastname company mid email contact')
//     .maxTimeMS(10000)
//     .lean();

//   if (!merchant) {
//     throw new Error('Merchant not found');
//   }

//   console.log('🔗 Step 3: Generating payment link');
//   let paymentLink;
//   const connectorName = activeAccount.connectorId?.name;

//   if (connectorName === 'Enpay') {
//     paymentLink = await generateEnpayPaymentLink({
//       merchant,
//       amount: parseFloat(amount),
//       primaryAccount: activeAccount,
//       paymentMethod,
//       paymentOption
//     });
//   } else {
//     paymentLink = await generateGenericPaymentLink({
//       merchant,
//       amount: parseFloat(amount),
//       primaryAccount: activeAccount,
//       paymentMethod,
//       paymentOption
//     });
//   }

//   console.log('💾 Step 4: Creating transaction with ALL required fields');
  
//   // Generate ALL required IDs - make sure these match your Transaction schema
//   const txnRefId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
//   const merchantOrderId = `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;
//   const merchantHashId = activeAccount.connectorAccountId?.integrationKeys?.merchantHashId || merchant.mid;
//   const merchantVpa = `${merchant.mid?.toLowerCase() || 'merchant'}@skypal`;
//   const transactionId = `TRN${Date.now()}${Math.floor(Math.random() * 1000)}`;

//   console.log('📝 Generated IDs:', {
//     txnRefId,
//     merchantOrderId, 
//     merchantHashId,
//     merchantVpa,
//     transactionId
//   });

//   // Create transaction data with EXACT field names from your schema
//   const transactionData = {
//     // ✅ REQUIRED FIELDS from your Transaction schema
//     transactionId: transactionId,
//     merchantOrderId: merchantOrderId,
//     merchantHashId: merchantHashId,
//     merchantVpa: merchantVpa,
//     txnRefId: txnRefId,
    
//     // Merchant information
//     merchantId: merchant._id,
//     merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
//     mid: merchant.mid,
    
//     // Payment details
//     amount: parseFloat(amount),
//     currency: currency,
//     status: 'INITIATED',
//     paymentMethod: paymentMethod,
//     paymentOption: paymentOption,
//     paymentUrl: paymentLink,
    
//     // Connector information
//     connectorId: activeAccount.connectorId?._id,
//     connectorAccountId: activeAccount.connectorAccountId?._id,
//     terminalId: activeAccount.terminalId || 'N/A',
    
//     // Customer information
//     "Customer Name": merchant.firstname + ' ' + merchant.lastname,
//     "Customer VPA": merchantVpa,
//     "Customer Contact No": merchant.contact || '',
    
//     // Default values for other required fields
//     "Commission Amount": 0,
//     "Settlement Status": "Pending",
//     "Vendor Ref ID": "",
//     "Vendor Txn ID": "",
//     upiId: "",
//     txnNote: `Payment for ${merchant.company || merchant.firstname}`,
//     source: "enpay",
//     isMock: false,
//     qrCode: "",
//     enpayTxnId: "",
//     encryptedPaymentPayload: ""
//   };

//   console.log('📦 Transaction data to save:', {
//     transactionId: transactionData.transactionId,
//     txnRefId: transactionData.txnRefId,
//     merchantOrderId: transactionData.merchantOrderId,
//     merchantHashId: transactionData.merchantHashId,
//     merchantVpa: transactionData.merchantVpa
//   });

//   try {
//     console.log('💾 Attempting to save transaction...');
//     const newTransaction = new Transaction(transactionData);
//     await newTransaction.save();
//     console.log('✅ Transaction saved successfully with ID:', transactionData.transactionId);
//   } catch (saveError) {
//     console.error('❌ Transaction save error:', saveError);
//     console.error('❌ Validation errors:', saveError.errors);
//     throw new Error(`Failed to save transaction: ${saveError.message}`);
//   }

//   return {
//     paymentLink: paymentLink,
//     transactionRefId: transactionData.transactionId,
//     txnRefId: txnRefId,
//     connector: connectorName || 'Unknown',
//     terminalId: activeAccount.terminalId || 'N/A',
//     merchantName: `${merchant.firstname} ${merchant.lastname}`,
//     message: 'Payment link generated successfully'
//   };
// };

// // Add this to your paymentLinkController.js
// export const simpleTest = async (req, res) => {
//   console.log('🧪 SIMPLE TEST ROUTE CALLED');
  
//   try {
//     // Just return a simple response immediately
//     res.json({
//       success: true,
//       message: 'Simple test route is working!',
//       timestamp: new Date().toISOString(),
//       data: req.body
//     });
//   } catch (error) {
//     console.error('Simple test error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Add this debug route to check what's happening
// export const debugPaymentLink = async (req, res) => {
//   try {
//     const { merchantId } = req.body;
    
//     console.log('🔍 DEBUG: Checking payment link generation for merchant:', merchantId);
    
//     // Check merchant exists
//     const merchant = await User.findById(merchantId);
//     console.log('🔍 DEBUG: Merchant found:', merchant ? `${merchant.firstname} ${merchant.lastname}` : 'NOT FOUND');
    
//     // Check connector accounts
//     const connectors = await MerchantConnectorAccount.find({ merchantId: merchantId, status: 'Active' })
//       .populate('connectorId')
//       .populate('connectorAccountId');
    
//     console.log('🔍 DEBUG: Active connectors found:', connectors.length);
//     connectors.forEach((conn, index) => {
//       console.log(`🔍 DEBUG: Connector ${index + 1}:`, {
//         connector: conn.connectorId?.name,
//         account: conn.connectorAccountId?.name,
//         terminalId: conn.terminalId,
//         status: conn.status
//       });
//     });
    
//     res.json({
//       success: true,
//       merchant: merchant ? {
//         name: `${merchant.firstname} ${merchant.lastname}`,
//         mid: merchant.mid,
//         email: merchant.email
//       } : null,
//       connectors: connectors.map(conn => ({
//         connector: conn.connectorId?.name,
//         account: conn.connectorAccountId?.name,
//         terminalId: conn.terminalId,
//         status: conn.status,
//         isPrimary: conn.isPrimary
//       })),
//       totalConnectors: connectors.length
//     });
    
//   } catch (error) {
//     console.error('❌ DEBUG Error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // 🎯 GET MERCHANTS FROM DATABASE
// export const getMerchants = async (req, res) => {
//   try {
//     console.log('🔍 Fetching merchants from database...');
    
//     // Fetch all merchant users from database
//     const merchants = await User.find({ role: 'merchant' })
//       .select('_id firstname lastname company email mid status contact balance unsettleBalance createdAt')
//       .sort({ createdAt: -1 });

//     console.log(`✅ Found ${merchants.length} merchants from database`);

//     // Format the response
//     const formattedMerchants = merchants.map(merchant => ({
//       _id: merchant._id,
//       firstname: merchant.firstname,
//       lastname: merchant.lastname,
//       company: merchant.company,
//       email: merchant.email,
//       mid: merchant.mid,
//       status: merchant.status,
//       contact: merchant.contact,
//       balance: merchant.balance,
//       unsettleBalance: merchant.unsettleBalance,
//       merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
//       hashId: merchant.mid,
//       vpa: `${merchant.mid.toLowerCase()}@skypal`
//     }));

//     res.json({
//       success: true,
//       data: formattedMerchants,
//       count: formattedMerchants.length
//     });

//   } catch (error) {
//     console.error('❌ Error fetching merchants from database:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching merchants from database',
//       error: error.message
//     });
//   }
// };

// // 🎯 GET MERCHANT CONNECTORS FROM DATABASE
// export const getMerchantConnectors = async (req, res) => {
//   try {
//     const { merchantId } = req.params;
    
//     console.log('🔍 Fetching connector accounts for merchant:', merchantId);

//     // Validate merchantId
//     if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid merchant ID'
//       });
//     }

//     // Check if merchant exists
//     const merchant = await User.findById(merchantId);
//     if (!merchant) {
//       return res.status(404).json({
//         success: false,
//         message: 'Merchant not found'
//       });
//     }

//     console.log('🔄 Fetching connector accounts from database...');

//     // Fetch connector accounts from database
//     const connectorAccounts = await MerchantConnectorAccount.find({
//       merchantId: merchantId,
//       status: 'Active'
//     })
//     .populate('connectorId', 'name connectorType description')
//     .populate('connectorAccountId', 'name currency integrationKeys terminalId')
//     .select('terminalId industry percentage isPrimary status createdAt')
//     .sort({ isPrimary: -1, createdAt: -1 })
//     .lean();

//     console.log(`✅ Found ${connectorAccounts.length} connector accounts for merchant: ${merchant.firstname} ${merchant.lastname}`);

//     // Format the response with actual database data
//     const formattedAccounts = connectorAccounts.map(account => {
//       const connector = account.connectorId || {};
//       const connectorAcc = account.connectorAccountId || {};
      
//       return {
//         _id: account._id,
//         terminalId: account.terminalId || connectorAcc.terminalId || 'N/A',
//         connector: connector.name || 'Unknown',
//         connectorName: connector.name || 'Unknown',
//         connectorType: connector.connectorType || 'Payment',
//         assignedAccount: connectorAcc.name || 'Unknown',
//         accountName: connectorAcc.name || 'Unknown',
//         currency: connectorAcc.currency || 'INR',
//         industry: account.industry || 'General',
//         percentage: account.percentage || 100,
//         isPrimary: account.isPrimary || false,
//         status: account.status || 'Active',
//         integrationKeys: connectorAcc.integrationKeys || {},
//         createdAt: account.createdAt
//       };
//     });

//     res.status(200).json({
//       success: true,
//       data: formattedAccounts,
//       merchantInfo: {
//         name: `${merchant.firstname} ${merchant.lastname}`,
//         mid: merchant.mid,
//         email: merchant.email
//       }
//     });

//   } catch (error) {
//     console.error('❌ Error fetching merchant connectors from database:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching connector accounts from database',
//       error: error.message
//     });
//   }
// };

// export const getPaymentMethods = async (req, res) => {
//   try {
//     const methods = [
//       { id: "upi", name: "UPI" },
//       { id: "card", name: "Credit/Debit Card" },
//       { id: "netbanking", name: "Net Banking" }
//     ];

//     res.json({
//       success: true,
//       methods: methods
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching payment methods'
//     });
//   }
// };

// export const handleSuccess = async (req, res) => {
//   try {
//     const { transactionId } = req.query;
//     console.log('✅ Success callback for:', transactionId);

//     if (transactionId) {
//       await Transaction.findOneAndUpdate(
//         { transactionId: transactionId },
//         { status: 'SUCCESS' }
//       );
//     }

//     res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=success&transactionRefId=${transactionId || ''}`);
//   } catch (error) {
//     console.error('Success callback error:', error);
//     res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=error`);
//   }
// };

// export const handleReturn = async (req, res) => {
//   try {
//     const { transactionId, status } = req.query;
//     console.log('↩️ Return callback for:', transactionId, 'status:', status);

//     if (transactionId) {
//       await Transaction.findOneAndUpdate(
//         { transactionId: transactionId },
//         { status: status || 'FAILED' }
//       );
//     }

//     res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=${status || 'failed'}&transactionRefId=${transactionId || ''}`);
//   } catch (error) {
//     console.error('Return callback error:', error);
//     res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error`);
//   }
// };

// // 🎯 DEBUG ROUTE - Check database data
// export const debugMerchantData = async (req, res) => {
//   try {
//     const { merchantId } = req.params;
    
//     console.log('🔍 Debugging merchant data for:', merchantId);

//     // Get merchant from database
//     const merchant = await User.findById(merchantId);
//     if (!merchant) {
//       return res.status(404).json({
//         success: false,
//         message: 'Merchant not found in database'
//       });
//     }

//     // Get connector accounts from database
//     const connectors = await MerchantConnectorAccount.find({ merchantId: merchantId })
//       .populate('connectorId')
//       .populate('connectorAccountId');

//     res.json({
//       success: true,
//       merchant: {
//         _id: merchant._id,
//         name: `${merchant.firstname} ${merchant.lastname}`,
//         company: merchant.company,
//         email: merchant.email,
//         mid: merchant.mid,
//         status: merchant.status
//       },
//       connectors: connectors.map(conn => ({
//         connector: conn.connectorId?.name,
//         account: conn.connectorAccountId?.name,
//         terminalId: conn.terminalId,
//         status: conn.status,
//         isPrimary: conn.isPrimary
//       })),
//       totalConnectors: connectors.length
//     });

//   } catch (error) {
//     console.error('❌ Debug error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };


// // Add to paymentLinkController.js
// export const healthCheck = async (req, res) => {
//   try {
//     // Test database connection
//     const dbState = mongoose.connection.readyState;
//     const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
//     // Test User model
//     const userCount = await User.countDocuments();
    
//     // Test MerchantConnectorAccount model
//     const connectorCount = await MerchantConnectorAccount.countDocuments();
    
//     res.json({
//       success: true,
//       database: {
//         state: dbStates[dbState],
//         userCount,
//         connectorCount
//       },
//       timestamp: new Date().toISOString()
//     });
    
//   } catch (error) {
//     console.error('❌ Health check failed:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Health check failed',
//       error: error.message
//     });
//   }
// };

// const generateEnpayPaymentLink = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption }) => {
//   try {
//     console.log('🔗 Generating Enpay payment link...');
    
//     const integrationKeys = primaryAccount.connectorAccountId?.integrationKeys || {};
//     const terminalId = primaryAccount.terminalId;
    
//     // Generate unique transaction references
//     const txnRefId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
//     const merchantOrderId = `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
//     console.log('📦 Enpay transaction details:', {
//       txnRefId,
//       merchantOrderId,
//       terminalId,
//       amount,
//       merchantHashId: integrationKeys.merchantHashId
//     });

//     // Prepare request data for Enpay API
//     const requestData = {
//       merchantHashId: integrationKeys.merchantHashId,
//       txnAmount: parseFloat(amount),
//       txnNote: `Payment to ${merchant.company || merchant.firstname}`,
//       txnRefId: txnRefId,
//       // Add required customer fields
//       customerDetails: {
//         firstName: merchant.firstname || "Customer",
//         lastName: merchant.lastname || "User", 
//         email: merchant.email || "customer@example.com",
//         phone: merchant.contact || "9999999999"
//       }
//     };

//     console.log('📤 Sending request to Enpay API:', requestData);

//     // Call Enpay API to create dynamic QR/payment link
//     const enpayResponse = await axios.post(
//       `${integrationKeys.baseUrl}/dynamicQR`,
//       requestData,
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           'X-Merchant-Key': integrationKeys['X-Merchant-Key'],
//           'X-Merchant-Secret': integrationKeys['X-Merchant-Secret']
//         },
//         timeout: 15000
//       }
//     );
    
//     console.log('✅ Enpay API response received:', enpayResponse.data);
    
//     // Check if response contains QR code or payment link
//     if (enpayResponse.data && enpayResponse.data.qrCode) {
//       console.log('🎯 Enpay QR code generated successfully');
//       return enpayResponse.data.qrCode;
//     } else if (enpayResponse.data && enpayResponse.data.paymentLink) {
//       console.log('🎯 Enpay payment link generated successfully');
//       return enpayResponse.data.paymentLink;
//     } else {
//       throw new Error('Enpay API did not return payment link or QR code');
//     }
    
//   } catch (error) {
//     console.error('❌ Enpay payment link generation failed:', error);
    
//     if (error.response) {
//       console.error('Enpay API error response:', {
//         status: error.response.status,
//         data: error.response.data,
//         headers: error.response.headers
//       });
//     }
    
//     // Fallback to generic payment link
//     const fallbackLink = `https://pay.skypal.com/process?` + 
//       `mid=${encodeURIComponent(merchant.mid)}` +
//       `&amount=${amount}` +
//       `&currency=INR` +
//       `&terminal=${encodeURIComponent(primaryAccount.terminalId || 'N/A')}` +
//       `&connector=Enpay` +
//       `&method=${encodeURIComponent(paymentMethod)}` +
//       `&option=${encodeURIComponent(paymentOption)}` +
//       `&txnRefId=TXN${Date.now()}` +
//       `&timestamp=${Date.now()}`;
    
//     console.log('🔄 Using fallback URL:', fallbackLink);
//     return fallbackLink;
//   }
// };


// controllers/paymentLinkController.js
import Transaction from '../models/Transaction.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import User from '../models/User.js';

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

// Main payment link generation function
export const generatePaymentLink = async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 generatePaymentLink STARTED');
  
  try {
    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;
    
    console.log('📦 Processing request for merchant:', merchantId, {
      amount, currency, paymentMethod, paymentOption
    });

    // Validate input
    if (!merchantId || !amount || !paymentMethod || !paymentOption) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: merchantId, amount, paymentMethod, paymentOption'
      });
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be valid and greater than 0'
      });
    }

    // Process payment link generation
    const result = await processPaymentLinkGeneration({
      merchantId, 
      amount: paymentAmount, 
      currency, 
      paymentMethod, 
      paymentOption
    });

    console.log(`✅ Payment link generated in ${Date.now() - startTime}ms`);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error(`❌ Payment link generation failed after ${Date.now() - startTime}ms:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Payment link generation failed',
      error: error.message
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

  // Find active connector account with proper population
  const activeAccount = await MerchantConnectorAccount.findOne({
    merchantId: merchantId,
    status: 'Active'
  })
  .populate({
    path: 'connectorId',
    select: 'name className connectorType'
  })
  .populate({
    path: 'connectorAccountId',
    select: 'name currency integrationKeys'
  })
  .maxTimeMS(10000);

  if (!activeAccount) {
    throw new Error('No active connector account found for this merchant');
  }

  console.log('✅ Active connector account found:', {
    connectorName: activeAccount.connectorId?.name,
    connectorAccountId: activeAccount.connectorAccountId?._id,
    connectorAccountName: activeAccount.connectorAccountId?.name,
    terminalId: activeAccount.terminalId
  });

  // Check if connectorAccountId is properly populated
  if (!activeAccount.connectorAccountId) {
    console.error('❌ Connector Account not populated:', activeAccount);
    throw new Error('Connector account details not found - population failed');
  }

  const connectorName = activeAccount.connectorId?.name;
  const connectorAccount = activeAccount.connectorAccountId;

  console.log('🔍 Connector Account Integration Keys:', connectorAccount.integrationKeys);
  console.log('🔍 Connector Account Details:', {
    name: connectorAccount.name,
    currency: connectorAccount.currency,
    hasIntegrationKeys: !!connectorAccount.integrationKeys
  });

  // If integrationKeys is empty, try to fetch the connector account separately
  if (!connectorAccount.integrationKeys || Object.keys(connectorAccount.integrationKeys).length === 0) {
    console.log('🔄 Integration keys empty, fetching connector account separately...');
    
    const freshConnectorAccount = await ConnectorAccount.findById(connectorAccount._id);
    if (freshConnectorAccount && freshConnectorAccount.integrationKeys) {
      console.log('✅ Found integration keys in fresh fetch:', freshConnectorAccount.integrationKeys);
      connectorAccount.integrationKeys = freshConnectorAccount.integrationKeys;
    } else {
      console.error('❌ No integration keys found even after fresh fetch');
      throw new Error('Connector account integration keys not found');
    }
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
    connectorAccountId: activeAccount.connectorAccountId?._id,
    connectorName: connectorName || 'Unknown',
    terminalId: activeAccount.terminalId || 'N/A',
    
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

// Enpay Collect Request API - Correct Implementation
const generateEnpayCollectRequest = async ({ merchant, amount, primaryAccount, paymentMethod, paymentOption, connectorAccount }) => {
  try {
    console.log('🔗 Generating Enpay Collect Request...');
    
    const integrationKeys = connectorAccount?.integrationKeys || {};
    const terminalId = primaryAccount.terminalId;
    
    // Validate required Enpay credentials
    const requiredCredentials = ['X-Merchant-Key', 'X-Merchant-Secret', 'merchantHashId'];
    for (const cred of requiredCredentials) {
      if (!integrationKeys[cred]) {
        throw new Error(`Missing required Enpay credential: ${cred}`);
      }
    }

    console.log('✅ Enpay credentials validated');

    // Generate unique transaction references
    const txnRefId = generateTxnRefId();
    const merchantOrderId = generateMerchantOrderId();
    const enpayTxnId = `ENP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    console.log('📦 Enpay transaction details:', {
      merchantHashId: integrationKeys.merchantHashId,
      amount,
      merchantOrderId,
      txnRefId
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

    // Enpay API endpoint - CORRECT ONE from your Postman
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
      
      // More detailed error information
      if (error.response.data) {
        console.error('Enpay API error details:', error.response.data);
      }
    } else if (error.request) {
      console.error('No response received from Enpay API:', error.request);
    } else {
      console.error('Error setting up Enpay API request:', error.message);
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

// Process Short Link - Direct redirect to Enpay
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

// Debug function to check Enpay credentials
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

// Keep other functions...
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

// Add this to paymentLinkController.js
export const debugConnectorAccount = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 DEBUG: Checking connector account for merchant:', merchantId);

    // Check merchant
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

    // Detailed logging
    connectorAccounts.forEach((account, index) => {
      console.log(`🔍 Connector Account ${index + 1}:`, {
        _id: account._id,
        connectorId: account.connectorId?._id,
        connectorName: account.connectorId?.name,
        connectorAccountId: account.connectorAccountId?._id,
        connectorAccountName: account.connectorAccountId?.name,
        terminalId: account.terminalId,
        status: account.status,
        isPrimary: account.isPrimary
      });

      // Check if connectorAccountId exists and has integrationKeys
      if (account.connectorAccountId) {
        console.log(`🔍 Connector Account Details ${index + 1}:`, {
          name: account.connectorAccountId.name,
          currency: account.connectorAccountId.currency,
          integrationKeys: account.connectorAccountId.integrationKeys,
          hasIntegrationKeys: !!account.connectorAccountId.integrationKeys
        });
      } else {
        console.log(`❌ Connector Account ${index + 1}: connectorAccountId is null or not populated`);
      }
    });

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid
      },
      connectorAccounts: connectorAccounts.map(acc => ({
        _id: acc._id,
        connectorId: acc.connectorId?._id,
        connectorName: acc.connectorId?.name,
        connectorAccountId: acc.connectorAccountId?._id,
        connectorAccountName: acc.connectorAccountId?.name,
        terminalId: acc.terminalId,
        status: acc.status,
        isPrimary: acc.isPrimary,
        hasConnectorAccount: !!acc.connectorAccountId,
        hasIntegrationKeys: acc.connectorAccountId?.integrationKeys ? true : false
      })),
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
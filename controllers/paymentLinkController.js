import Transaction from "../models/Transaction.js";
// import { encrypt, decrypt } from '../utils/encryption.js';
import crypto from "crypto";
import mongoose from "mongoose";
import axios from "axios";
import MerchantConnectorAccount from "../models/MerchantConnectorAccount.js";
import ConnectorAccount from "../models/ConnectorAccount.js";
import User from "../models/User.js";
import Merchant from "../models/Merchant.js";
const ObjectId = mongoose.Types.ObjectId;
import Razorpay from "razorpay";

const FRONTEND_BASE_URL =
  process.env.FRONTEND_URL || "http://localhost:3000/admin";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

// Generate short ID utility
function generateShortId(length = 10) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const todayFilter = () => {
  const now = new Date();

  let start, end;
  start = new Date(now);
  start.setHours(0, 0, 0, 0);
  end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return {
    createdAt: {
      $gte: start,
      $lte: end,
    },
  };
};

function generateTransactionId() {
  return `TRN${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateTxnRefId() {
  return `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateMerchantOrderId() {
  return `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// ✅ ADD THIS FUNCTION - Extract integration keys from connector account
function extractIntegrationKeys(connectorAccount) {
  // console.log("🔍 Extracting integration keys from:", {
  //   hasIntegrationKeys: !!connectorAccount?.integrationKeys,
  //   hasConnectorAccountId:
  //     !!connectorAccount?.connectorAccountId?.integrationKeys,
  //   connectorAccountId: connectorAccount?.connectorAccountId?._id,
  // });

  let integrationKeys = {};

  // ✅ Check multiple possible locations for integration keys
  if (
    connectorAccount?.integrationKeys &&
    Object.keys(connectorAccount.integrationKeys).length > 0
  ) {
    // console.log("🎯 Found keys in connectorAccount.integrationKeys");
    integrationKeys = connectorAccount.integrationKeys;
  } else if (
    connectorAccount?.connectorAccountId?.integrationKeys &&
    Object.keys(connectorAccount.connectorAccountId.integrationKeys).length > 0
  ) {
    // console.log(
    //   "🎯 Found keys in connectorAccount.connectorAccountId.integrationKeys"
    // );
    integrationKeys = connectorAccount.connectorAccountId.integrationKeys;
  } else {
    console.log("⚠️ No integration keys found in standard locations");
  }

  // ✅ Convert if it's a Map or special object
  if (integrationKeys instanceof Map) {
    integrationKeys = Object.fromEntries(integrationKeys);
    // console.log("🔍 Converted Map to Object");
  } else if (typeof integrationKeys === "string") {
    try {
      integrationKeys = JSON.parse(integrationKeys);
      // console.log("🔍 Parsed JSON string to Object");
    } catch (e) {
      console.error("❌ Failed to parse integrationKeys string:", e);
    }
  }

  // console.log("🎯 Extracted Keys:", Object.keys(integrationKeys));
  return integrationKeys;
}

export const generatePaymentLink = async (req, res) => {
  const startTime = Date.now();
  // console.log("🚀 generatePaymentLink STARTED");
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      merchantId,
      amount,
      currency = "INR",
      paymentMethod,
      paymentOption,
    } = req.body;

    // Validation
    if (!merchantId || !amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Missing required fields: merchantId, amount",
      });
    }

    let user;
    if (merchantId)
      user = await User.findOne({ _id: merchantId }).session(session);

    if (!user) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Merchnat not found" });
    }

    const merchantUpdate = await Merchant.findOne({ userId: user._id }).session(
      session
    );
    // console.log(merchantUpdate);
    if (!merchantUpdate) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const dateFilter = todayFilter();
    // console.log(dateFilter, user._id, user.transactionLimit);

    const transactionLimit = await Transaction.find({
      merchantId,
      ...dateFilter,
    }).session(session);

    // console.log(transactionLimit.length, "transactionLimit");

    const used = Number(transactionLimit?.length || 0);
    const limit = Number(user?.transactionLimit || 0);

    if (user.transactionLimit) {
      if (used >= limit) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: "Transaction limit has been exceeded for today!",
        });
      }
    }

    if (!amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount cannot be blank",
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    if (amountNum < 500) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount should be greater than 500",
      });
    }

    // Find merchant
    const merchant = await User.findById(merchantId).session(session);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Find Active Connector Account
    const activeAccount = await MerchantConnectorAccount.findOne(
      {
        merchantId: new mongoose.Types.ObjectId(merchantId),
        isPrimary: true,
        status: "Active",
      },
      null,
      { session }
    )
      .populate("connectorId")
      .populate("connectorAccountId"); // Populating the reference to get global details if needed

    if (!activeAccount) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "No active payment connector found",
      });
    }

    const connectorName = activeAccount.connectorId?.name.toLowerCase();
    // console.log("🎯 Using Connector:", connectorName);

    // Extract keys using helper function
    const integrationKeys = extractIntegrationKeys(activeAccount);
    // console.log("🔑 Integration Keys Extracted:", {
    //   keysCount: Object.keys(integrationKeys).length,
    //   availableKeys: Object.keys(integrationKeys),
    // });
    const accountWithKeys = {
      ...activeAccount.toObject(), // Convert mongoose document to plain object
      extractedKeys: integrationKeys,
    };
    // Attach extracted keys to the account object for the generator functions
    activeAccount.extractedKeys = integrationKeys;

    let paymentResult;

    if (connectorName === "cashfree") {
      paymentResult = await generateCashfreePayment({
        merchant,
        amount: amountNum,
        paymentMethod,
        paymentOption,
        connectorAccount: accountWithKeys,
      });
    } else if (connectorName === "enpay") {
      paymentResult = await generateEnpayPayment({
        merchant,
        amount: amountNum,
        paymentMethod,
        paymentOption,
        connectorAccount: accountWithKeys,
      });
    } else if (connectorName === "razorpay") {
      paymentResult = await generateRazorpayPayment({
        merchant,
        amount: amountNum,
        paymentMethod,
        paymentOption,
        connectorAccount: accountWithKeys,
      });
    } else {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Unsupported connector: " + connectorName,
      });
    }

    if (!paymentResult) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: "Payment gateway did not return a valid response",
      });
    }

    // Create transaction record
    const transactionData = {
      transactionId: generateTransactionId(),
      merchantOrderId: paymentResult.merchantOrderId,
      merchantHashId: integrationKeys.merchantHashId,
      // merchantHashId: merchant.mid,
      // merchantVpa: `${merchant.mid?.toLowerCase()}@skypal`,
      merchantVpa: integrationKeys.merchantVpa,
      txnRefId: paymentResult.txnRefId,
      shortLinkId: generateShortId(),

      merchantId: merchant._id,
      merchantName:
        merchant.company || `${merchant.firstname} ${merchant.lastname || ""}`,
      mid: merchant.mid,

      amount: amountNum,
      currency: currency,

      status: "INITIATED",
      previousStatus: "INITIATED",
      payInApplied: false,

      paymentMethod: paymentMethod,
      paymentOption: paymentOption,
      paymentUrl: paymentResult.paymentLink,

      connectorId: activeAccount.connectorId?._id,
      connectorAccountId: activeAccount.connectorAccountId?._id,
      connectorName: connectorName,
      terminalId: activeAccount.terminalId || "N/A",

      gatewayTransactionId: paymentResult.gatewayTransactionId,
      gatewayPaymentLink: paymentResult.paymentLink,
      gatewayOrderId: paymentResult.gatewayOrderId,
      transactionType: "Link",

      customerName: `${merchant.firstname} ${merchant.lastname || ""}`,
      customerVpa: "",
      customerContact: merchant.contact || "",
      customerEmail: merchant.email || "",

      txnNote: `Payment for ${merchant.company || merchant.firstname}`,
      source: connectorName.toLowerCase(),
    };

    if (connectorName === "enpay") {
      transactionData.enpayTxnId = paymentResult.enpayTxnId;
      transactionData.enpayPaymentLink = paymentResult.paymentLink;
      transactionData.enpayResponse = paymentResult.enpayResponse?.data;
      transactionData.enpayTransactionStatus = "CREATED";
      transactionData.enpayInitiationStatus = "ENPAY_CREATED";
    } else if (connectorName === "razorpay") {
      transactionData.txnRefId = paymentResult.razorPayTxnId; //It is used to check the payment status
      transactionData.razorPayTxnId = paymentResult.txnRefId; //this is the Reference Id which is passed to generate Payment Link
      transactionData.razorPayPaymentLink = paymentResult.paymentLink;
      transactionData.razorPayResponse = paymentResult.razorPayResponse;
      transactionData.razorPayTransactionStatus = "CREATED";
      transactionData.razorPayInitiationStatus = "RAZORPAY_CREATED";
    }

    // Save transaction
    const newTransaction = new Transaction(transactionData);
    await newTransaction.save({ session });

    await Merchant.findOneAndUpdate(
      { userId: user._id },
      {
        lastPayinTransactions: newTransaction._id,
      },
      { new: true, session }
    );

    await session.commitTransaction();

    // console.log(
    //   `✅ ${connectorName} payment link generated in ${
    //     Date.now() - startTime
    //   }ms`
    // );

    res.json({
      success: true,
      paymentLink: paymentResult.paymentLink,
      transactionRefId: transactionData.transactionId,
      txnRefId: transactionData.txnRefId,
      connectorName,
      message: `${connectorName} payment link generated successfully`,
    });
  } catch (error) {
    console.error(`❌ Payment link generation failed:`, error);
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message,
      errorType: "GENERATION_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// export const generatePaymentLinkTransaction = async (req, res) => {
//   const startTime = Date.now();
//   // console.log("🚀 generatePaymentLink STARTED", req.body);

//   try {
//     const {
//       merchantId,
//       amount,
//       currency = "INR",
//       paymentMethod,
//       paymentOption,
//     } = req.body;

//     // Validation
//     if (!merchantId || !amount) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: merchantId, amount",
//       });
//     }

//     const amountNum = parseFloat(amount);
//     if (isNaN(amountNum)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid amount",
//       });
//     }

//     // Find merchant
//     const merchant = await User.findById(merchantId);
//     if (!merchant) {
//       return res.status(404).json({
//         success: false,
//         message: "Merchant not found",
//       });
//     }

//     // Find Active Connector Account
//     const activeAccount = await MerchantConnectorAccount.findOne({
//       merchantId: new mongoose.Types.ObjectId(merchantId),
//       isPrimary: true,
//       status: "Active",
//     })
//       .populate("connectorId")
//       .populate("connectorAccountId"); // Populating the reference to get global details if needed

//     if (!activeAccount) {
//       return res.status(404).json({
//         success: false,
//         message: "No active payment connector found",
//       });
//     }

//     const connectorName = activeAccount.connectorId?.name.toLowerCase();
//     // console.log("🎯 Using Connector:", connectorName);

//     // Extract keys using helper function
//     const integrationKeys = extractIntegrationKeys(activeAccount);
//     // console.log("🔑 Integration Keys Extracted:", {
//     //   keysCount: Object.keys(integrationKeys).length,
//     //   availableKeys: Object.keys(integrationKeys),
//     // });
//     const accountWithKeys = {
//       ...activeAccount.toObject(), // Convert mongoose document to plain object
//       extractedKeys: integrationKeys,
//     };
//     // Attach extracted keys to the account object for the generator functions
//     activeAccount.extractedKeys = integrationKeys;

//     let paymentResult;

//     if (connectorName === "cashfree") {
//       paymentResult = await generateCashfreePayment({
//         merchant,
//         amount: amountNum,
//         paymentMethod,
//         paymentOption,
//         connectorAccount: accountWithKeys,
//       });
//     } else if (connectorName === "enpay") {
//       paymentResult = await generateEnpayPayment({
//         merchant,
//         amount: amountNum,
//         paymentMethod,
//         paymentOption,
//         connectorAccount: accountWithKeys,
//       });
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Unsupported connector: " + connectorName,
//       });
//     }

//     // Create transaction record
//     const transactionData = {
//       transactionId: generateTransactionId(),
//       merchantOrderId: paymentResult.merchantOrderId,
//       merchantHashId: integrationKeys.merchantHashId,
//       // merchantHashId: merchant.mid,
//       // merchantVpa: `${merchant.mid?.toLowerCase()}@skypal`,
//       merchantVpa: integrationKeys.merchantVpa,
//       txnRefId: paymentResult.txnRefId,
//       shortLinkId: generateShortId(),

//       merchantId: merchant._id,
//       merchantName:
//         merchant.company || `${merchant.firstname} ${merchant.lastname || ""}`,
//       mid: merchant.mid,

//       amount: amountNum,
//       currency: currency,
//       status: "INITIATED",
//       paymentMethod: paymentMethod,
//       paymentOption: paymentOption,
//       paymentUrl: paymentResult.paymentLink,

//       connectorId: activeAccount.connectorId?._id,
//       connectorAccountId: activeAccount.connectorAccountId?._id,
//       connectorName: connectorName,
//       terminalId: activeAccount.terminalId || "N/A",

//       gatewayTransactionId: paymentResult.gatewayTransactionId,
//       gatewayPaymentLink: paymentResult.paymentLink,
//       gatewayOrderId: paymentResult.gatewayOrderId,

//       customerName: `${merchant.firstname} ${merchant.lastname || ""}`,
//       customerVpa: `${merchant.mid?.toLowerCase()}@skypal`,
//       customerContact: merchant.contact || "",
//       customerEmail: merchant.email || "",

//       txnNote: `Payment for ${merchant.company || merchant.firstname}`,
//       source: connectorName.toLowerCase(),
//     };

//     if (connectorName === "enpay") {
//       transactionData.enpayTxnId = paymentResult.enpayTxnId;
//     }

//     // Save transaction
//     const newTransaction = new Transaction(transactionData);
//     await newTransaction.save();

//     // console.log(
//     //   `✅ ${connectorName} payment link generated in ${
//     //     Date.now() - startTime
//     //   }ms`
//     // );

//     res.json({
//       success: true,
//       paymentLink: paymentResult.paymentLink,
//       transactionRefId: transactionData.transactionId,
//       txnRefId: transactionData.txnRefId,
//       connectorName,
//       message: `${connectorName} payment link generated successfully`,
//     });
//   } catch (error) {
//     console.error(`❌ Payment link generation failed:`, error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//       errorType: "GENERATION_ERROR",
//     });
//   }
// };

export const debugEnpayIntegrationKeys = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log(
    //   "🔍 DEEP DEBUG: Enpay Integration Keys for merchant:",
    //   merchantId
    // );

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Get active account with DEEP population
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    // Get fresh connector account data
    const connectorAccount = await ConnectorAccount.findById(
      activeAccount.connectorAccountId
    );

    res.json({
      success: true,
      debug: {
        merchant: {
          name: `${merchant.firstname} ${merchant.lastname || ""}`,
          mid: merchant.mid,
        },
        activeAccount: {
          _id: activeAccount._id,
          hasIntegrationKeys: !!activeAccount.integrationKeys,
          integrationKeys: activeAccount.integrationKeys,
          integrationKeysType: typeof activeAccount.integrationKeys,
        },
        connectorAccount: {
          _id: connectorAccount?._id,
          name: connectorAccount?.name,
          hasIntegrationKeys: !!connectorAccount?.integrationKeys,
          integrationKeys: connectorAccount?.integrationKeys,
          integrationKeysType: typeof connectorAccount?.integrationKeys,
        },
        recommendation:
          "Check which location has the integration keys and update the code accordingly",
      },
    });
  } catch (error) {
    console.error("❌ Deep debug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateEnpayPayment = async ({
  merchant,
  amount,
  paymentMethod,
  paymentOption,
  connectorAccount,
}) => {
  try {
    // console.log("🔹 Generating Enpay Payment", connectorAccount);

    // 1. Get Keys (Calculated in main function)
    const keys = connectorAccount.extractedKeys || {};

    const merchantKey = keys["X-Merchant-Key"];
    const merchantSecret = keys["X-Merchant-Secret"];
    const merchantHashId = keys["merchantHashId"];
    const merchantVpa = keys["merchantVpa"];

    // 2. Validate Keys
    if (!merchantKey || !merchantSecret || !merchantHashId || !merchantVpa) {
      console.error("❌ Missing Enpay Credentials. Found:", Object.keys(keys));
      throw new Error("No integration keys found for Enpay connector");
    }

    // 3. Prepare IDs
    const txnRefId = generateTxnRefId();
    const merchantOrderId = generateMerchantOrderId();
    const enpayTxnId = `ENP${Date.now()}`;

    // 4. Construct Payload (MATCHING POSTMAN EXACTLY)
    const requestData = {
      amount: String(amount.toFixed(2)), // Ensure string format "600.00"
      merchantHashId: merchantHashId,
      merchantOrderId: merchantOrderId,
      merchantTrnId: txnRefId,
      // ✅ FIXED: Use the EXACT VPA from your working Postman example
      merchantVpa: merchantVpa, // HARDCODE THE WORKING VPA
      returnURL: `${API_BASE_URL}/api/payment/return?transactionId=${txnRefId}`,
      successURL: `${API_BASE_URL}/api/payment/success?transactionId=${txnRefId}`,
      txnNote: `Payment for Order`,
    };

    // console.log("📤 Enpay Request Payload:", requestData);

    // 5. API Call
    const enpayResponse = await axios.post(
      "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest",
      requestData,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Merchant-Key": merchantKey,
          "X-Merchant-Secret": merchantSecret,
          Accept: "application/json",
        },
        timeout: 30000,
      }
    );

    // console.log("✅ Enpay API Response:", enpayResponse.data);

    // 6. Extract Link
    let paymentLink = "";
    if (enpayResponse.data && enpayResponse.data.details) {
      paymentLink = enpayResponse.data.details;
    } else if (enpayResponse.data && enpayResponse.data.paymentUrl) {
      paymentLink = enpayResponse.data.paymentUrl;
    } else {
      throw new Error("Enpay API response missing payment URL/details");
    }

    return {
      paymentLink: paymentLink,
      merchantOrderId: merchantOrderId,
      txnRefId: txnRefId,
      gatewayTransactionId: enpayTxnId,
      enpayTxnId: enpayTxnId,
      enpayResponse,
    };
  } catch (error) {
    console.error("❌ Enpay Error:", error.message);
    if (error.response) {
      console.error("Enpay API Response Data:", error.response.data);
      throw new Error(
        `Enpay Provider Error: ${
          error.response.data?.message || error.response.statusText
        }`
      );
    }
    throw error;
  }
};

export const generateRazorpayPayment = async ({
  merchant,
  amount,
  paymentMethod,
  paymentOption,
  connectorAccount,
}) => {
  try {
    const integrationKeys = connectorAccount.extractedKeys || {};

    const requiredKeys = ["key_id", "key_secret"];

    const missingKeys = requiredKeys.filter((key) => !integrationKeys[key]);

    if (missingKeys.length > 0) {
      console.error("Razorpay keys missing:", missingKeys);
      throw new Error(
        `Missing Razorpay credentials: ${missingKeys.join(", ")}`
      );
    }

    const razorpay = new Razorpay({
      key_id: integrationKeys.key_id,
      key_secret: integrationKeys.key_secret,
    });

    const txnRefId = generateTxnRefId();
    const merchantOrderId = generateMerchantOrderId();
    const razorpayTxnId = `RAZ${Date.now()}`;

    const expireBy = Math.floor(Date.now() / 1000) + 16 * 60; // 3 minutes from now

    const paymentLinkPayload = {
      upi_link: "true",
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      accept_partial: false,
      reference_id: txnRefId,
      description: `Payment for ${
        merchant.company || `${merchant.firstname} ${merchant.lastname || ""}`
      }`,
      expire_by: expireBy,
      customer: {
        name: `${merchant.firstname} ${merchant.lastname || ""}`,
        email: merchant.email || "",
        contact: merchant.contact || "",
      },

      notify: {
        sms: true,
        email: true,
      },

      reminder_enable: true,

      callback_url: `${FRONTEND_BASE_URL}/payment/success?transactionId=${txnRefId}`,
      callback_method: "get",
    };

    const razorpayResponse = await razorpay.paymentLink.create(
      paymentLinkPayload
    );

    return {
      paymentLink: razorpayResponse.short_url,
      merchantOrderId,
      txnRefId,
      gatewayTransactionId: razorpayResponse.id,
      razorPayTxnId: razorpayResponse.id,
      razorPayResponse: razorpayResponse,
    };
  } catch (error) {
    console.error("❌ Razorpay payment link error:", error?.error || error);

    throw new Error(
      error?.error?.description ||
        error?.message ||
        "Razorpay payment link generation failed"
    );
  }
};

// ✅ FIXED: CASHFREE PAYMENT GENERATION
// const generateCashfreePayment = async ({
//   merchant,
//   amount,
//   paymentMethod,
//   paymentOption,
//   connectorAccount,
// }) => {
//   try {
//     // console.log("🔗 Generating Cashfree Payment...", connectorAccount);

//     let integrationKeys = {};
//     // ✅ CRITICAL FIX: Better integration keys extraction
//     if (connectorAccount?.integrationKeys) {
//       if (connectorAccount.integrationKeys instanceof Map) {
//         integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
//       } else if (typeof connectorAccount.integrationKeys === "object") {
//         integrationKeys = { ...connectorAccount.integrationKeys };
//       } else if (typeof connectorAccount.integrationKeys === "string") {
//         try {
//           integrationKeys = JSON.parse(connectorAccount.integrationKeys);
//         } catch (e) {
//           console.error("❌ Failed to parse integrationKeys string:", e);
//         }
//       }
//     }

//     console.log("🔍 Cashfree Integration Keys:", Object.keys(integrationKeys));

//     // Extract credentials
//     const clientId =
//       integrationKeys["x-client-id"] ||
//       integrationKeys["client_id"] ||
//       integrationKeys["X-Client-Id"];
//     const clientSecret =
//       integrationKeys["x-client-secret"] ||
//       integrationKeys["client_secret"] ||
//       integrationKeys["X-Client-Secret"];
//     const apiVersion =
//       integrationKeys["x-api-version"] ||
//       integrationKeys["api_version"] ||
//       "2023-08-01";

//     // console.log("🔐 Cashfree Credentials Extracted:", {
//     //   clientId: clientId ? `${clientId.substring(0, 10)}...` : "MISSING",
//     //   clientSecret: clientSecret
//     //     ? `${clientSecret.substring(0, 10)}...`
//     //     : "MISSING",
//     //   apiVersion: apiVersion,
//     // });

//     if (!clientId || !clientSecret) {
//       throw new Error("Missing Cashfree credentials: Client ID or Secret");
//     }

//     // ✅ FIXED: ALWAYS USE PRODUCTION FOR LIVE CREDENTIALS
//     const cashfreeBaseURL = "https://api.cashfree.com/pg";
//     const paymentsBaseURL = "https://payments.cashfree.com/order";

//     // console.log("🎯 Using PRODUCTION Environment:", cashfreeBaseURL);
//     const returnUrl =
//       process.env.NODE_ENV === "production"
//         ? `https://pg-admin-backend.vercel.app/api/payment/cashfree/return`
//         : `${API_BASE_URL}/api/payment/cashfree/return`;

//     const notifyUrl =
//       process.env.NODE_ENV === "production"
//         ? `https://pg-admin-backend.vercel.app/api/payment/cashfree/webhook`
//         : `${API_BASE_URL}/api/payment/cashfree/webhook`;
//     // Generate order ID
//     const timestamp = Date.now();
//     const random = Math.floor(Math.random() * 1000);
//     const orderId = `order_${timestamp}_${random}`;

//     const orderAmount = parseFloat(amount);
//     if (isNaN(orderAmount) || orderAmount < 1) {
//       throw new Error("Invalid amount. Minimum is 1 INR");
//     }

//     // ✅ FIXED: Simplified payment methods
//     const getCashfreePaymentMethods = (method) => {
//       const methods = {
//         upi: "upi",
//         card: "cc,dc",
//         netbanking: "nb",
//         wallet: "wallet",
//       };
//       return methods[method] || "upi";
//     };

//     const cashfreeMethods = getCashfreePaymentMethods(paymentMethod);

//     // ✅ FIXED: Clean order data without extra fields
//     const requestData = {
//       order_amount: orderAmount.toFixed(2),
//       order_currency: "INR",
//       order_id: orderId,
//       customer_details: {
//         customer_id: merchant.mid || `cust_${timestamp}`,
//         customer_phone: merchant.contact || "9876543210",
//         customer_email: merchant.email || "customer@example.com",
//         customer_name:
//           `${merchant.firstname} ${merchant.lastname}`.trim() || "Customer",
//       },
//       order_meta: {
//         return_url: returnUrl,
//         notify_url: notifyUrl,
//         payment_methods: cashfreeMethods,
//       },
//     };

//     // console.log("📤 Cashfree API Request:", {
//     //   orderId: orderId,
//     //   amount: orderAmount,
//     //   methods: cashfreeMethods,
//     // });

//     // ✅ API CALL
//     let response;
//     try {
//       response = await axios.post(`${cashfreeBaseURL}/orders`, requestData, {
//         headers: {
//           "Content-Type": "application/json",
//           "x-client-id": clientId.trim(),
//           "x-client-secret": clientSecret.trim(),
//           "x-api-version": apiVersion,
//           Accept: "application/json",
//         },
//         timeout: 30000,
//       });

//       // console.log("✅ Cashfree API Response Status:", response.status);
//     } catch (apiError) {
//       console.error("❌ Cashfree API Call Failed:", apiError.message);

//       if (apiError.response) {
//         console.error("🔍 Cashfree API Error Details:", {
//           status: apiError.response.status,
//           data: apiError.response.data,
//         });

//         if (apiError.response.status === 401) {
//           throw new Error(
//             "Cashfree: Invalid credentials - Check Client ID/Secret"
//           );
//         } else if (apiError.response.status === 403) {
//           throw new Error("Cashfree: Account not activated or restricted");
//         } else if (apiError.response.data?.message) {
//           throw new Error(`Cashfree: ${apiError.response.data.message}`);
//         }
//       }

//       throw new Error(`Cashfree API call failed: ${apiError.message}`);
//     }

//     // ✅ VALIDATE RESPONSE
//     if (!response.data) {
//       throw new Error("Cashfree API returned empty response");
//     }

//     if (!response.data.payment_session_id) {
//       console.error("❌ No payment_session_id in response:", response.data);
//       throw new Error("Cashfree API did not return payment session ID");
//     }

//     // ✅ FIXED: Generate proper payment link
//     const paymentLink = `${paymentsBaseURL}/#${response.data.payment_session_id}`;

//     // console.log("🎯 Generated Payment Link Successfully");
//     // console.log(
//     //   "🔑 Payment Session ID:",
//     //   response.data.payment_session_id.substring(0, 30) + "..."
//     // );
//     // console.log("🔗 Full Payment Link:", paymentLink);

//     return {
//       paymentLink: paymentLink,
//       merchantOrderId: orderId,
//       txnRefId: `txn_${timestamp}_${random}`,
//       gatewayTransactionId: response.data.cf_order_id,
//       gatewayOrderId: response.data.order_id,
//       cfOrderId: response.data.cf_order_id,
//       cfPaymentLink: paymentLink,
//       paymentSessionId: response.data.payment_session_id,
//       environment: "production",
//     };
//   } catch (error) {
//     console.error("❌ Cashfree payment generation failed:", error);

//     // Improved error messages
//     if (error.message.includes("client session is invalid")) {
//       throw new Error(
//         "Cashfree: Session expired or invalid. Please try generating a new payment link."
//       );
//     } else if (
//       error.message.includes("Unauthorized") ||
//       error.message.includes("401")
//     ) {
//       throw new Error("Cashfree: Invalid Client ID or Secret");
//     }

//     throw new Error(`Cashfree payment failed: ${error.message}`);
//   }
// };

// const generateCashfreePayment = async ({
//   merchant,
//   amount,
//   paymentMethod,
//   paymentOption,
//   connectorAccount,
// }) => {
//   try {
//     console.log("🔗 Generating Cashfree Payment...", connectorAccount);

//     // 1. Get Keys (Calculated in main function)
//     const integrationKeys = connectorAccount.extractedKeys || {};

//     const clientId = integrationKeys["x-client-id"];
//     const clientSecret = integrationKeys["x-client-secret"];
//     const apiVersion = integrationKeys["x-api-version"];
//     const cashfreeBaseUrl = integrationKeys["cashfreeBaseUrl"];
//     // const paymentBaseUrl = integrationKeys["paymentBaseUrl"];

//     // 2. Validate Keys
//     if (!clientId || !clientSecret || !apiVersion || !cashfreeBaseUrl) {
//       console.error("❌ Missing Enpay Credentials. Found:", Object.keys(keys));
//       return res.status(400).json({
//         success: false,
//         message: "Integration keys missing for Cashfree connector",
//       });
//     }

//     console.log(
//       "🎯 Using PRODUCTION Environment:",
//       FRONTEND_BASE_URL,
//       API_BASE_URL
//     );
//     const returnUrl = `${FRONTEND_BASE_URL}/payment-success`;

//     const notifyUrl = `${API_BASE_URL}/api/payment/cashfree/webhook`;
//     // Generate order ID
//     const random = Math.floor(Math.random() * 1000);
//     const timestamp = Date.now();
//     const orderId = `order_${timestamp}_${random}`;

//     const txnRefId = generateTxnRefId();

//     // ✅ FIXED: Simplified payment methods
//     const getCashfreePaymentMethods = (method) => {
//       const methods = {
//         upi: "upi",
//         card: "cc,dc",
//         netbanking: "nb",
//         wallet: "wallet",
//       };
//       return methods[method] || "upi";
//     };

//     const cashfreeMethods = getCashfreePaymentMethods(paymentMethod);

//     // ✅ FIXED: Clean order data without extra fields
//     const requestData = {
//       order_id: orderId,
//       order_amount: Number(Number(amount).toFixed(2)),
//       order_currency: "INR",
//       customer_details: {
//         customer_id: merchant.mid || `cust_${timestamp}`,
//         customer_phone: merchant.contact || "",
//         customer_email: merchant.email || "",
//         customer_name:
//           `${merchant.firstname} ${merchant.lastname}`.trim() || "",
//       },
//       order_meta: {
//         return_url: returnUrl,
//         notify_url: notifyUrl,
//         payment_methods: cashfreeMethods,
//       },
//     };

//     console.log("📤 Cashfree API Request:", {
//       orderId: orderId,
//       amount: amount,
//       methods: cashfreeMethods,
//     });

//     // ✅ API CALL
//     let response;
//     try {
//       response = await axios.post(`${cashfreeBaseUrl}/links`, requestData, {
//         headers: {
//           "Content-Type": "application/json",
//           "x-client-id": clientId.trim(),
//           "x-client-secret": clientSecret.trim(),
//           "x-api-version": apiVersion,
//           Accept: "application/json",
//         },
//         timeout: 30000,
//       });

//       // console.log("✅ Cashfree API Response Status:", response.status);
//     } catch (apiError) {
//       console.error("❌ Cashfree API Call Failed:", apiError.message);

//       if (apiError.response) {
//         console.error("🔍 Cashfree API Error Details:", {
//           status: apiError.response.status,
//           data: apiError.response.data,
//         });

//         if (apiError.response.status === 401) {
//           throw new Error(
//             "Cashfree: Invalid credentials - Check Client ID/Secret"
//           );
//         } else if (apiError.response.status === 403) {
//           throw new Error("Cashfree: Account not activated or restricted");
//         } else if (apiError.response.data?.message) {
//           throw new Error(`Cashfree: ${apiError.response.data.message}`);
//         }
//       }

//       throw new Error(`Cashfree API call failed: ${apiError.message}`);
//     }

//     // ✅ VALIDATE RESPONSE
//     if (!response.data) {
//       throw new Error("Cashfree API returned empty response");
//     }

//     if (!response.data.payment_session_id) {
//       console.error("❌ No payment_session_id in response:", response.data);
//       throw new Error("Cashfree API did not return payment session ID");
//     }

//     // ✅ FIXED: Generate proper payment link
//     const paymentLink = `${paymentsBaseURL}/#${response.data.payment_session_id}`;

//     // console.log("🎯 Generated Payment Link Successfully");
//     // console.log(
//     //   "🔑 Payment Session ID:",
//     //   response.data.payment_session_id.substring(0, 30) + "..."
//     // );
//     // console.log("🔗 Full Payment Link:", paymentLink);

//     return {
//       paymentLink: paymentLink,
//       merchantOrderId: orderId,
//       txnRefId: `txn_${timestamp}_${random}`,
//       gatewayTransactionId: response.data.cf_order_id,
//       gatewayOrderId: response.data.order_id,
//       cfOrderId: response.data.cf_order_id,
//       cfPaymentLink: paymentLink,
//       paymentSessionId: response.data.payment_session_id,
//       environment: "production",
//     };
//   } catch (error) {
//     console.error("❌ Cashfree payment generation failed:", error);

//     // Improved error messages
//     if (error.message.includes("client session is invalid")) {
//       throw new Error(
//         "Cashfree: Session expired or invalid. Please try generating a new payment link."
//       );
//     } else if (
//       error.message.includes("Unauthorized") ||
//       error.message.includes("401")
//     ) {
//       throw new Error("Cashfree: Invalid Client ID or Secret");
//     }

//     throw new Error(`Cashfree payment failed: ${error.message}`);
//   }
// };

const generateCashfreePayment = async ({
  merchant,
  amount,
  paymentMethod,
  paymentOption,
  connectorAccount,
}) => {
  try {
    console.log(
      "🔗 Generating Cashfree Payment...",
      FRONTEND_BASE_URL,
      API_BASE_URL
    );
    // 1. Extract keys
    const integrationKeys = connectorAccount.extractedKeys || {};
    const clientId = integrationKeys["x-client-id"];
    const clientSecret = integrationKeys["x-client-secret"];
    const apiVersion = integrationKeys["x-api-version"];
    const cashfreeBaseUrl = integrationKeys["cashfreeBaseUrl"];

    if (!clientId || !clientSecret || !apiVersion || !cashfreeBaseUrl) {
      throw new Error("Integration keys missing for Cashfree connector");
    }

    // 2. Build unique link ID
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const linkId = `lnk_${timestamp}_${randomNum}`;

    // 3. Map payment methods for Cashfree (optional)
    const getCashfreeMethods = (method) => {
      const map = {
        upi: "upi",
        card: "cc,dc",
        netbanking: "nb",
        wallet: "wallet",
      };
      return map[method] || "upi";
    };
    const paymentMethods = getCashfreeMethods(paymentMethod);

    // 4. Build request payload for Payment Links
    const body = {
      link_id: linkId,
      link_amount: Number(amount.toFixed(2)),
      link_currency: "INR",
      link_purpose: `Payment for ${merchant.company || merchant.firstname}`,
      customer_details: {
        customer_name: `${merchant.firstname || ""} ${
          merchant.lastname || ""
        }`.trim(),
        customer_phone: merchant.contact || "",
        customer_email: merchant.email || "",
      },
      // optional:
      link_meta: {
        return_url: `${FRONTEND_BASE_URL}/payment-success`,
        notify_url: `${API_BASE_URL}/api/payment/cashfree/webhook`,
        payment_methods: paymentMethods,
      },
      link_notify: {
        send_sms: true,
        send_email: true,
      },
      // optionally set expiry, partial payments, notes etc.
    };

    console.log("📤 Cashfree Link Request:", body);

    // 5. Call Cashfree Link API
    const response = await axios.post(`${cashfreeBaseUrl}/links`, body, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId.trim(),
        "x-client-secret": clientSecret.trim(),
        "x-api-version": apiVersion,
        Accept: "application/json",
        // you can add x-idempotency-key if needed
        // "x-idempotency-key": uniqueKey,
      },
      timeout: 30000,
    });

    console.log(response, "CASHFREE");

    const data = response.data;
    // 6. Validate response
    if (!data || !data.link_url) {
      console.error("❌ Missing link_url:", data);
      throw new Error("Cashfree did not return payment link URL");
    }

    // 7. Return structured result
    return {
      paymentLink: data.link_url,
      merchantOrderId: linkId, // use linkId for tracking
      txnRefId: `txn_${timestamp}_${randomNum}`,
      gatewayTransactionId: data.cf_link_id,
      gatewayOrderId: data.link_id,
      cfLinkId: data.cf_link_id,
      environment: "production",
    };
  } catch (error) {
    console.error("❌ Cashfree payment generation failed:", error);
    if (error.response?.data?.message) {
      throw new Error(`Cashfree: ${error.response.data.message}`);
    }
    throw new Error(`Cashfree payment failed: ${error.message}`);
  }
};

// Add this route to get transaction by shortLinkId
export const getTransactionByShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;

    // console.log("🔍 Fetching transaction for shortLinkId:", shortLinkId);

    const transaction = await Transaction.findOne({ shortLinkId: shortLinkId });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
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
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching transaction:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transaction",
      error: error.message,
    });
  }
};

export const handleSuccess = async (req, res) => {
  try {
    const { transactionId } = req.query;
    // console.log("✅ Success callback for:", transactionId);

    if (transactionId) {
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: "SUCCESS", updatedAt: new Date() }
      );
    }

    res.redirect(
      `${FRONTEND_BASE_URL}/payment-success?status=success&transactionRefId=${
        transactionId || ""
      }`
    );
  } catch (error) {
    console.error("Success callback error:", error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=error`);
  }
};

export const handleReturn = async (req, res) => {
  try {
    const { transactionId, status } = req.query;
    // console.log("↩️ Return callback for:", transactionId, "status:", status);

    if (transactionId) {
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: status || "FAILED", updatedAt: new Date() }
      );
    }

    res.redirect(
      `${FRONTEND_BASE_URL}/payment-return?status=${
        status || "failed"
      }&transactionRefId=${transactionId || ""}`
    );
  } catch (error) {
    console.error("Return callback error:", error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error`);
  }
};

export const getMerchantConnectors = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🔍 Fetching connector accounts for merchant:", merchantId);

    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID",
      });
    }

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // console.log("🔄 Fetching connector accounts from database...");

    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name connectorType description")
      .populate(
        "connectorAccountId",
        "name currency integrationKeys terminalId"
      )
      .select("terminalId industry percentage isPrimary status createdAt")
      .sort({ isPrimary: -1, createdAt: -1 });

    // console.log(
    //   `✅ Found ${connectorAccounts.length} connector accounts for merchant: ${merchant.firstname} ${merchant.lastname}`
    // );

    const formattedAccounts = connectorAccounts.map((account) => {
      const connector = account.connectorId || {};
      const connectorAcc = account.connectorAccountId || {};

      return {
        _id: account._id,
        terminalId: account.terminalId || connectorAcc.terminalId || "N/A",
        connector: connector.name || "Unknown",
        connectorName: connector.name || "Unknown",
        connectorType: connector.connectorType || "Payment",
        assignedAccount: connectorAcc.name || "Unknown",
        accountName: connectorAcc.name || "Unknown",
        currency: connectorAcc.currency || "INR",
        industry: account.industry || "General",
        percentage: account.percentage || 100,
        isPrimary: account.isPrimary || false,
        status: account.status || "Active",
        integrationKeys: connectorAcc.integrationKeys || {},
        createdAt: account.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedAccounts,
      merchantInfo: {
        name: `${merchant.firstname} ${merchant.lastname || ""}`,
        mid: merchant.mid,
        email: merchant.email,
      },
    });
  } catch (error) {
    console.error(
      "❌ Error fetching merchant connectors from database:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Server error while fetching connector accounts from database",
      error: error.message,
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
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // 15 minutes
    });

    if (!transaction) {
      return res.json({
        valid: false,
        message: "Payment session expired or invalid",
      });
    }

    res.json({
      valid: true,
      transactionId: transaction.transactionId,
      amount: transaction.amount,
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
      status: "Active",
    })
      .populate("connectorId")
      .populate("connectorAccountId")
      .select("+integrationKeys"); // ✅ IMPORTANT: Include integrationKeys

    // console.log("🔍 Active Account Found:", {
    //   found: !!activeAccount,
    //   accountId: activeAccount?._id,
    //   connectorName: activeAccount?.connectorId?.name,
    //   // ✅ Check the correct location for integrationKeys
    //   hasIntegrationKeys: !!activeAccount?.integrationKeys,
    //   integrationKeys: activeAccount?.integrationKeys,
    // });
    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active payment connector found",
      });
    }

    const connectorAccount = await ConnectorAccount.findById(
      activeAccount.connectorAccountId
    ).lean();
    if (!connectorAccount) {
      return res.status(404).json({
        success: false,
        message: "Connector account not found",
      });
    }

    // console.log("🔍 Fresh Connector Account Data:", {
    //   name: connectorAccount.name,
    //   integrationKeysType: typeof connectorAccount.integrationKeys,
    //   integrationKeysCount: connectorAccount.integrationKeys
    //     ? Object.keys(connectorAccount.integrationKeys).length
    //     : 0,
    // });
    const integrationKeys = connectorAccount?.integrationKeys || {};

    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === "object") {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject["x-client-id"] || keysObject["client_id"];

    // Check if credentials are for test or production
    const isTestCredentials = clientId && clientId.startsWith("TEST");
    const isLiveCredentials = clientId && !clientId.startsWith("TEST");

    res.json({
      success: true,
      environment: {
        usingProductionAPI: true,
        credentialsType: isTestCredentials
          ? "TEST"
          : isLiveCredentials
          ? "LIVE"
          : "UNKNOWN",
        clientId: clientId ? `${clientId.substring(0, 15)}...` : "Not Found",
        recommendedAction: isTestCredentials
          ? "Use TEST environment: https://sandbox.cashfree.com"
          : "Credentials match production environment",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this debug function
export const debugIntegrationKeys = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log(
    //   "🔍 DEBUG: Checking integration keys for merchant:",
    //   merchantId
    // );

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Get active account with proper population
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId")
      .populate("connectorAccountId")
      .lean();

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    // Get fresh connector account data
    const connectorAccount = await ConnectorAccount.findById(
      activeAccount.connectorAccountId
    ).lean();

    let integrationKeys = {};
    let keysSource = "unknown";

    if (connectorAccount?.integrationKeys) {
      if (connectorAccount.integrationKeys instanceof Map) {
        integrationKeys = Object.fromEntries(connectorAccount.integrationKeys);
        keysSource = "map";
      } else if (typeof connectorAccount.integrationKeys === "object") {
        integrationKeys = { ...connectorAccount.integrationKeys };
        keysSource = "object";
      } else if (typeof connectorAccount.integrationKeys === "string") {
        try {
          integrationKeys = JSON.parse(connectorAccount.integrationKeys);
          keysSource = "string_json";
        } catch (e) {
          integrationKeys = { raw_string: connectorAccount.integrationKeys };
          keysSource = "string_raw";
        }
      }
    }

    const clientId =
      integrationKeys["x-client-id"] ||
      integrationKeys["client_id"] ||
      integrationKeys["X-Client-Id"];
    const isTest = clientId && clientId.startsWith("TEST");
    const isLive = clientId && !clientId.startsWith("TEST");

    res.json({
      success: true,
      debug: {
        merchant: {
          name: `${merchant.firstname} ${merchant.lastname}`,
          mid: merchant.mid,
        },
        connector: {
          name: activeAccount.connectorId?.name,
          account: connectorAccount?.name,
        },
        integrationKeys: {
          source: keysSource,
          rawType: typeof connectorAccount?.integrationKeys,
          isMap: connectorAccount?.integrationKeys instanceof Map,
          extractedType: typeof integrationKeys,
          keysCount: Object.keys(integrationKeys).length,
          allKeys: Object.keys(integrationKeys),
          values: integrationKeys,
        },
        credentials: {
          clientId: clientId ? `${clientId.substring(0, 15)}...` : "NOT FOUND",
          clientSecret: integrationKeys["x-client-secret"]
            ? "PRESENT"
            : "MISSING",
          environment: isTest ? "SANDBOX" : isLive ? "PRODUCTION" : "UNKNOWN",
          isTest: isTest,
          isLive: isLive,
        },
        recommendation: isTest
          ? "⚠️ Using TEST credentials - Switch to LIVE for production"
          : isLive
          ? "✅ Using LIVE credentials - Transactions should appear in production dashboard"
          : "❓ Cannot determine environment",
      },
    });
  } catch (error) {
    console.error("❌ Integration keys debug error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const testCashfreeConnectionEnhanced = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🧪 Enhanced Cashfree Test for merchant:", merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === "object") {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject["x-client-id"] || keysObject["client_id"];
    const clientSecret =
      keysObject["x-client-secret"] || keysObject["client_secret"];
    const apiVersion =
      keysObject["x-api-version"] || keysObject["api_version"] || "2023-08-01";

    // Determine environment
    const isTestMode = clientId && clientId.startsWith("TEST");
    const cashfreeBaseURL = isTestMode
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    // console.log("🔍 Cashfree Environment Check:", {
    //   clientId: clientId ? `${clientId.substring(0, 15)}...` : "MISSING",
    //   environment: isTestMode ? "SANDBOX" : "PRODUCTION",
    //   baseURL: cashfreeBaseURL,
    // });

    if (!clientId || !clientSecret) {
      return res.json({
        success: false,
        message: "Missing Cashfree credentials",
        debug: {
          availableKeys: Object.keys(keysObject),
          integrationKeys: keysObject,
        },
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
        customer_name: "Test Customer",
      },
      order_meta: {
        return_url: "https://example.com/return",
        notify_url: "https://example.com/webhook",
        payment_methods: "cc,dc,upi",
      },
      order_note: "Test payment connection",
    };

    // console.log("📤 Testing Cashfree API with:", {
    //   url: `${cashfreeBaseURL}/orders`,
    //   environment: isTestMode ? "SANDBOX" : "PRODUCTION",
    // });

    const testResponse = await axios.post(
      `${cashfreeBaseURL}/orders`,
      testOrderData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId.trim(),
          "x-client-secret": clientSecret.trim(),
          "x-api-version": apiVersion,
        },
        timeout: 15000,
      }
    );

    // console.log("✅ Cashfree Test Response:", testResponse.data);

    if (testResponse.data && testResponse.data.payment_session_id) {
      const paymentsBaseURL = isTestMode
        ? "https://sandbox.cashfree.com/order"
        : "https://payments.cashfree.com/order";

      const paymentLink = `${paymentsBaseURL}/#${testResponse.data.payment_session_id}`;

      res.json({
        success: true,
        message: `Cashfree ${
          isTestMode ? "Sandbox" : "Production"
        } connection successful!`,
        paymentLink: paymentLink,
        environment: isTestMode ? "sandbox" : "production",
        orderId: testResponse.data.order_id,
        cfOrderId: testResponse.data.cf_order_id,
        paymentSessionId: testResponse.data.payment_session_id,
        debug: {
          credentialsType: isTestMode ? "TEST" : "LIVE",
          baseURLUsed: cashfreeBaseURL,
        },
      });
    } else {
      res.json({
        success: false,
        message: "Cashfree API response missing payment session",
        response: testResponse.data,
      });
    }
  } catch (error) {
    console.error("❌ Enhanced Cashfree test failed:", error);

    let errorMessage = "Cashfree connection test failed";
    let errorDetails = {};

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      };

      if (error.response.status === 401) {
        errorMessage =
          "Invalid Cashfree credentials (Unauthorized) - Check Client ID/Secret";
      } else if (error.response.status === 403) {
        errorMessage = "Cashfree account not activated or restricted";
      } else if (error.response.status === 400) {
        errorMessage = `Bad request to Cashfree API: ${error.response.data?.message}`;
      } else if (error.response.status === 404) {
        errorMessage =
          "Cashfree API endpoint not found - check environment (sandbox vs production)";
      }
    }

    res.json({
      success: false,
      message: errorMessage,
      error: errorDetails,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Cashfree Return URL Handler
// Cashfree Return URL Handler
export const handleCashfreeReturn = async (req, res) => {
  try {
    const { order_id, order_status, payment_status, reference_id } = req.query;

    // console.log("🔁 Cashfree Return Callback:", {
    //   order_id,
    //   order_status,
    //   payment_status,
    //   reference_id,
    // });

    // Update transaction status
    if (order_id) {
      const transaction = await Transaction.findOne({
        $or: [
          { merchantOrderId: order_id },
          { gatewayOrderId: order_id },
          { cfOrderId: order_id },
        ],
      });

      if (transaction) {
        let status = "PENDING";
        if (order_status === "PAID") status = "SUCCESS";
        else if (order_status === "EXPIRED") status = "FAILED";

        await Transaction.findOneAndUpdate(
          { _id: transaction._id },
          {
            status: status,
            updatedAt: new Date(),
            gatewayTransactionId:
              reference_id || transaction.gatewayTransactionId,
          }
        );

        // console.log(
        //   `✅ Transaction ${transaction.transactionId} updated to: ${status}`
        // );
      }
    }

    // Use HTTPS for frontend redirect in production
    const frontendBaseUrl =
      process.env.NODE_ENV === "production"
        ? "https://your-frontend-domain.com"
        : FRONTEND_BASE_URL;

    res.redirect(
      `${frontendBaseUrl}/payment-success?status=${
        order_status === "PAID" ? "success" : "failed"
      }&transactionRefId=${order_id || ""}`
    );
  } catch (error) {
    console.error("❌ Cashfree return handler error:", error);
    const frontendBaseUrl =
      process.env.NODE_ENV === "production"
        ? "https://your-frontend-domain.com"
        : FRONTEND_BASE_URL;
    res.redirect(`${frontendBaseUrl}/payment-return?status=error`);
  }
};

// Cashfree Webhook Handler
export const handleCashfreeWebhook = async (req, res) => {
  try {
    const webhookData = req.body;

    // console.log("📩 Cashfree Webhook Received:", webhookData);

    const { data, type } = webhookData;

    if (type === "TRANSACTION_STATUS" && data) {
      const { orderId, referenceId, txStatus, txMsg, paymentMode, txTime } =
        data;

      let status = "PENDING";
      if (txStatus === "SUCCESS") status = "SUCCESS";
      else if (txStatus === "FAILED") status = "FAILED";
      else if (txStatus === "USER_DROPPED") status = "CANCELLED";

      // Update transaction in database
      await Transaction.findOneAndUpdate(
        {
          $or: [
            { merchantOrderId: orderId },
            { gatewayOrderId: orderId },
            { cfOrderId: orderId },
          ],
        },
        {
          status: status,
          gatewayTransactionId: referenceId,
          paymentMethod: paymentMode,
          updatedAt: new Date(),
          ...(txStatus === "SUCCESS" && { settledAt: new Date(txTime) }),
        }
      );

      // console.log(`✅ Webhook: Order ${orderId} updated to ${status}`);
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("❌ Cashfree webhook error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this to your paymentLinkController.js
// Add this debug function to check environment
export const debugCashfreeSetup = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🔍 DEBUG: Checking Cashfree setup for merchant:", merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (typeof integrationKeys === "object") {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject["x-client-id"] || keysObject["client_id"];
    const clientSecret =
      keysObject["x-client-secret"] || keysObject["client_secret"];

    const isTestCredentials = clientId && clientId.startsWith("TEST");
    const isLiveCredentials = clientId && !clientId.startsWith("TEST");

    res.json({
      success: true,
      merchant: {
        id: merchant._id,
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
      },
      connector: {
        name: activeAccount.connectorId?.name,
        account: connectorAccount?.name,
        terminalId: activeAccount.terminalId,
      },
      credentials: {
        clientId: clientId ? `${clientId.substring(0, 15)}...` : "NOT FOUND",
        clientSecret: clientSecret
          ? `${clientSecret.substring(0, 10)}...`
          : "NOT FOUND",
        type: isTestCredentials
          ? "TEST"
          : isLiveCredentials
          ? "LIVE"
          : "UNKNOWN",
        environment: process.env.NODE_ENV || "development",
      },
      urls: {
        apiBase: process.env.API_BASE_URL,
        frontendBase: process.env.FRONTEND_URL,
      },
      recommendation: isTestCredentials
        ? "⚠️ Switch to LIVE credentials for production"
        : "✅ Using LIVE credentials for production",
    });
  } catch (error) {
    console.error("❌ Cashfree debug setup error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const testCashfreeConnection = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🧪 Testing Cashfree connection for merchant:", merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    // Convert to plain object
    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (
      typeof integrationKeys === "object" &&
      integrationKeys !== null
    ) {
      keysObject = { ...integrationKeys };
    }

    const clientId = keysObject["x-client-id"] || keysObject["client_id"];
    const clientSecret =
      keysObject["x-client-secret"] || keysObject["client_secret"];
    const apiVersion =
      keysObject["x-api-version"] || keysObject["api_version"] || "2023-08-01";

    // console.log("🔍 Cashfree Credentials Found:", {
    //   clientId: clientId ? "PRESENT" : "MISSING",
    //   clientSecret: clientSecret ? "PRESENT" : "MISSING",
    //   apiVersion: apiVersion,
    //   allKeys: Object.keys(keysObject),
    // });

    if (!clientId || !clientSecret) {
      return res.json({
        success: false,
        message: "Missing Cashfree credentials",
        missing: {
          clientId: !clientId,
          clientSecret: !clientSecret,
        },
        availableKeys: Object.keys(keysObject),
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
        customer_name: "Test Customer",
      },
    };

    // console.log("📤 Testing Cashfree API with data:", testOrderData);

    const testResponse = await axios.post(
      "https://api.cashfree.com/pg/orders",
      testOrderData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId.trim(),
          "x-client-secret": clientSecret.trim(),
          "x-api-version": apiVersion,
        },
        timeout: 15000,
      }
    );

    // console.log("✅ Cashfree Test Response:", testResponse.data);

    if (testResponse.data && testResponse.data.payment_session_id) {
      const paymentLink = `https://payments.cashfree.com/order/#${testResponse.data.payment_session_id}`;

      res.json({
        success: true,
        message: "Cashfree connection test successful!",
        paymentLink: paymentLink,
        orderId: testResponse.data.order_id,
        cfOrderId: testResponse.data.cf_order_id,
        paymentSessionId: testResponse.data.payment_session_id,
        credentials: {
          clientId: `${clientId.substring(0, 10)}...`,
          clientSecret: `${clientSecret.substring(0, 10)}...`,
          apiVersion: apiVersion,
        },
      });
    } else {
      res.json({
        success: false,
        message: "Cashfree API response missing payment session",
        response: testResponse.data,
      });
    }
  } catch (error) {
    console.error("❌ Cashfree connection test failed:", error);

    let errorMessage = "Cashfree connection test failed";
    let errorDetails = {};

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      };

      if (error.response.status === 401) {
        errorMessage = "Invalid Cashfree credentials (Unauthorized)";
      } else if (error.response.status === 403) {
        errorMessage = "Cashfree account not activated or restricted";
      } else if (error.response.status === 400) {
        errorMessage = "Bad request to Cashfree API";
      }
    } else if (error.code === "ECONNABORTED") {
      errorMessage = "Cashfree API timeout";
    } else {
      errorMessage = error.message;
    }

    res.json({
      success: false,
      message: errorMessage,
      error: errorDetails,
      stack: error.stack,
    });
  }
};

export const debugCashfreeCredentials = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🔍 Debugging Cashfree credentials for merchant:", merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;

    const integrationKeys = connectorAccount?.integrationKeys || {};

    let keysObject = {};
    if (integrationKeys instanceof Map) {
      keysObject = Object.fromEntries(integrationKeys);
    } else if (
      typeof integrationKeys === "object" &&
      integrationKeys !== null
    ) {
      keysObject = { ...integrationKeys };
    }

    // console.log("🔍 Raw Integration Keys:", integrationKeys);
    // console.log("🔍 Processed Keys Object:", keysObject);
    // console.log("🔍 Keys Object Type:", typeof keysObject);
    // console.log("🔍 Keys Object Keys:", Object.keys(keysObject));

    const clientId =
      keysObject["x-client-id"] ||
      keysObject["x_client_id"] ||
      keysObject["client_id"];
    const clientSecret =
      keysObject["x-client-secret"] ||
      keysObject["x_client_secret"] ||
      keysObject["client_secret"];
    const apiVersion =
      keysObject["x-api-version"] ||
      keysObject["x_api_version"] ||
      keysObject["api_version"];

    res.json({
      success: true,
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
        email: merchant.email,
      },
      connector: {
        name: activeAccount.connectorId?.name,
        terminalId: activeAccount.terminalId,
      },
      credentials: {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasApiVersion: !!apiVersion,
        clientId: clientId ? `${clientId.substring(0, 10)}...` : "Not Found",
        clientSecret: clientSecret
          ? `${clientSecret.substring(0, 10)}...`
          : "Not Found",
        apiVersion: apiVersion || "Not Found",
      },
      allIntegrationKeys: Object.keys(keysObject),
      integrationKeys: keysObject,
      debug: {
        rawIntegrationKeysType: typeof integrationKeys,
        isMap: integrationKeys instanceof Map,
        connectorAccountId: connectorAccount?._id,
      },
    });
  } catch (error) {
    console.error("❌ Cashfree debug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Enpay Payment Generation

// Add this to your controller
export const debugCurrentEnpayCredentials = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log(
    //   "🔍 DEBUG: Checking current Enpay credentials for merchant:",
    //   merchantId
    // );

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    // console.log("🔍 CURRENT CREDENTIALS IN DATABASE:", integrationKeys);

    res.json({
      success: true,
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
      },
      connector: {
        name: activeAccount.connectorId?.name,
        terminalId: activeAccount.terminalId,
      },
      credentials: {
        merchantKey: integrationKeys["X-Merchant-Key"],
        merchantSecret: integrationKeys["X-Merchant-Secret"]
          ? "***" + integrationKeys["X-Merchant-Secret"].slice(-4)
          : "MISSING",
        merchantHashId: integrationKeys["merchantHashId"],
        baseUrl: integrationKeys["baseUrl"],
      },
      matchWithCorrect: {
        merchantKey:
          integrationKeys["X-Merchant-Key"] ===
          "0851439b-03df-4983-88d6-32399b1e4514",
        merchantHashId:
          integrationKeys["merchantHashId"] === "MERCDSH51Y7CD4YJLFIZR8NF",
      },
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Test endpoint
export const testEnpayConnection = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🧪 Testing Enpay connection for merchant:", merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
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
      txnnNote: "Test payment",
    };

    // console.log("📤 Testing with credentials:", {
    //   merchantKey: integrationKeys["X-Merchant-Key"] ? "PRESENT" : "MISSING",
    //   merchantSecret: integrationKeys["X-Merchant-Secret"]
    //     ? "PRESENT"
    //     : "MISSING",
    //   merchantHashId: integrationKeys.merchantHashId,
    // });

    const enpayResponse = await axios.post(
      "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest",
      testData,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Merchant-Key": integrationKeys["X-Merchant-Key"],
          "X-Merchant-Secret": integrationKeys["X-Merchant-Secret"],
          Accept: "application/json",
        },
        timeout: 30000,
      }
    );

    // console.log("✅ Enpay API Success:", enpayResponse.data);

    res.json({
      success: true,
      message: "Enpay connection test successful!",
      paymentLink: enpayResponse.data.details || enpayResponse.data.paymentUrl,
      debug: {
        credentialsUsed: {
          merchantKey: integrationKeys["X-Merchant-Key"]
            ? `${integrationKeys["X-Merchant-Key"].substring(0, 10)}...`
            : "MISSING",
          merchantHashId: integrationKeys.merchantHashId,
        },
      },
    });
  } catch (error) {
    console.error("❌ Enpay connection test failed:", error);

    let errorMessage = "Enpay connection test failed";
    let errorDetails = {};

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        data: error.response.data,
      };

      if (error.response.status === 401) {
        errorMessage =
          "Invalid Enpay credentials (Unauthorized) - Check Merchant Key/Secret";
      } else if (error.response.status === 400) {
        errorMessage = `Bad request to Enpay API: ${error.response.data?.message}`;
      }
    }

    res.json({
      success: false,
      message: errorMessage,
      error: errorDetails,
    });
  }
};

export const testEnpayDirect = async (req, res) => {
  try {
    // console.log("🧪 TEST: Enhanced Direct Enpay Connection");

    const connectorAccount = await ConnectorAccount.findOne({ name: "enpay" });
    if (!connectorAccount) {
      return res.json({
        success: false,
        message: "Enpay connector account not found",
      });
    }

    const integrationKeys = connectorAccount.integrationKeys || {};

    // console.log("🔐 Credentials Check:", {
    //   hasMerchantKey: !!integrationKeys["X-Merchant-Key"],
    //   hasMerchantSecret: !!integrationKeys["X-Merchant-Secret"],
    //   hasMerchantHashId: !!integrationKeys["merchantHashId"],
    //   merchantKeyLength: integrationKeys["X-Merchant-Key"]?.length,
    //   merchantSecretLength: integrationKeys["X-Merchant-Secret"]?.length,
    // });

    // Test data
    const testData = {
      amount: "1000.00",
      merchantHashId: integrationKeys.merchantHashId,
      merchantOrderId: `TEST${Date.now()}`,
      merchantTxnId: `TXNTEST${Date.now()}`,
      merchantVpa: "test@fino",
      returnURL: "https://example.com/return",
      successURL: "https://example.com/success",
      txnnNote: "Test payment",
    };

    // console.log("📤 Calling Enpay API with headers:", {
    //   "X-Merchant-Key": integrationKeys["X-Merchant-Key"]
    //     ? "PRESENT"
    //     : "MISSING",
    //   "X-Merchant-Secret": integrationKeys["X-Merchant-Secret"]
    //     ? "PRESENT"
    //     : "MISSING",
    // });

    const enpayResponse = await axios.post(
      "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest",
      testData,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Merchant-Key": integrationKeys["X-Merchant-Key"],
          "X-Merchant-Secret": integrationKeys["X-Merchant-Secret"],
          Accept: "application/json",
        },
        timeout: 30000,
      }
    );

    // console.log("✅ Enpay API Success:", enpayResponse.data);

    res.json({
      success: true,
      message: "Direct Enpay test successful!",
      paymentLink: enpayResponse.data.details || enpayResponse.data.paymentUrl,
      debug: {
        credentialsValid: true,
        headersSent: true,
      },
    });
  } catch (error) {
    console.error("❌ Enhanced Test failed:", error);

    let errorDetails = {
      message: error.message,
    };

    if (error.response) {
      errorDetails = {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      };
      console.error("🔍 Full error response:", errorDetails);
    }

    res.json({
      success: false,
      error: "Enpay API call failed",
      details: errorDetails,
    });
  }
};

// Process Short Link
export const processShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    // console.log("🔄 Process route called for shortLinkId:", shortLinkId);

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
            <p>Session created: ${new Date(
              transaction.createdAt
            ).toLocaleString()}</p>
          </body>
        </html>
      `);
    }

    // console.log(
    //   "✅ Transaction found, redirecting to:",
    //   transaction.paymentUrl
    // );

    // Update status and redirect
    await Transaction.findOneAndUpdate(
      { shortLinkId: shortLinkId },
      {
        status: "REDIRECTED",
        redirectedAt: new Date(),
      }
    );

    // ✅ IMMEDIATE REDIRECT
    res.redirect(302, transaction.paymentUrl);
  } catch (error) {
    console.error("🔥 ERROR in process route:", error);
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

    // console.log(
    //   "🔍 DEBUG: Checking connector account for merchant:",
    //   merchantId
    // );

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // console.log("✅ Merchant found:", merchant.firstname, merchant.lastname);

    // Check connector accounts
    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId")
      .populate("connectorAccountId");

    // console.log(`🔍 Found ${connectorAccounts.length} connector accounts`);

    const detailedAccounts = [];
    for (const account of connectorAccounts) {
      let connectorAccountDetails = null;

      if (!account.connectorAccountId && account.connectorAccountId) {
        connectorAccountDetails = await ConnectorAccount.findById(
          account.connectorAccountId
        );
      } else {
        connectorAccountDetails = account.connectorAccountId;
      }

      const accountInfo = {
        _id: account._id,
        connectorId: account.connectorId?._id,
        connectorName: account.connectorId?.name,
        connectorAccountId: account.connectorAccountId?._id,
        connectorAccountName: connectorAccountDetails?.name || "Not Found",
        terminalId: account.terminalId,
        status: account.status,
        isPrimary: account.isPrimary,
        hasConnectorAccount: !!connectorAccountDetails,
        hasIntegrationKeys: connectorAccountDetails?.integrationKeys
          ? true
          : false,
        integrationKeys: connectorAccountDetails?.integrationKeys || {},
      };

      detailedAccounts.push(accountInfo);

      // console.log(`🔍 Account Details:`, accountInfo);
    }

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
      },
      connectorAccounts: detailedAccounts,
      totalAccounts: connectorAccounts.length,
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
};

// Debug function for Enpay credentials
export const debugEnpayCredentials = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log("🔍 Debugging Enpay credentials for merchant:", merchantId);

    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name")
      .populate("connectorAccountId");

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        message: "No active connector account found",
      });
    }

    const connectorAccount = activeAccount.connectorAccountId;
    const integrationKeys = connectorAccount?.integrationKeys || {};

    res.json({
      success: true,
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
        email: merchant.email,
      },
      connector: {
        name: activeAccount.connectorId?.name,
        terminalId: activeAccount.terminalId,
      },
      credentials: {
        hasMerchantKey: !!integrationKeys["X-Merchant-Key"],
        hasMerchantSecret: !!integrationKeys["X-Merchant-Secret"],
        hasMerchantHashId: !!integrationKeys["merchantHashId"],
        merchantHashId: integrationKeys["merchantHashId"],
        baseUrl: integrationKeys["baseUrl"],
      },
      integrationKeys: integrationKeys,
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Existing functions
export const getMerchants = async (req, res) => {
  try {
    // console.log("🔍 Fetching merchants from database...");

    const merchants = await User.find({ role: "merchant", status: "Active" })
      .select(
        "_id firstname lastname company email mid status contact balance unsettleBalance createdAt"
      )
      .sort({ createdAt: -1 });

    // console.log(`✅ Found ${merchants.length} merchants from database`);

    const formattedMerchants = merchants.map((merchant) => ({
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
      merchantName:
        merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      hashId: merchant.mid,
      vpa: `${merchant.mid.toLowerCase()}@skypal`,
    }));

    res.json({
      success: true,
      data: formattedMerchants,
      count: formattedMerchants.length,
    });
  } catch (error) {
    console.error("❌ Error fetching merchants from database:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching merchants from database",
      error: error.message,
    });
  }
};

export const getPaymentMethods = async (req, res) => {
  try {
    // console.log("🔍 Fetching payment methods...");

    const methods = [
      { id: "upi", name: "UPI" },
      { id: "card", name: "Credit/Debit Card" },
      { id: "netbanking", name: "Net Banking" },
      { id: "wallet", name: "Wallet" },
    ];

    // console.log("✅ Payment methods:", methods);

    res.json({
      success: true,
      methods: methods,
    });
  } catch (error) {
    console.error("❌ Error fetching payment methods:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment methods",
      error: error.message,
    });
  }
};

// export const checkTransactionStatus = async (req, res) => {
//   try {
//     // console.log(req.body, req.query, "checkTransactionS");
//     const { txnRefId } = req.body;

//     if (!txnRefId) {
//       return res.status(400).json({
//         success: false,
//         message: "txnRefId is required",
//       });
//     }

//     const txn = await Transaction.findOne({ txnRefId });

//     if (!txn) {
//       return res.status(404).json({
//         success: false,
//         message: "Transaction not found",
//       });
//     }

//     const activeAccount = await MerchantConnectorAccount.findOne({
//       merchantId: txn.merchantId,
//       connectorAccountId: txn.connectorAccountId,
//       status: "Active",
//       // isPrimary: true,
//     })
//       .populate("connectorAccountId")
//       .populate("connectorId");

//     // console.log(activeAccount);

//     if (!activeAccount) {
//       return res.json({
//         success: false,
//         error: "Connector Account not found",
//         connectorName: "Enpay",
//       });
//     }

//     const keys = extractIntegrationKeys(activeAccount);

//     // console.log(keys);
//     if (activeAccount.connectorId.name === "Enpay") {
//       if (!keys) {
//         return res.json({
//           success: false,
//           error: "No keys found for Enpay connector",
//           connectorName: "Enpay",
//         });
//       }
//       const merchantKey = keys["X-Merchant-Key"];
//       const merchantSecret = keys["X-Merchant-Secret"];
//       const merchantHashId = keys["merchantHashId"];
//       const merchantVpa = keys["merchantVpa"];

//       if (!merchantKey || !merchantSecret || !merchantHashId || !merchantVpa) {
//         console.error(
//           "❌ Missing Enpay Credentials. Found:",
//           Object.keys(keys)
//         );
//         throw new Error("Missing integration keys for Enpay connector");
//       }
//       try {
//         const response = await axios.post(
//           "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/transactionStatus",
//           { txnRefId: txnRefId, merchantHashId: merchantHashId },
//           {
//             headers: {
//               "Content-Type": "application/json",
//               "X-Merchant-Key": merchantKey,
//               "X-Merchant-Secret": merchantSecret,
//               Accept: "application/json",
//             },
//             timeout: 20000,
//           }
//         );
//         // console.log("🔍 RAW ENPAY STATUS RESPONSE:", response.data);

//         return res.json({
//           success: true,
//           enpayResponse: response.data,
//         });
//       } catch (err) {
//         return res.json({
//           success: false,
//           error: err.message,
//           connectorName: "Enpay",
//         });
//       }
//     } else if (activeAccount.connectorId.name === "Razorpay") {
//       if (!keys) {
//         return res.json({
//           success: false,
//           error: "No keys found for Razorpay connector",
//           connectorName: "Enpay",
//         });
//       }
//       const requiredKeys = ["key_id", "key_secret"];

//       const missingKeys = requiredKeys.filter((key) => !keys[key]);

//       if (missingKeys.length > 0) {
//         console.error("Razorpay keys missing:", missingKeys);
//         throw new Error(
//           `Missing integration keys for Razorpay connector: ${missingKeys.join(
//             ", "
//           )}`
//         );
//       }

//       let razorPayResponse;

//       const razorpay = new Razorpay({
//         key_id: keys.key_id,
//         key_secret: keys.key_secret,
//       });
//       try {
//         if (txn.transactionType === "Link") {
//           razorPayResponse = await razorpay.paymentLink.fetch(txnRefId);
//         } else if (txn.transactionType === "QR") {
//           razorPayResponse = await razorpay.qrCode.fetchAllPayments(txnRefId);
//         }
//       } catch (err) {
//         // console.log(err);
//         return res.json({
//           success: false,
//           error: err.error.description,
//           connectorName: "Razorpay",
//         });
//       }

//       return res.json({
//         success: true,
//         razorPayResponse,
//       });
//     }
//   } catch (error) {
//     console.error("❌ Transaction Status API Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch transaction status",
//       error: error.response?.data || error.message,
//     });
//   }
// };

export const checkTransactionStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { txnRefId } = req.body;

    if (!txnRefId) {
      return res.status(400).json({
        success: false,
        message: "txnRefId is required",
      });
    }

    const txn = await Transaction.findOne({ txnRefId }).session(session);
    if (!txn) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Fetch merchant
    const merchant = await Merchant.findOne({
      userId: txn.merchantId,
    }).session(session);
    if (!merchant) throw new Error("Merchant not found");

    const user = await User.findById(txn.merchantId).session(session);
    if (!user) throw new Error("Merchant not found");

    // Fetch active connector account
    const activeAccount = await MerchantConnectorAccount.findOne({
      merchantId: txn.merchantId,
      connectorAccountId: txn.connectorAccountId,
      status: "Active",
    })
      .populate("connectorId")
      .populate("connectorAccountId")
      .session(session);

    // console.log(
    //   activeAccount.connectorAccountId,
    //   activeAccount.connectorId.name
    // );

    if (!activeAccount) throw new Error("Connector account not found");

    const connectorName = activeAccount.connectorId?.name || "";

    const keys = extractIntegrationKeys(activeAccount);
    // console.log(keys);

    let gatewayData;
    let newStatus;

    /* ===================== ENPAY ===================== */
    if (activeAccount.connectorId.name === "Enpay") {
      if (!keys) {
        throw new Error("No keys found for Enpay connector");
      }
      const merchantKey = keys["X-Merchant-Key"];
      const merchantSecret = keys["X-Merchant-Secret"];
      const merchantHashId = keys["merchantHashId"];
      const merchantVpa = keys["merchantVpa"];

      if (!merchantKey || !merchantSecret || !merchantHashId || !merchantVpa) {
        throw new Error("Missing Enpay credentials");
      }

      // Call Enpay API
      const response = await axios.post(
        "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/transactionStatus",
        { txnRefId: txn.txnRefId, merchantHashId },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Merchant-Key": merchantKey,
            "X-Merchant-Secret": merchantSecret,
          },
          timeout: 20000,
        }
      );

      gatewayData = response.data.details;
      // gatewayData.status = "SUCCESS";
      newStatus = gatewayData.status || "INITIATED";
      txn.transactionInitiatedAt = gatewayData.transactionInitiatedAt
        ? new Date(gatewayData.transactionInitiatedAt)
        : txn.transactionInitiatedAt;
      txn.transactionCompletedAt = gatewayData.transactionCompletedAt
        ? new Date(gatewayData.transactionCompletedAt)
        : txn.transactionCompletedAt;
      txn.utr = gatewayData.utr || txn.utr;
      txn.customerName = gatewayData.customerName || txn.customerName;
      txn.customerVpa = gatewayData.customerVpa || txn.customerVpa;
      txn.enpayTransactionStatus = newStatus;
    }
    /* ===================== RAZORPAY ===================== */
    if (activeAccount.connectorId.name === "Razorpay") {
      if (!keys) {
        throw new Error("No keys found for Razorpay connector");
      }

      const requiredKeys = ["key_id", "key_secret"];

      const missingKeys = requiredKeys.filter((key) => !keys[key]);

      if (missingKeys.length > 0) {
        console.error("Razorpay keys missing:", missingKeys);
        throw new Error(
          `Missing integration keys for Razorpay connector: ${missingKeys.join(
            ", "
          )}`
        );
      }

      const razorpay = new Razorpay({
        key_id: keys.key_id,
        key_secret: keys.key_secret,
      });

      if (txn.transactionType === "Link") {
        gatewayData = await razorpay.paymentLink.fetch(txn.txnRefId);

        if (gatewayData.status === "paid") {
          newStatus = "SUCCESS";
        } else if (
          gatewayData.status === "cancelled" ||
          gatewayData.status === "expired"
        ) {
          newStatus = "FAILED";
        } else {
          newStatus = "PENDING";
        }

        txn.transactionInitiatedAt = new Date(gatewayData.created_at * 1000);

        const payment = gatewayData.payments?.[0];
        if (payment) {
          txn.gatewayPaymentMethod = payment.method;
        }
        if (payment && payment.status === "captured") {
          txn.razorPayPaymentId = payment.payment_id;
          txn.transactionCompletedAt = new Date(payment.created_at * 1000);
          txn.utr =
            payment.acquirer_data?.rrn ||
            payment.acquirer_data?.upi_transaction_id ||
            txn.utr;
        }

        if (gatewayData.order_id) {
          txn.gatewayOrderId = gatewayData.order_id;
        }

        txn.customerName = gatewayData.customer?.name || txn.customerName;
        txn.customerEmail = gatewayData.customer?.email || txn.customerEmail;
        txn.customerContact =
          gatewayData.customer?.contact || txn.customerContact;
        txn.customerVpa = gatewayData.customer?.vpa || txn.customerVpa;
        txn.razorPayTransactionStatus = newStatus;
      }

      if (txn.transactionType === "QR") {
        gatewayData = await razorpay.qrCode.fetchAllPayments(txn.txnRefId);

        if (!gatewayData.items.length) {
          newStatus = "PENDING";
        } else {
          const payment = gatewayData.items[0];
          newStatus =
            payment.status === "captured"
              ? "SUCCESS"
              : payment.status === "failed"
              ? "FAILED"
              : "PENDING";

          txn.razorPayTransactionStatus = newStatus;
          txn.transactionInitiatedAt = new Date(payment.created_at * 1000);
          txn.razorPayPaymentId = payment.id;
          txn.gatewayPaymentMethod = payment.method;
          txn.customerEmail = payment.email || txn.customerEmail;
          txn.customerVpa = payment.vpa || txn.customerVpa;
          txn.customerContact = payment.contact || txn.customerContact;
          txn.transactionCompletedAt =
            payment.status === "captured"
              ? new Date(payment.created_at * 1000)
              : null;
          txn.utr = payment.acquirer_data?.rrn || txn.utr;

          if (payment.order_id) {
            txn.gatewayOrderId = payment.order_id;
          }
        }
      }
    }

    // Save previous status
    const prevStatus = txn.status;
    txn.previousStatus = prevStatus;

    // Initialize counters if undefined
    merchant.payinTransactions = merchant.payinTransactions || 0;
    merchant.totalLastNetPayIn = merchant.totalLastNetPayIn || 0;
    merchant.totalCredits = merchant.totalCredits || 0;
    merchant.availableBalance = merchant.availableBalance || 0;
    merchant.totalTransactions = merchant.totalTransactions || 0;
    merchant.successfulTransactions = merchant.successfulTransactions || 0;
    // merchant.pendingTransactions = merchant.pendingTransactions || 0;
    merchant.failedTransactions = merchant.failedTransactions || 0;
    merchant.balance = merchant.balance || 0;

    // Always increment total transactions if this is a new transaction update
    if (!txn.totalApplied) {
      merchant.totalTransactions += 1;
      merchant.payinTransactions += 1;
      txn.totalApplied = true;
    }

    // Handle state transitions idempotently
    if (prevStatus !== newStatus) {
      // INITIATED → PENDING
      // if (prevStatus === "INITIATED" && newStatus === "PENDING") {
      //   merchant.pendingTransactions += 1;
      // }

      // INITIATED → SUCCESS
      if (
        prevStatus === "INITIATED" &&
        newStatus === "SUCCESS" &&
        !txn.payInApplied
      ) {
        merchant.availableBalance += txn.amount;
        merchant.totalCredits += txn.amount;
        merchant.totalLastNetPayIn += txn.amount;
        merchant.successfulTransactions += 1;
        user.balance += txn.amount;
        txn.payInApplied = true;

        // Reduce failed count if previously marked failed
        if (txn.wasFailed) {
          merchant.failedTransactions = Math.max(
            0,
            merchant.failedTransactions - 1
          );
          txn.wasFailed = false;
        }
      }

      // INITIATED → FAILED
      if (
        prevStatus === "INITIATED" &&
        newStatus === "FAILED" &&
        !txn.wasFailed
      ) {
        merchant.failedTransactions += 1;
        txn.wasFailed = true;
      }

      // PENDING → SUCCESS
      if (
        prevStatus === "PENDING" &&
        newStatus === "SUCCESS" &&
        !txn.payInApplied
      ) {
        // merchant.pendingTransactions = Math.max(
        //   0,
        //   merchant.pendingTransactions - 1
        // );
        merchant.successfulTransactions += 1;
        merchant.availableBalance += txn.amount;
        merchant.totalCredits += txn.amount;
        merchant.totalLastNetPayIn += txn.amount;
        user.balance += txn.amount;
        txn.payInApplied = true;

        if (txn.wasFailed) {
          merchant.failedTransactions = Math.max(
            0,
            merchant.failedTransactions - 1
          );
          txn.wasFailed = false;
        }
      }

      // PENDING → FAILED
      if (
        prevStatus === "PENDING" &&
        newStatus === "FAILED" &&
        !txn.wasFailed
      ) {
        // merchant.pendingTransactions = Math.max(
        //   0,
        //   merchant.pendingTransactions - 1
        // );
        merchant.failedTransactions += 1;
        txn.wasFailed = true;
      }

      // SUCCESS → FAILED (rollback)
      if (
        prevStatus === "SUCCESS" &&
        newStatus === "FAILED" &&
        txn.payInApplied
      ) {
        merchant.successfulTransactions = Math.max(
          0,
          merchant.successfulTransactions - 1
        );
        merchant.failedTransactions += 1;

        merchant.availableBalance = Math.max(
          0,
          merchant.availableBalance - txn.amount
        );
        merchant.totalCredits = Math.max(0, merchant.totalCredits - txn.amount);
        merchant.totalLastNetPayIn = Math.max(
          0,
          merchant.totalLastNetPayIn - txn.amount
        );
        user.balance = Math.max(0, user.balance - txn.amount);

        txn.payInApplied = false;
        txn.wasFailed = true;
      }

      // SUCCESS → PENDING (rare but safe)
      if (
        prevStatus === "SUCCESS" &&
        newStatus === "PENDING" &&
        txn.payInApplied
      ) {
        merchant.successfulTransactions = Math.max(
          0,
          merchant.successfulTransactions - 1
        );
        // merchant.pendingTransactions += 1;
        merchant.availableBalance = Math.max(
          0,
          merchant.availableBalance - txn.amount
        );
        merchant.totalCredits = Math.max(0, merchant.totalCredits - txn.amount);
        merchant.totalLastNetPayIn = Math.max(
          0,
          merchant.totalLastNetPayIn - txn.amount
        );
        user.balance = Math.max(0, user.balance - txn.amount);
        txn.payInApplied = false;
        if (txn.wasFailed) {
          merchant.failedTransactions = Math.max(
            0,
            merchant.failedTransactions - 1
          );
          txn.wasFailed = false;
        }
      }
    }

    // Update transaction fields
    txn.status = newStatus;
    txn.updatedAt = new Date();

    // Save both transaction and merchant
    await txn.save({ session });
    await merchant.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    // console.log(gatewayData);

    return res.status(200).json({
      success: true,
      txnRefId: txn.txnRefId,
      status: gatewayData,
    });
  } catch (error) {
    console.error(
      "❌ Transaction status update error:",
      error.message || error.error?.description
    );

    await session.abortTransaction();

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction status",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const updateTransactions = async (req, res) => {
  try {
    // Fetch transactions in non-final states
    const transactions = await Transaction.find({
      status: { $in: ["INITIATED", "PENDING"] },
    }).limit(100); // limit for cron safety

    if (!transactions.length) {
      return res.json({
        success: true,
        message: "No initiated or pending transactions found",
      });
    }

    const results = [];

    for (const txn of transactions) {
      const session = await mongoose.startSession();
      session.startTransaction();

      let activeAccount;
      let connectorName;

      try {
        // Fetch merchant
        const merchant = await Merchant.findOne({
          userId: txn.merchantId,
        }).session(session);
        if (!merchant) throw new Error("Merchant not found");

        const user = await User.findById(txn.merchantId).session(session);
        if (!user) throw new Error("Merchant not found");

        // Fetch active connector account
        activeAccount = await MerchantConnectorAccount.findOne({
          merchantId: txn.merchantId,
          connectorAccountId: txn.connectorAccountId,
          status: "Active",
          // isPrimary: true,
        })
          .populate("connectorId")
          .populate("connectorAccountId")
          .session(session);

        // console.log(
        //   activeAccount.connectorAccountId,
        //   activeAccount.connectorId.name
        // );

        if (!activeAccount) throw new Error("Connector account not found");

        connectorName = activeAccount.connectorId?.name || "";

        const keys = extractIntegrationKeys(activeAccount);
        // console.log(keys);

        let gatewayData;
        let newStatus;

        /* ===================== ENPAY ===================== */
        if (activeAccount.connectorId.name === "Enpay") {
          if (!keys) {
            throw new Error("No keys found for Enpay connector");
          }
          const merchantKey = keys["X-Merchant-Key"];
          const merchantSecret = keys["X-Merchant-Secret"];
          const merchantHashId = keys["merchantHashId"];
          const merchantVpa = keys["merchantVpa"];

          if (
            !merchantKey ||
            !merchantSecret ||
            !merchantHashId ||
            !merchantVpa
          ) {
            throw new Error("Missing Enpay credentials");
          }

          // Call Enpay API
          const response = await axios.post(
            "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/transactionStatus",
            { txnRefId: txn.txnRefId, merchantHashId },
            {
              headers: {
                "Content-Type": "application/json",
                "X-Merchant-Key": merchantKey,
                "X-Merchant-Secret": merchantSecret,
              },
              timeout: 20000,
            }
          );

          gatewayData = response.data.details;
          // gatewayData.status = "SUCCESS";
          newStatus = gatewayData.status || "INITIATED";
          txn.transactionInitiatedAt = gatewayData.transactionInitiatedAt
            ? new Date(gatewayData.transactionInitiatedAt)
            : txn.transactionInitiatedAt;
          txn.transactionCompletedAt = gatewayData.transactionCompletedAt
            ? new Date(gatewayData.transactionCompletedAt)
            : txn.transactionCompletedAt;
          txn.utr = gatewayData.utr || txn.utr;
          txn.customerName = gatewayData.customerName || txn.customerName;
          txn.customerVpa = gatewayData.customerVpa || txn.customerVpa;
          txn.enpayTransactionStatus = newStatus;
        }
        /* ===================== RAZORPAY ===================== */
        if (activeAccount.connectorId.name === "Razorpay") {
          if (!keys) {
            throw new Error("No keys found for Razorpay connector");
          }

          const requiredKeys = ["key_id", "key_secret"];

          const missingKeys = requiredKeys.filter((key) => !keys[key]);

          if (missingKeys.length > 0) {
            console.error("Razorpay keys missing:", missingKeys);
            throw new Error(
              `Missing integration keys for Razorpay connector: ${missingKeys.join(
                ", "
              )}`
            );
          }

          const razorpay = new Razorpay({
            key_id: keys.key_id,
            key_secret: keys.key_secret,
          });

          if (txn.transactionType === "Link") {
            gatewayData = await razorpay.paymentLink.fetch(txn.txnRefId);

            if (gatewayData.status === "paid") {
              newStatus = "SUCCESS";
            } else if (
              gatewayData.status === "cancelled" ||
              gatewayData.status === "expired"
            ) {
              newStatus = "FAILED";
            } else {
              newStatus = "PENDING";
            }

            txn.transactionInitiatedAt = new Date(
              gatewayData.created_at * 1000
            );

            const payment = gatewayData.payments?.[0];
            if (payment) {
              txn.gatewayPaymentMethod = payment.method;
            }
            if (payment && payment.status === "captured") {
              txn.razorPayPaymentId = payment.payment_id;
              txn.transactionCompletedAt = new Date(payment.created_at * 1000);
              txn.utr =
                payment.acquirer_data?.rrn ||
                payment.acquirer_data?.upi_transaction_id ||
                txn.utr;
            }

            if (gatewayData.order_id) {
              txn.gatewayOrderId = gatewayData.order_id;
            }

            txn.customerName = gatewayData.customer?.name || txn.customerName;
            txn.customerEmail =
              gatewayData.customer?.email || txn.customerEmail;
            txn.customerContact =
              gatewayData.customer?.contact || txn.customerContact;
            txn.customerVpa = gatewayData.customer?.vpa || txn.customerVpa;
            txn.razorPayTransactionStatus = newStatus;
          }

          if (txn.transactionType === "QR") {
            gatewayData = await razorpay.qrCode.fetchAllPayments(txn.txnRefId);

            if (!gatewayData.items.length) {
              newStatus = "PENDING";
            } else {
              const payment = gatewayData.items[0];
              newStatus =
                payment.status === "captured"
                  ? "SUCCESS"
                  : payment.status === "failed"
                  ? "FAILED"
                  : "PENDING";

              txn.razorPayTransactionStatus = newStatus;
              txn.transactionInitiatedAt = new Date(payment.created_at * 1000);
              txn.razorPayPaymentId = payment.id;
              txn.gatewayPaymentMethod = payment.method;
              txn.customerEmail = payment.email || txn.customerEmail;
              txn.customerVpa = payment.vpa || txn.customerVpa;
              txn.customerContact = payment.contact || txn.customerContact;
              txn.transactionCompletedAt =
                payment.status === "captured"
                  ? new Date(payment.created_at * 1000)
                  : null;
              txn.utr = payment.acquirer_data?.rrn || txn.utr;

              if (payment.order_id) {
                txn.gatewayOrderId = payment.order_id;
              }
            }
          }
        }

        // Save previous status
        const prevStatus = txn.status;
        txn.previousStatus = prevStatus;

        // Initialize counters if undefined
        merchant.payinTransactions = merchant.payinTransactions || 0;
        merchant.totalLastNetPayIn = merchant.totalLastNetPayIn || 0;
        merchant.totalCredits = merchant.totalCredits || 0;
        merchant.availableBalance = merchant.availableBalance || 0;
        merchant.totalTransactions = merchant.totalTransactions || 0;
        merchant.successfulTransactions = merchant.successfulTransactions || 0;
        // merchant.pendingTransactions = merchant.pendingTransactions || 0;
        merchant.failedTransactions = merchant.failedTransactions || 0;
        merchant.balance = merchant.balance || 0;

        // Always increment total transactions if this is a new transaction update
        if (!txn.totalApplied) {
          merchant.totalTransactions += 1;
          merchant.payinTransactions += 1;
          txn.totalApplied = true;
        }

        // Handle state transitions idempotently
        if (prevStatus !== newStatus) {
          // INITIATED → PENDING
          // if (prevStatus === "INITIATED" && newStatus === "PENDING") {
          //   merchant.pendingTransactions += 1;
          // }

          // INITIATED → SUCCESS
          if (
            prevStatus === "INITIATED" &&
            newStatus === "SUCCESS" &&
            !txn.payInApplied
          ) {
            merchant.availableBalance += txn.amount;
            merchant.totalCredits += txn.amount;
            merchant.totalLastNetPayIn += txn.amount;
            merchant.successfulTransactions += 1;
            user.balance += txn.amount;
            txn.payInApplied = true;

            // Reduce failed count if previously marked failed
            if (txn.wasFailed) {
              merchant.failedTransactions = Math.max(
                0,
                merchant.failedTransactions - 1
              );
              txn.wasFailed = false;
            }
          }

          // INITIATED → FAILED
          if (
            prevStatus === "INITIATED" &&
            newStatus === "FAILED" &&
            !txn.wasFailed
          ) {
            merchant.failedTransactions += 1;
            txn.wasFailed = true;
          }

          // PENDING → SUCCESS
          if (
            prevStatus === "PENDING" &&
            newStatus === "SUCCESS" &&
            !txn.payInApplied
          ) {
            // merchant.pendingTransactions = Math.max(
            //   0,
            //   merchant.pendingTransactions - 1
            // );
            merchant.successfulTransactions += 1;
            merchant.availableBalance += txn.amount;
            merchant.totalCredits += txn.amount;
            merchant.totalLastNetPayIn += txn.amount;
            user.balance += txn.amount;
            txn.payInApplied = true;

            if (txn.wasFailed) {
              merchant.failedTransactions = Math.max(
                0,
                merchant.failedTransactions - 1
              );
              txn.wasFailed = false;
            }
          }

          // PENDING → FAILED
          if (
            prevStatus === "PENDING" &&
            newStatus === "FAILED" &&
            !txn.wasFailed
          ) {
            // merchant.pendingTransactions = Math.max(
            //   0,
            //   merchant.pendingTransactions - 1
            // );
            merchant.failedTransactions += 1;
            txn.wasFailed = true;
          }

          // SUCCESS → FAILED (rollback)
          if (
            prevStatus === "SUCCESS" &&
            newStatus === "FAILED" &&
            txn.payInApplied
          ) {
            merchant.successfulTransactions = Math.max(
              0,
              merchant.successfulTransactions - 1
            );
            merchant.failedTransactions += 1;

            merchant.availableBalance = Math.max(
              0,
              merchant.availableBalance - txn.amount
            );
            merchant.totalCredits = Math.max(
              0,
              merchant.totalCredits - txn.amount
            );
            merchant.totalLastNetPayIn = Math.max(
              0,
              merchant.totalLastNetPayIn - txn.amount
            );
            user.balance = Math.max(0, user.balance - txn.amount);

            txn.payInApplied = false;
            txn.wasFailed = true;
          }

          // SUCCESS → PENDING (rare but safe)
          if (
            prevStatus === "SUCCESS" &&
            newStatus === "PENDING" &&
            txn.payInApplied
          ) {
            merchant.successfulTransactions = Math.max(
              0,
              merchant.successfulTransactions - 1
            );
            // merchant.pendingTransactions += 1;
            merchant.availableBalance = Math.max(
              0,
              merchant.availableBalance - txn.amount
            );
            merchant.totalCredits = Math.max(
              0,
              merchant.totalCredits - txn.amount
            );
            merchant.totalLastNetPayIn = Math.max(
              0,
              merchant.totalLastNetPayIn - txn.amount
            );
            user.balance = Math.max(0, user.balance - txn.amount);
            txn.payInApplied = false;
            if (txn.wasFailed) {
              merchant.failedTransactions = Math.max(
                0,
                merchant.failedTransactions - 1
              );
              txn.wasFailed = false;
            }
          }
        }

        // Update transaction fields
        txn.status = newStatus;
        txn.updatedAt = new Date();

        // Save both transaction and merchant
        await txn.save({ session });
        await merchant.save({ session });
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // console.log(gatewayData);

        results.push({
          success: true,
          txnRefId: txn.txnRefId,
          status: gatewayData,
        });
      } catch (err) {
        await session.abortTransaction();
        session.endSession();

        const errorUpdate = {
          updatedAt: new Date(),
        };

        if (connectorName === "Enpay") {
          errorUpdate.enpayError = err.message;
        }

        if (connectorName === "Razorpay") {
          errorUpdate.razorPayError = err.error?.description;
        }

        await Transaction.updateOne(
          { _id: txn._id },
          {
            $set: errorUpdate,
          }
        );

        results.push({
          success: false,
          txnRefId: txn.txnRefId,
          error: err.message,
        });

        console.error(
          `❌ Failed txnRefId ${txn.txnRefId}:`,
          err.message || err.error?.description,
          " ",
          connectorName
        );
      }
    }

    return res.json({
      success: true,
      message: "Transactions processed successfully",
      results,
    });
  } catch (error) {
    console.error("❌ Update Transaction status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update transactions",
      error: error.message,
    });
  }
};
// export const updateTransactions = async (req, res) => {
//   try {
//     // Fetch transactions in non-final states
//     const transactions = await Transaction.find({
//       status: { $in: ["INITIATED", "PENDING"] },
//     }).limit(100); // limit for cron safety

//     if (!transactions.length) {
//       return res.json({
//         success: true,
//         message: "No initiated or pending transactions found",
//       });
//     }

//     const results = [];

//     for (const txn of transactions) {
//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         // Fetch merchant
//         const merchant = await Merchant.findOne({
//           userId: txn.merchantId,
//         }).session(session);
//         if (!merchant) throw new Error("Merchant not found");

//         const user = await User.findOne({
//           _id: txn.merchantId,
//         }).session(session);
//         if (!user) throw new Error("User not found");

//         // Fetch active connector account
//         const activeAccount = await MerchantConnectorAccount.findOne({
//           merchantId: txn.merchantId,
//           connectorAccountId: txn.connectorAccountId,
//           status: "Active",
//           // isPrimary: true,
//         })
//           .populate("connectorAccountId")
//           .session(session);

//         if (!activeAccount)
//           throw new Error("Active connector account not found");

//         const keys = extractIntegrationKeys(activeAccount);
//         const merchantKey = keys["X-Merchant-Key"];
//         const merchantSecret = keys["X-Merchant-Secret"];
//         const merchantHashId = keys["merchantHashId"];

//         if (!merchantKey || !merchantSecret || !merchantHashId) {
//           throw new Error("Missing Enpay credentials");
//         }

//         // Call Enpay API
//         const response = await axios.post(
//           "https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/transactionStatus",
//           { txnRefId: txn.txnRefId, merchantHashId },
//           {
//             headers: {
//               "Content-Type": "application/json",
//               "X-Merchant-Key": merchantKey,
//               "X-Merchant-Secret": merchantSecret,
//             },
//             timeout: 20000,
//           }
//         );

//         const enpayData = response.data.details;
//         // enpayData.status = "SUCCESS";
//         const newStatus = enpayData.status;

//         // Save previous status
//         const prevStatus = txn.status;
//         txn.previousStatus = prevStatus;

//         // Initialize counters if undefined
//         merchant.payinTransactions = merchant.payinTransactions || 0;
//         merchant.totalLastNetPayIn = merchant.totalLastNetPayIn || 0;
//         merchant.totalCredits = merchant.totalCredits || 0;
//         merchant.availableBalance = merchant.availableBalance || 0;
//         merchant.totalTransactions = merchant.totalTransactions || 0;
//         merchant.successfulTransactions = merchant.successfulTransactions || 0;
//         merchant.failedTransactions = merchant.failedTransactions || 0;

//         // Always increment total transactions if this is a new transaction update
//         if (!txn.totalApplied) {
//           merchant.totalTransactions += 1;
//           merchant.payinTransactions += 1;
//           txn.totalApplied = true;
//         }

//         // Handle state transitions idempotently
//         if (prevStatus !== newStatus) {
//           // INITIATED or PENDING → SUCCESS
//           if (
//             ["INITIATED", "PENDING"].includes(prevStatus) &&
//             newStatus === "SUCCESS" &&
//             !txn.payInApplied
//           ) {
//             merchant.availableBalance += txn.amount;
//             merchant.totalCredits += txn.amount;
//             merchant.totalLastNetPayIn += txn.amount;
//             merchant.successfulTransactions += 1;
//             user.balance += txn.amount;
//             txn.payInApplied = true;

//             // Reduce failed count if previously marked failed
//             if (txn.wasFailed) {
//               merchant.failedTransactions = Math.max(
//                 0,
//                 merchant.failedTransactions - 1
//               );
//               txn.wasFailed = false;
//             }
//           }

//           // SUCCESS → FAILED (rollback)
//           if (
//             prevStatus === "SUCCESS" &&
//             newStatus === "FAILED" &&
//             txn.payInApplied
//           ) {
//             merchant.availableBalance = Math.max(
//               0,
//               merchant.availableBalance - txn.amount
//             );
//             merchant.totalCredits = Math.max(
//               0,
//               merchant.totalCredits - txn.amount
//             );
//             merchant.totalLastNetPayIn = Math.max(
//               0,
//               merchant.totalLastNetPayIn - txn.amount
//             );
//             merchant.successfulTransactions = Math.max(
//               0,
//               merchant.successfulTransactions - 1
//             );
//             merchant.failedTransactions += 1;
//             user.balance = Math.max(0, user.balance - txn.amount);
//             txn.payInApplied = false;
//             txn.wasFailed = true; // track that this transaction became failed
//           }

//           // PENDING → FAILED
//           if (prevStatus === "PENDING" && newStatus === "FAILED") {
//             merchant.failedTransactions += 1;
//             txn.wasFailed = true;
//           }

//           // SUCCESS → PENDING → SUCCESS (idempotent)
//           if (
//             prevStatus === "SUCCESS" &&
//             newStatus === "PENDING" &&
//             txn.payInApplied
//           ) {
//             txn.payInApplied = false;
//           }

//           if (
//             prevStatus === "PENDING" &&
//             newStatus === "SUCCESS" &&
//             !txn.payInApplied
//           ) {
//             merchant.availableBalance += txn.amount;
//             merchant.totalCredits += txn.amount;
//             merchant.totalLastNetPayIn += txn.amount;
//             merchant.successfulTransactions += 1;
//             user.balance += txn.amount;
//             txn.payInApplied = true;

//             if (txn.wasFailed) {
//               merchant.failedTransactions = Math.max(
//                 0,
//                 merchant.failedTransactions - 1
//               );
//               txn.wasFailed = false;
//             }
//           }
//         }

//         // Update transaction fields
//         txn.status = newStatus;
//         txn.transactionInitiatedAt = enpayData.transactionInitiatedAt
//           ? new Date(enpayData.transactionInitiatedAt)
//           : txn.transactionInitiatedAt;
//         txn.transactionCompletedAt = enpayData.transactionCompletedAt
//           ? new Date(enpayData.transactionCompletedAt)
//           : txn.transactionCompletedAt;
//         txn.utr = enpayData.utr || txn.utr;
//         txn.customerName = enpayData.customerName || txn.customerName;
//         txn.customerVpa = enpayData.customerVpa || txn.customerVpa;
//         txn.updatedAt = new Date();

//         // Save both transaction and merchant
//         await txn.save({ session });
//         await merchant.save({ session });
//         await user.save({ session });

//         await session.commitTransaction();
//         session.endSession();

//         results.push({
//           txnRefId: txn.txnRefId,
//           success: true,
//           status: enpayData,
//         });
//       } catch (err) {
//         await session.abortTransaction();
//         session.endSession();

//         results.push({
//           txnRefId: txn.txnRefId,
//           success: false,
//           error: err.message,
//         });

//         console.error(`❌ Failed txnRefId ${txn.txnRefId}:`, err.message);
//       }
//     }

//     return res.json({
//       success: true,
//       message: "Transactions processed successfully",
//       results,
//     });
//   } catch (error) {
//     console.error("❌ Update Transaction status error:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update transactions",
//       error: error.message,
//     });
//   }
// };

export const enpayWebhook = async (req, res) => {
  try {
    // console.log("🔔 Enpay Webhook Received:", req.body);

    const {
      merchantTrnId, // = txnRefId
      status, // SUCCESS / FAILED / PENDING
      enpayTxnId,
    } = req.body;

    const transaction = await Transaction.findOne({
      txnRefId: merchantTrnId,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    transaction.status = status;
    transaction.gatewayTransactionId = enpayTxnId;
    transaction.gatewayResponse = req.body;
    transaction.updatedAt = new Date();

    await transaction.save();

    // console.log("✅ Enpay Transaction Updated via Webhook");
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Enpay Webhook Error:", err);
    return res.status(500).json({ success: false });
  }
};

export const redirectAfterPayment = async (req, res) => {
  try {
    const { txnRefId } = req.query;

    const txn = await Transaction.findOne({ txnRefId });

    if (!txn) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (txn.status !== "SUCCESS") {
      return res.status(400).json({
        success: false,
        message: "Payment not successful yet",
      });
    }

    return res.json({
      success: true,
      redirectUrl: `${FRONTEND_BASE_URL}/payment-success?status==${txn.status}&transactionId=${txnRefId}`,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

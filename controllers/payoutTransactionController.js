import PayoutTransaction from "../models/PayoutTransaction.js";
import User from "../models/User.js";
import Connector from "../models/Connector.js";
import Merchant from "../models/Merchant.js";
import mongoose from "mongoose";
import MerchantPayoutConnectorAccount from "../models/MerchantPayoutConnectorAccount.js";
import Transaction from "../models/Transaction.js";
import axios from "axios";
import {
  decryptData,
  encryptData,
  extractIntegrationKeys,
  payoutTransactionStatus,
} from "../utils/jodetx.js";
import TransactionsLog from "../models/TransactionsLog.js";

// Utility for generating UTR
const generateUtr = () => `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`;

// Add this utility function at the top of your controller
// payoutTransactionController.js मध्ये हे utility function जोडा
const executeWithRetry = async (
  operation,
  maxRetries = 3,
  baseDelay = 1000
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error.message.includes("Write conflict") && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        // console.log(
        //   `🔄 Write conflict - Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`
        // );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

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

export const payoutInitiate = async (encryptedData, connectorAccount) => {
  try {
    const keys = connectorAccount.extractedKeys || {};

    const header_key = keys["header_key"];

    if (!header_key) {
      throw new Error("Header key not found");
    }

    if (!encryptedData) {
      throw new Error("encryptedData is required");
    }
    // console.log("Data:", encryptedData);
    const requestParams = encryptedData;

    const response = await axios.post(
      "https://pg-rest-api.jodetx.com/v1/api/payout/initiate-transaction",
      {
        request: requestParams,
      },
      {
        headers: {
          token: header_key,
          "Content-Type": "application/json",
        },
      }
    );

    // console.log("Payout Initiated:", response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    console.error("❌ Payout Initiation Error:", err.message);
    // return {
    //   success: false,
    //   error: err.message,
    // };
    throw err || "Payout Initiation Error";
    // throw new Error(err.message || "Payout Initiation Error");
  }
};

const failTransaction = async (
  payoutId,
  merchantId,
  error,
  balanceBlocked,
  amount,
  session
) => {
  const update = {
    status: "FAILED",
    error: error?.message || String(error),
    updatedAt: new Date(),
  };

  await PayoutTransaction.findByIdAndUpdate(payoutId, update, { session });

  if (balanceBlocked && typeof amount == "number") {
    await Merchant.findOneAndUpdate(
      { userId: merchantId },
      {
        $inc: {
          availableBalance: amount,
          blockedBalance: -amount,
          totalTransactions: 1,
          payoutTransactions: 1,
          failedTransactions: 1,
        },
        $set: { lastPayoutTransactions: payoutId },
      },
      { session }
    );
  } else {
    await Merchant.findOneAndUpdate(
      { userId: merchantId },
      {
        $inc: {
          totalTransactions: 1,
          payoutTransactions: 1,
          failedTransactions: 1,
        },
        $set: { lastPayoutTransactions: payoutId },
      },
      { session }
    );
  }
  const merchantWallet = await Merchant.findOne(
    { userId: merchantId },
    { availableBalance: 1 },
    { session }
  );

  await TransactionsLog.updateOne(
    { referenceId: payoutId },
    {
      $set: {
        status: "FAILED",
        debit: 0,
        credit: balanceBlocked ? amount : 0,
        balance: merchantWallet.availableBalance,
        description: "Payout failed - amount released",
        source: "SYSTEM",
        txnCompletedDate: new Date(),
      },
    },
    { session }
  );
};

// Simple version without MongoDB transactions
// createPayoutToMerchant
export const createPayoutToMerchant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let savedTransaction = null;
  let balanceBlocked = false;
  let payoutAmount = 0;
  try {
    const {
      merchantId,
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
      paymentMode,
      amount,
      customerEmail,
      customerPhoneNumber,
      remark,
      responseUrl,
    } = req.body;

    if (!merchantId) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Merchant ID not found" });
    }

    const [user, merchant] = await Promise.all([
      User.findById(merchantId).lean(),
      Merchant.findOne({ userId: merchantId }).lean(),
    ]);

    if (!user || !merchant) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }

    if (user.transactionLimit) {
      const dateFilter = todayFilter();
      // console.log(dateFilter, user._id, user.transactionLimit);
      const [payinCount, payoutCount] = await Promise.all([
        Transaction.countDocuments({ merchantId: user._id, ...dateFilter }),
        PayoutTransaction.countDocuments({
          merchantId: user._id,
          ...dateFilter,
        }),
      ]);

      const totalTransactionsCount = payinCount + payoutCount;

      // console.log(totalTransactionsCount, "transaction Count");

      const used = Number(totalTransactionsCount);
      const limit = Number(user.transactionLimit || 0);

      if (used >= limit) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: "Transaction limit has been exceeded for today!",
        });
      }
    }

    const merchantName =
      user.company || user?.firstname + " " + (user?.lastname || "");

    const payoutId = `P${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const requestId = `REQ${Date.now()}${Math.floor(Math.random() * 1000)}`;

    payoutAmount = amount;

    console.log("📦 Creating payout to merchant");

    const newPayout = {
      // Required unique identifiers
      payoutId,
      requestId,

      // Merchant information
      merchantId,
      merchantName,
      merchantEmail: merchant.email || "",
      mid: merchant.mid || "",

      // Settlement information
      settlementAmount: payoutAmount,

      // Recipient bank details
      recipientBankName: bankName,
      recipientAccountNumber: accountNumber,
      recipientIfscCode: ifscCode,
      recipientAccountHolderName: accountHolderName,
      recipientAccountType: accountType || "",

      // Transaction details
      amount: payoutAmount,
      currency: "INR",
      paymentMode: paymentMode || "",
      transactionType: "Debit",
      status: "INITIATED",

      // Customer information
      customerEmail,
      customerPhoneNumber,

      // Additional fields
      remark: remark || "",
      responseUrl,
    };

    // savedTransaction = await PayoutTransaction.create(newPayout);
    [savedTransaction] = await PayoutTransaction.create([newPayout], {
      session,
    });

    const merchantWallet = await Merchant.findOne(
      { userId: merchantId },
      { availableBalance: 1 },
      { session }
    );

    await TransactionsLog.create(
      [
        {
          merchantId,
          referenceType: "PAYOUT",
          referenceId: savedTransaction._id,
          referenceNo: payoutId,
          referenceTxnId: requestId,
          description: "Payout amount blocked",
          debit: payoutAmount,
          credit: 0,
          balance: merchantWallet.availableBalance,
          status: "INITIATED",
          source: "API",
          payoutAccount: {
            beneficiaryName: accountHolderName,
            bankName,
            accountNumber: accountNumber,
            ifsc: ifscCode,
            payoutMethod: paymentMode,
          },
          txnInitiatedDate: new Date(),
        },
      ],
      { session }
    );

    // Validate required fields
    if (!amount) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Amount cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount cannot be blank",
      });
    }

    payoutAmount = Number(amount);

    if (isNaN(payoutAmount) || payoutAmount < 1000) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Amount must be greater than or equal to 1000",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than or equal to 1000",
      });
    }

    const blockResult = await Merchant.updateOne(
      {
        userId: merchantId,
        availableBalance: { $gte: payoutAmount },
      },
      {
        $inc: {
          availableBalance: -payoutAmount,
          blockedBalance: payoutAmount,
        },
      },
      { session }
    );

    if (blockResult.modifiedCount === 0) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Insufficient balance",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }
    balanceBlocked = true;

    if (!accountNumber) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Account Number cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Account Number cannot be blank",
      });
    }
    if (!ifscCode) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "IFSC Code cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "IFSC Code cannot be blank",
      });
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode)) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Invalid IFSC Code format",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid IFSC Code format",
      });
    }
    if (!bankName) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Bank Name cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Bank Name cannot be blank",
      });
    }
    if (!accountHolderName) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Account Holder Name cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Account Holder Name cannot be blank",
      });
    }
    if (!paymentMode) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Payment Mode cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Payment Mode cannot be blank",
      });
    }
    if (!accountType) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Account Type cannot be blank",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Account Type cannot be blank",
      });
    }

    // Find Active Connector Account
    const [activeAccount] = await MerchantPayoutConnectorAccount.aggregate([
      {
        $match: {
          merchantId: new mongoose.Types.ObjectId(merchantId),
          isPrimary: true,
          status: "Active",
        },
      },
      {
        $lookup: {
          from: "connectors",
          localField: "connectorId",
          foreignField: "_id",
          as: "connector",
        },
      },
      {
        $lookup: {
          from: "connectoraccounts",
          localField: "connectorAccountId",
          foreignField: "_id",
          as: "connectorAccount",
        },
      },
      { $unwind: "$connector" },
      { $unwind: "$connectorAccount" },
    ]);

    // console.log(activeAccount);

    if (!activeAccount) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "No payment connector configured. Please contact admin."
      );
      // console.log("❌ No connector account found for merchant");
      return res.status(400).json({
        success: false,
        message: "No payment connector configured. Please contact admin.",
        needsSetup: true,
      });
    }

    const connectorName = activeAccount.connector?.name.toLowerCase();

    // console.log("🎯 Using Connector:", connectorName);

    // Extract keys using helper function
    const integrationKeys = extractIntegrationKeys(activeAccount);
    // console.log("🎯 Keys:", integrationKeys);

    activeAccount.extractedKeys = integrationKeys;

    const connectorMeta = {
      connectorAccountId: activeAccount.connectorAccount?._id,
      connectorId: activeAccount.connector?._id,
      terminalId: activeAccount.terminalId || "N/A",
      connector: connectorName,
      updatedAt: new Date(),
    };

    // console.log(connectorMeta, savedTransaction._id);

    const updatedPayout = await PayoutTransaction.findByIdAndUpdate(
      savedTransaction._id,
      connectorMeta,
      { session }
    );

    await TransactionsLog.updateOne(
      {
        referenceType: "PAYOUT",
        referenceId: savedTransaction._id,
      },
      {
        $set: {
          connector: {
            name: connectorName,
            connectorId: activeAccount.connector?._id,
            connectorAccountId: activeAccount.connectorAccount?._id,
            gatewayRefId: requestId,
          },
        },
      },
      { session }
    );

    // console.log(updatedPayout, savedTransaction._id);

    const beneficiary_account_number = accountNumber;
    const beneficiary_bank_ifsc = ifscCode;
    const beneficiary_bank_name = bankName;
    const beneficiary_name = accountHolderName;
    const payment_mode = paymentMode;
    const txn_note = remark;

    const encryptedResponse = await encryptData(
      {
        requestId,
        beneficiary_account_number,
        beneficiary_bank_ifsc,
        beneficiary_bank_name,
        beneficiary_name,
        payment_mode,
        txn_note,
        amount: payoutAmount,
      },
      activeAccount
    );
    // console.log(encryptedResponse.data, "Enc res");

    const encryptedPayload = encryptedResponse.data;
    // console.log("Enc err:", encryptedResponse.data.description);

    if (
      !encryptedResponse.success ||
      encryptedResponse.data.responseCode !== "0"
    ) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        encryptedPayload?.data?.description || "Encryption failed",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: encryptedPayload?.data?.description || "Encryption failed",
      });
    }

    const encData = encryptedPayload.data.encData;

    const payoutResponse = await payoutInitiate(encData, activeAccount);
    // console.log(payoutResponse, "Payout res");

    if (!payoutResponse.success || payoutResponse.data.responseCode !== "0") {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        payoutResponse?.data?.description || "Payout Initiation error",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: payoutResponse?.data?.description || "Payout Initiation error",
      });
    }

    const payoutData = payoutResponse.data;
    // console.log("✅ Payout data:", payoutData);

    const decryptedResponse = await decryptData(payoutData.data, activeAccount);
    // console.log(decryptedResponse.data, "Dec res");

    if (
      !decryptedResponse.success ||
      decryptedResponse.data.responseCode !== "0"
    ) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        decryptedResponse?.data?.description || "Decryption failed",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: decryptedResponse?.data?.description || "Decryption failed",
      });
    }

    const decData = decryptedResponse.data;
    // console.log("✅ Decrypted data:", decData);

    if (!decData.data) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        "Invalid response",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(500).json({
        success: false,
        message: "Invalid response",
      });
    }

    const data = decData.data;

    await TransactionsLog.updateOne(
      { referenceId: savedTransaction._id },
      {
        $set: {
          "connector.gatewayTransactionId": data.txnId,
        },
      },
      { session }
    );

    const encryptedStatusResponse = await encryptData(
      {
        requestId,
        txnId: data.txnId,
        enquiryId: "",
      },
      activeAccount
    );
    // console.log(encryptedStatusResponse.data, "Enc res");

    const encryptedStatusPayload = encryptedStatusResponse.data;

    if (
      !encryptedStatusResponse.success ||
      encryptedStatusPayload.responseCode !== "0"
    ) {
      // console.log("Enc err:", encryptedStatusResponse.data.description);
      await failTransaction(
        savedTransaction._id,
        merchantId,
        encryptedStatusPayload.data.description || "Encryption failed",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: encryptedStatusPayload.data.description || "Encryption failed",
      });
    }

    const encStatusData = encryptedStatusPayload.data.encData;

    const checkStatusRes = await payoutTransactionStatus(
      encStatusData,
      activeAccount
    );
    // console.log(checkStatusRes.data, "Payout res");

    if (checkStatusRes.data.responseCode !== "0") {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        checkStatusRes.data.description || "Check status failed",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: checkStatusRes.data.description || "Check status failed",
      });
    }

    // console.log("✅ Check Status data:", checkStatusRes.data);

    const statusData = checkStatusRes.data;

    const decryptedStatusResponse = await decryptData(
      statusData.data,
      activeAccount
    );
    // console.log(decryptedStatusResponse.data, "Dec res");

    if (
      !decryptedStatusResponse.success ||
      decryptedStatusResponse.data.responseCode !== "0"
    ) {
      await failTransaction(
        savedTransaction._id,
        merchantId,
        decryptedStatusResponse.data.description || "Decryption failed",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message:
          decryptedStatusResponse.data.description || "Decryption failed",
      });
    }

    const decStatusData = decryptedStatusResponse.data.data;

    if (decStatusData.txnStatus === "SUCCESS") {
      await Promise.all([
        PayoutTransaction.updateOne(
          { _id: savedTransaction._id },
          {
            transactionId: decStatusData.txnId,
            payoutEnquiryId: decStatusData.enquiryId,
            utr: decStatusData.utrNo,
            status: decStatusData.txnStatus,
            completedAt: decStatusData.txnDate,
          },
          { session }
        ),
        Merchant.updateOne(
          { userId: merchantId },
          {
            $inc: {
              totalTransactions: 1,
              payoutTransactions: 1,
              blockedBalance: -payoutAmount,
              totalDebits: payoutAmount,
              totalLastNetPayOut: payoutAmount,
              successfulTransactions: 1,
            },
            $set: {
              lastPayoutTransactions: savedTransaction._id,
            },
          },
          { session }
        ),
        User.updateOne(
          {
            _id: merchantId,
          },
          {
            $inc: {
              balance: -payoutAmount,
            },
          },
          { session }
        ),
      ]);

      const updatedMerchant = await Merchant.findOne(
        { userId: merchantId },
        { availableBalance: 1 },
        { session }
      );

      await TransactionsLog.updateOne(
        { referenceId: savedTransaction._id },
        {
          $set: {
            debit: payoutAmount,
            credit: 0,
            balance: updatedMerchant.availableBalance,
            status: "SUCCESS",
            description: "Payout completed successfully",
            "connector.gatewayTransactionId": decStatusData.txnId,
            "connector.gatewayOrderId": decStatusData.enquiryId,
            source: "API",
            txnCompletedDate: new Date(),
          },
        },
        { session }
      );
    } else if (["FAILED", "REVERSED"].includes(decStatusData.txnStatus)) {
      await Promise.all([
        PayoutTransaction.updateOne(
          { _id: savedTransaction._id },
          {
            transactionId: decStatusData.txnId,
            payoutEnquiryId: decStatusData.enquiryId,
            utr: decStatusData.utrNo,
            status: decStatusData.txnStatus,
            completedAt: decStatusData.txnDate,
          },
          { session }
        ),
        Merchant.updateOne(
          { userId: merchantId },
          {
            $inc: {
              availableBalance: payoutAmount,
              blockedBalance: -payoutAmount,
              totalTransactions: 1,
              payoutTransactions: 1,
              failedTransactions: 1,
            },
            $set: { lastPayoutTransactions: savedTransaction._id },
          },
          { session }
        ),
      ]);

      const updatedMerchant = await Merchant.findOne(
        { userId: merchantId },
        { availableBalance: 1 },
        { session }
      );

      await TransactionsLog.updateOne(
        { referenceId: savedTransaction._id },
        {
          $set: {
            debit: 0,
            credit: payoutAmount,
            balance: updatedMerchant.availableBalance,
            status: decStatusData.txnStatus,
            description: "Payout failed - amount released",
            "connector.gatewayTransactionId": decStatusData.txnId,
            "connector.gatewayOrderId": decStatusData.enquiryId,
            source: "API",
            txnCompletedDate: new Date(),
          },
        },
        { session }
      );
    } else {
      await Promise.all([
        PayoutTransaction.updateOne(
          { _id: savedTransaction._id },
          {
            transactionId: decStatusData.txnId,
            payoutEnquiryId: decStatusData.enquiryId,
            utr: decStatusData.utrNo,
            status: decStatusData.txnStatus,
            completedAt: decStatusData.txnDate,
          },
          { session }
        ),
        Merchant.updateOne(
          { userId: merchantId },
          {
            $set: { lastPayoutTransactions: savedTransaction._id },
          },
          { session }
        ),
      ]);
    }
    await session.commitTransaction();
    return res.status(201).json({
      success: true,
      message: "Payout initiated successfully",
      payoutTransaction: {
        requestId,
        status: decStatusData.txnStatus,
        utr: decStatusData.utrNo,
        transactionId: decStatusData.txnId,
      },
    });
  } catch (error) {
    console.error("❌ Payout error:", error);
    if (!savedTransaction?._id) {
      await session.abortTransaction(); // nothing to save
    } else {
      await failTransaction(
        savedTransaction._id,
        savedTransaction.merchantId,
        error.message || "Payout transaction failed",
        balanceBlocked,
        payoutAmount,
        session
      );
      await session.commitTransaction();
    }

    return res.status(500).json({
      success: false,
      message: "Payout transaction failed",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Update your createPayoutTransaction function
// controllers/payoutTransactionController.js मध्ये
// export const createPayoutTransaction = async (req, res) => {
//   try {
//     const {
//       merchantId,
//       transactionType,
//       amount,
//       remark,
//       feeApplied = false,
//       connector,
//     } = req.body;

//     // console.log("📦 Creating payout transaction (Simple Version):", req.body);

//     // 1. Validate required fields
//     if (!merchantId || !transactionType || !amount) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: merchantId, transactionType, amount",
//       });
//     }

//     // 2. Validate merchant
//     const merchant = await User.findById(merchantId);
//     if (!merchant || merchant.role !== "merchant") {
//       return res.status(404).json({
//         success: false,
//         message: "Merchant not found.",
//       });
//     }

//     // 3. Check balance for debit transactions
//     const transactionAmount = parseFloat(amount);
//     if (transactionType === "Debit" && merchant.balance < transactionAmount) {
//       return res.status(400).json({
//         success: false,
//         message: `Insufficient balance. Available: ₹${merchant.balance}, Required: ₹${transactionAmount}`,
//       });
//     }

//     // console.log(
//     //   `💰 Merchant balance: ${merchant.balance}, Transaction amount: ${transactionAmount}`
//     // );

//     // 4. Update merchant balance using atomic operation (NO TRANSACTION)
//     const updateOperation =
//       transactionType === "Debit"
//         ? { $inc: { balance: -transactionAmount } }
//         : { $inc: { balance: transactionAmount } };

//     // For debit, also check balance condition
//     const conditions =
//       transactionType === "Debit"
//         ? { _id: merchantId, balance: { $gte: transactionAmount } }
//         : { _id: merchantId };

//     const updatedMerchant = await User.findOneAndUpdate(
//       conditions,
//       updateOperation,
//       { new: true }
//     );

//     if (!updatedMerchant) {
//       return res.status(400).json({
//         success: false,
//         message:
//           transactionType === "Debit"
//             ? "Insufficient balance after validation"
//             : "Merchant update failed",
//       });
//     }

//     // 5. Create Payout Transaction
//     const merchantNameValue =
//       merchant.company ||
//       (merchant.firstname && merchant.lastname
//         ? `${merchant.firstname} ${merchant.lastname}`
//         : "Unknown Merchant");

//     const newPayout = new PayoutTransaction({
//       merchantId,
//       merchantName: merchantNameValue,
//       accountNumber: "N/A",
//       connector: connector || "Manual",
//       amount: transactionAmount,
//       paymentMode: "Wallet Transfer",
//       transactionType,
//       status: "Success",
//       webhook: "N/A",
//       remark,
//       feeApplied: feeApplied,
//       feeAmount: feeApplied ? transactionAmount * 0.02 : 0,
//       utr: generateUtr(),
//       transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
//     });

//     const savedPayout = await newPayout.save();

//     // console.log("✅ Payout transaction created successfully:", savedPayout._id);

//     res.status(201).json({
//       success: true,
//       message: "Payout transaction created successfully",
//       payoutTransaction: savedPayout,
//       newBalance: updatedMerchant.balance,
//     });
//   } catch (error) {
//     console.error("❌ Error creating payout transaction:", error);

//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: "Duplicate transaction detected. Please try again.",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Server error during payout creation.",
//       error: error.message,
//     });
//   }
// };

export const createPayoutTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      amount,
      transactionType,
      remark,
      connector,
      feeApplied = false,
    } = req.body;

    // console.log(req.body);
    // 1. Validation
    if (!merchantId || !transactionType || !amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Missing required fields: Merchant, Transaction Type, Amount",
      });
    }

    const payoutAmount = Number(amount);
    if (payoutAmount <= 0) {
      throw new Error("Invalid payout amount");
    }

    // 2. Fetch merchant
    const user = await User.findById(merchantId);
    if (!user || user.role !== "merchant") {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const merchant = await Merchant.findOne({ userId: merchantId }).session(
      session
    );

    if (!merchant) {
      throw new Error("Merchant not found");
    }

    merchant.payoutTransactions = merchant.payoutTransactions || 0;
    merchant.totalLastNetPayOut = merchant.totalLastNetPayOut || 0;
    merchant.totalCredits = merchant.totalCredits || 0;
    merchant.availableBalance = merchant.availableBalance || 0;
    merchant.totalTransactions = merchant.totalTransactions || 0;
    merchant.successfulTransactions = merchant.successfulTransactions || 0;
    merchant.failedTransactions = merchant.failedTransactions || 0;

    // 3. Balance check (ONLY available balance)
    if (
      transactionType === "Debit" &&
      merchant.availableBalance < payoutAmount
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${merchant.availableBalance}, Required: ₹${payoutAmount}`,
      });
    }

    // console.log(
    //   `💰 Merchant balance: ${merchant.availableBalance}, Transaction amount: ${payoutAmount}`
    // );

    merchant.totalTransactions += 1;
    merchant.payoutTransactions += 1;
    // 4. Deduct balance
    if (transactionType === "Debit") {
      merchant.availableBalance -= payoutAmount;
      merchant.totalDebits += payoutAmount;
      merchant.totalLastNetPayOut += payoutAmount;
      merchant.successfulTransactions += 1;

      await User.findByIdAndUpdate(merchantId, {
        $inc: { balance: -payoutAmount },
      }).session(session);
    } else {
      merchant.availableBalance += payoutAmount;
      merchant.totalCredits += payoutAmount;
      merchant.totalLastNetPayOut -= payoutAmount;
      merchant.successfulTransactions += 1;

      await User.findByIdAndUpdate(merchantId, {
        $inc: { balance: payoutAmount },
      }).session(session);
    }

    // 5. Create payout transaction
    const payoutTxn = new PayoutTransaction({
      merchantId,
      merchantName: merchant.company || merchant.merchantName,
      merchantEmail: merchant.email,
      mid: merchant.mid,
      accountNumber: "N/A",
      connector,
      amount: payoutAmount,
      paymentMode: "Wallet Transfer",
      transactionType,
      status: "Success",
      webhook: "N/A",
      remark,
      feeApplied,
      feeAmount: feeApplied ? payoutAmount * 0.02 : 0,
      utr: generateUtr(),
      transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    });

    await payoutTxn.save({ session });

    merchant.lastPayoutTransactions = payoutTxn._id;
    await merchant.save({ session });

    // return res.json({ success: false });
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Payout created successfully",
      payoutTransaction: payoutTxn,
      availableBalance: merchant.availableBalance,
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("❌ Payout creation failed:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};

// --- Get Payout Transactions (for your Payouts Transaction table) ---
export const getPayoutTransactions = async (req, res) => {
  try {
    const {
      merchant,
      status,
      connector,
      utr,
      accountNumber,
      transactionId,
      payoutId,
      requestId,
      startDate,
      endDate,
      // page = 1,
      // limit = 10
    } = req.query;

    console.log("📥 Fetching payout transactions with query:", req.query);

    let query = {};

    // Build query based on filters
    if (merchant && merchant !== "undefined") {
      query.merchantId = merchant;
    }
    if (status && status !== "undefined") query.status = status;
    // if (connector && connector !== "undefined") query.connector = connector;
    if (connector && connector !== "undefined") {
      query.connector = { $regex: `^${connector}$`, $options: "i" };
    }

    if (utr && utr !== "undefined") query.utr = { $regex: utr, $options: "i" };
    if (accountNumber && accountNumber !== "undefined")
      query.accountNumber = { $regex: accountNumber, $options: "i" };
    if (payoutId && payoutId !== "undefined")
      query.payoutId = { $regex: payoutId, $options: "i" };
    if (requestId && requestId !== "undefined")
      query.requestId = { $regex: requestId, $options: "i" };
    if (transactionId && transactionId !== "undefined")
      query.transactionId = { $regex: transactionId, $options: "i" };

    // Date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // const skip = (page - 1) * limit;

    console.log(query);

    // Fetch transactions with only the fields needed for your table
    const payouts = await PayoutTransaction.find(query)
      .select(
        "payoutId requestId transactionId utr merchantName accountNumber connector status amount paymentMode transactionType webhook createdAt"
      )
      .populate("merchantId", "firstname lastname")
      .sort({ createdAt: -1 });
    // .skip(skip)
    // .limit(parseInt(limit));

    const total = await PayoutTransaction.countDocuments(query);

    // console.log(`✅ Found ${payouts.length} payout transactions`);

    res.status(200).json({
      success: true,
      data: payouts,
      // pagination: {
      //   currentPage: parseInt(page),
      //   totalPages: Math.ceil(total / limit),
      //   totalItems: total,
      //   itemsPerPage: parseInt(limit)
      // }
    });
  } catch (error) {
    console.error("❌ Error fetching payout transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching payout transactions.",
      error: error.message,
    });
  }
};

export const getMerchantPayoutConnectors = async (req, res) => {
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

    const connectorAccounts = await MerchantPayoutConnectorAccount.find({
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

    return res.status(200).json({
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
// --- Create Internal Payout Transaction ---
export const createInternalPayoutTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      transactionType,
      amount,
      remark,
      applyFee = false,
    } = req.body;

    // console.log("📦 Creating internal payout with data:", req.body);

    const merchant = await User.findById(merchantId).session(session);
    if (!merchant || merchant.role !== "merchant") {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Merchant not found.",
      });
    }

    const finalAmount = parseFloat(amount);

    if (transactionType === "Debit") {
      if (merchant.balance < finalAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Insufficient balance.",
        });
      }
      merchant.balance -= finalAmount;
    } else if (transactionType === "Credit") {
      merchant.balance += finalAmount;
    } else {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type.",
      });
    }

    await merchant.save({ session });

    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName:
        merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      amount: finalAmount,
      applyFee: applyFee,
      transactionType,
      paymentMode: "Wallet Transfer",
      status: "Success",
      remark,
      utr: generateUtr(),
    });

    const savedPayout = await newPayout.save({ session });
    await session.commitTransaction();

    // console.log("✅ Internal payout created:", savedPayout._id);

    res.status(201).json({
      success: true,
      message: `Balance ${
        transactionType === "Debit" ? "debited" : "credited"
      } successfully.`,
      newBalance: merchant.balance,
      payoutTransaction: savedPayout,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error creating internal payout:", error);
    res.status(500).json({
      success: false,
      message: "Server error during transaction.",
    });
  } finally {
    session.endSession();
  }
};

// --- Get single Payout Transaction by ID ---
export const getPayoutTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await PayoutTransaction.findById(id)
      .populate("merchantId", "company firstname lastname email")
      .populate("recipientMerchantId", "company firstname lastname email");

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout transaction not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: payout,
    });
  } catch (error) {
    console.error("Error fetching payout transaction:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching payout transaction.",
    });
  }
};

// --- Get Merchant Bank Details ---
export const getMerchantBankDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await User.findById(merchantId).select(
      "bankDetails company firstname lastname"
    );

    if (!merchant || merchant.role !== "merchant") {
      return res.status(404).json({
        success: false,
        message: "Merchant not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bankDetails: merchant.bankDetails,
        merchantName:
          merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      },
    });
  } catch (error) {
    console.error("Error fetching bank details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching bank details.",
    });
  }
};

// --- Fetch all Merchants ---
// --- Fetch all Merchants ---
export const getAllMerchantsForPayout = async (req, res) => {
  try {
    // console.log("🔄 getAllMerchantsForPayout function called");

    // Database connection check
    // console.log("📊 MongoDB connection state:", mongoose.connection.readyState);
    // console.log("🏪 Database name:", mongoose.connection.name);

    // First, let's see ALL users in database
    // const allUsers = await User.find({})
    //   .select("_id firstname lastname role status email balance")
    //   .lean();
    // console.log("👥 TOTAL USERS IN DATABASE:", allUsers.length);
    // console.log(
    //   "📋 All users with balances:",
    //   JSON.stringify(allUsers, null, 2)
    // );

    // Now find only merchants with their balances
    // const merchants = await User.find({
    //   role: "merchant",
    //   status: "Active",
    // })
    //   .select(
    //     "_id firstname lastname company email contact balance bankDetails mid"
    //   )
    //   .lean();
    const merchants = await Merchant.find()
      .select("userId merchantName company email contact mid availableBalance")
      .populate({
        path: "userId",
        match: { status: "Active" }, // 👈 User status filter
        select: "firstname lastname email status",
      })
      .lean();

    // ❗ Remove merchants whose userId did not match
    const activeUsers = merchants.filter((m) => m.userId);

    // console.log("✅ MERCHANTS FOUND:", merchants.length);
    // console.log(
    //   "💰 Merchant balances:",
    //   merchants.map((m) => ({
    //     id: m._id,
    //     name: m.company || `${m.firstname} ${m.lastname}`,
    //     balance: m.balance,
    //   }))
    // );

    if (merchants.length === 0) {
      console.log('⚠️ No active merchants found with role="merchant"');
    }

    res.status(200).json({
      success: true,
      data: activeUsers,
      total: activeUsers.length,
      message: `Found ${activeUsers.length} active merchants`,
    });
  } catch (error) {
    console.error("❌ ERROR in getAllMerchantsForPayout:", error);
    res.status(500).json({
      success: false,
      message: "Database error",
      error: error.message,
    });
  }
};

// --- Fetch Payout Supported Connectors ---
export const getPayoutSupportedConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({
      isPayoutSupport: true,
      status: "Active",
    }).select("_id name");

    res.status(200).json({
      success: true,
      data: connectors,
    });
  } catch (error) {
    console.error("Error fetching connectors:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching connectors.",
    });
  }
};

export const getConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({ status: "Active" }).select(
      "_id name connectorType"
    );

    res.status(200).json({
      success: true,
      data: connectors,
    });
  } catch (error) {
    console.error("Error fetching connectors:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching connectors.",
    });
  }
};

// --- Payout to Merchant (External Payout) - Keep your existing function ---

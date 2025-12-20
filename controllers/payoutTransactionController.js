import PayoutTransaction from "../models/PayoutTransaction.js";
import User from "../models/User.js";
import Connector from "../models/Connector.js";
import Merchant from "../models/Merchant.js";
import mongoose from "mongoose";

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

// Simple version without MongoDB transactions
// controllers/payoutTransactionController.js - UPDATED createPayoutToMerchant
export const createPayoutToMerchant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
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

    console.log("📦 Creating payout to merchant with data:", req.body);

    // Validate required fields
    if (
      !merchantId ||
      !amount ||
      !bankName ||
      !accountNumber ||
      !ifscCode ||
      !accountHolderName
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: Merchant, Amount, Bank Name, Account Number, IFSC Code, Account Holder Name",
      });
    }

    // Update merchant balance with atomic operation
    const payoutAmount = parseFloat(amount);
    if (payoutAmount <= 0) {
      throw new Error("Invalid payout amount");
    }

    // Get merchant details first
    const user = await User.findById(merchantId).session(session);
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

    if (merchant.availableBalance < payoutAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${merchant.availableBalance}, Required: ₹${payoutAmount}`,
      });
    }

    merchant.totalTransactions += 1;
    merchant.payoutTransactions += 1;
    merchant.availableBalance -= payoutAmount;
    merchant.totalDebits += payoutAmount;
    merchant.totalLastNetPayOut += payoutAmount;
    merchant.successfulTransactions += 1;

    await User.findByIdAndUpdate(merchantId, {
      $inc: { balance: -payoutAmount },
    }).session(session);
    // const updatedMerchant = await User.findOneAndUpdate(
    //   {
    //     _id: merchantId,
    //     role: "merchant",
    //     balance: { $gte: payoutAmount }, // Check balance atomically
    //   },
    //   {
    //     $inc: { balance: -payoutAmount },
    //   },
    //   { new: true }
    // );

    // if (!updatedMerchant) {
    //   await session.abortTransaction();
    //   return res.status(400).json({
    //     success: false,
    //     message: "Insufficient balance or merchant not found",
    //   });
    // }

    // Generate unique IDs

    const payoutId = `P${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const utr = `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create Payout Transaction with ALL required fields
    const newPayout = new PayoutTransaction({
      // Required unique identifiers
      payoutId,
      transactionId,
      utr,

      // Merchant information
      merchantId,
      merchantName: merchant.company || `${merchant.merchantName}`,
      merchantEmail: merchant.email || customerEmail,
      mid: merchant.mid || `MID${merchantId.toString().slice(-6)}`,

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
      paymentMode: paymentMode || "IMPS",
      transactionType: "Debit",
      status: "Success",

      // Customer information
      customerEmail,
      customerPhoneNumber,

      // Additional fields
      remark: remark || "",
      responseUrl,

      // Default fields for UI
      accountNumber: "N/A",
      connector: "Manual",
      webhook: "N/A",
      feeApplied: false,
    });

    const savedPayout = await newPayout.save({ session });

    merchant.lastPayoutTransactions = savedPayout._id;
    await merchant.save({ session });

    await session.commitTransaction();
    session.endSession();

    // console.log("✅ Payout created successfully:", savedPayout._id);

    res.status(201).json({
      success: true,
      message: "Payout initiated successfully",
      payoutTransaction: savedPayout,
      newBalance: user.balance,
    });
  } catch (error) {
    console.error("❌ Error creating payout to merchant:", error);
    await session.abortTransaction();

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate transaction detected",
      });
    }

    // More detailed error information
    res.status(500).json({
      success: false,
      message: "Server error during payout creation",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
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
      startDate,
      endDate,
      // page = 1,
      // limit = 10
    } = req.query;

    // console.log("📥 Fetching payout transactions with query:", req.query);

    let query = {};

    // Build query based on filters
    if (merchant && merchant !== "undefined") {
      query.merchantId = merchant;
    }
    if (status && status !== "undefined") query.status = status;
    if (connector && connector !== "undefined") query.connector = connector;
    if (utr && utr !== "undefined") query.utr = { $regex: utr, $options: "i" };
    if (accountNumber && accountNumber !== "undefined")
      query.accountNumber = { $regex: accountNumber, $options: "i" };
    if (transactionId && transactionId !== "undefined")
      query.transactionId = { $regex: transactionId, $options: "i" };

    // Date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // const skip = (page - 1) * limit;

    // Fetch transactions with only the fields needed for your table
    const payouts = await PayoutTransaction.find(query)
      .select(
        "utr status merchantName accountNumber connector amount paymentMode transactionType webhook createdAt"
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
    const allUsers = await User.find({})
      .select("_id firstname lastname role status email balance")
      .lean();
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

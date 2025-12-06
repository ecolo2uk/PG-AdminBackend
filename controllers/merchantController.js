// controllers/merchantController.js
import Merchant from "../models/Merchant.js";
import Transaction from "../models/Transaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

// ✅ CORRECT IMPORT - Make sure this path is correct
import MerchantConnectorAccount from "../models/MerchantConnectorAccount.js";
// Helper to generate MID
const generateMid = () => {
  return (
    "M" +
    Date.now().toString() +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
  );
};

// Helper to generate unique transaction ID
const generateUniqueTransactionId = async () => {
  let transactionId;
  let isUnique = false;
  while (!isUnique) {
    transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const existingTxn = await Transaction.findOne({ transactionId });
    if (!existingTxn) {
      isUnique = true;
    }
  }
  return transactionId;
};

// Auto-sync when new transaction is created
const autoSyncTransaction = async (merchantUserId, transaction, type) => {
  try {
    const merchant = await Merchant.findOne({ userId: merchantUserId });
    if (!merchant) return;

    if (type === "payment") {
      if (!merchant.paymentTransactions.includes(transaction._id)) {
        merchant.paymentTransactions.push(transaction._id);
      }
    } else if (type === "payout") {
      if (!merchant.payoutTransactions.includes(transaction._id)) {
        merchant.payoutTransactions.push(transaction._id);
      }
    }

    await merchant.save();
    console.log(
      `✅ Auto-synced ${type} transaction for merchant: ${merchant.merchantName}`
    );
  } catch (error) {
    console.error("❌ Error in auto-sync:", error);
  }
};

const autoSyncToMerchant = async (merchantUserId, transactionData, type) => {
  try {
    console.log(`🔄 Auto-syncing ${type} transaction to merchant table`);

    const merchant = await Merchant.findOne({ userId: merchantUserId });
    if (!merchant) {
      console.log("❌ Merchant not found for auto-sync");
      return;
    }

    const newTransaction = {
      transactionId: transactionData.transactionId,
      type: type,
      transactionType: type === "payment" ? "Credit" : "Debit",
      amount: transactionData.amount,
      status: transactionData.status,
      reference:
        type === "payment"
          ? transactionData.merchantOrderId
          : transactionData.utr,
      method:
        type === "payment"
          ? transactionData.paymentMethod
          : transactionData.paymentMode,
      remark:
        transactionData.remark ||
        (type === "payment" ? "Payment Received" : "Payout Processed"),
      date: transactionData.createdAt || new Date(),
      customer: transactionData.customerName || "N/A",
    };

    // Add to recent transactions
    merchant.recentTransactions.unshift(newTransaction);
    if (merchant.recentTransactions.length > 20) {
      merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
    }

    // Update balance if transaction is successful
    if (
      transactionData.status === "Success" ||
      transactionData.status === "SUCCESS"
    ) {
      if (type === "payment") {
        merchant.availableBalance += transactionData.amount;
        merchant.totalCredits += transactionData.amount;
      } else if (type === "payout") {
        merchant.availableBalance -= transactionData.amount;
        merchant.totalDebits += transactionData.amount;
      }

      merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
    }

    // Update transaction summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(newTransaction.date) >= today) {
      if (newTransaction.transactionType === "Credit") {
        merchant.transactionSummary.today.credits += newTransaction.amount;
      } else {
        merchant.transactionSummary.today.debits += newTransaction.amount;
      }
      merchant.transactionSummary.today.count += 1;
    }

    await merchant.save();
    console.log(
      `✅ Auto-synced ${type} transaction for merchant: ${merchant.merchantName}`
    );
  } catch (error) {
    console.error("❌ Error in auto-sync to merchant:", error);
  }
};

// Create Merchant User (AUTO-CREATE IN BOTH TABLES)
// export const createMerchantUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { firstname, lastname, company, email, password, contact } = req.body;

//     console.log("💰 Creating merchant user in BOTH tables:", req.body);

//     // Validation
//     if (!firstname || !lastname || !email || !password || !contact) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'Please enter all required fields.'
//       });
//     }

//     // Check if user already exists
//     const existingUser = await User.findOne({ email }).session(session);
//     if (existingUser) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: 'User with this email already exists.'
//       });
//     }

//     // Hash password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     // Generate MID
//     const mid = generateMid();

//     // 1. FIRST CREATE USER
//     const user = new User({
//       firstname,
//       lastname,
//       company: company || '',
//       email,
//       password: hashedPassword,
//       role: 'merchant',
//       contact,
//       mid,
//       balance: 0,
//       unsettleBalance: 0
//     });

//     const savedUser = await user.save({ session });

//     // 2. THEN AUTOMATICALLY CREATE MERCHANT
//     const merchant = new Merchant({
//       userId: savedUser._id,
//       merchantName: company || `${firstname} ${lastname}`,
//       company: company || '',
//       email,
//       contact,
//       mid,
//       availableBalance: 0,
//       unsettledBalance: 0,
//       totalCredits: 0,
//       totalDebits: 0,
//       netEarnings: 0,
//       status: 'Active'
//     });

//     const savedMerchant = await merchant.save({ session });

//     // 3. UPDATE USER WITH MERCHANT REFERENCE
//     savedUser.merchantRef = savedMerchant._id;
//     await savedUser.save({ session });

//     await session.commitTransaction();

//     console.log("✅ Merchant user created in BOTH tables successfully");

//     const userResponse = savedUser.toObject();
//     delete userResponse.password;

//     res.status(201).json({
//       success: true,
//       message: 'Merchant user created successfully in both tables',
//       data: {
//         user: userResponse,
//         merchant: savedMerchant
//       }
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     console.error('❌ Error creating merchant user:', error);

//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: 'A user with this email or MID already exists.'
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Server error while creating merchant user.',
//       error: error.message
//     });
//   } finally {
//     session.endSession();
//   }
// };

// // 2. Get All Merchants with Complete Details
// export const getAllMerchants = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search = '' } = req.query;

//     const query = {};
//     if (search) {
//       query.$or = [
//         { merchantName: { $regex: search, $options: 'i' } },
//         { company: { $regex: search, $options: 'i' } },
//         { email: { $regex: search, $options: 'i' } },
//         { mid: { $regex: search, $options: 'i' } }
//       ];
//     }

//     const skip = (page - 1) * limit;

//     const merchants = await Merchant.find(query)
//       .select('merchantName company email contact mid availableBalance unsettledBalance totalCredits totalDebits netEarnings status createdAt')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit));

//     const total = await Merchant.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       data: merchants,
//       pagination: {
//         currentPage: parseInt(page),
//         totalPages: Math.ceil(total / limit),
//         totalItems: total,
//         itemsPerPage: parseInt(limit)
//       }
//     });

//   } catch (error) {
//     console.error("Error fetching merchants:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error fetching merchants",
//       error: error.message
//     });
//   }
// };

// // 3. Get Single Merchant with All Transactions
// export const getMerchantDetails = async (req, res) => {
//   try {
//     const { merchantId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(merchantId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Merchant ID"
//       });
//     }

//     // Get merchant basic info
//     const merchant = await Merchant.findById(merchantId);
//     if (!merchant) {
//       return res.status(404).json({
//         success: false,
//         message: "Merchant not found"
//       });
//     }

//     // Get user reference
//     const user = await User.findById(merchant.userId).select('firstname lastname');

//     // Get payment transactions
//     const paymentTransactions = await Transaction.find({ merchantId: merchant.userId })
//       .select('transactionId merchantOrderId amount status paymentMethod createdAt txnRefId customerName')
//       .sort({ createdAt: -1 })
//       .limit(100);

//     // Get payout transactions
//     const payoutTransactions = await PayoutTransaction.find({ merchantId: merchant.userId })
//       .select('utr transactionId amount transactionType status paymentMode remark createdAt')
//       .sort({ createdAt: -1 })
//       .limit(100);

//     // Calculate real-time statistics
//     const totalCredits = paymentTransactions
//       .filter(txn => ['SUCCESS', 'Success'].includes(txn.status))
//       .reduce((sum, txn) => sum + txn.amount, 0);

//     const totalDebits = payoutTransactions
//       .filter(txn => txn.status === 'Success' && txn.transactionType === 'Debit')
//       .reduce((sum, txn) => sum + txn.amount, 0);

//     // Update merchant with latest calculations
//     merchant.totalCredits = totalCredits;
//     merchant.totalDebits = totalDebits;
//     merchant.netEarnings = totalCredits - totalDebits;
//     merchant.totalTransactions = paymentTransactions.length;
//     merchant.successfulTransactions = paymentTransactions.filter(txn =>
//       ['SUCCESS', 'Success'].includes(txn.status)
//     ).length;
//     merchant.failedTransactions = paymentTransactions.filter(txn =>
//       ['FAILED', 'Failed'].includes(txn.status)
//     ).length;

//     await merchant.save();

//     // Combine transactions for timeline
//     const allTransactions = [
//       ...paymentTransactions.map(txn => ({
//         _id: txn._id,
//         type: 'payment',
//         transactionId: txn.transactionId,
//         reference: txn.merchantOrderId,
//         amount: txn.amount,
//         transactionType: 'Credit',
//         status: txn.status,
//         method: txn.paymentMethod,
//         date: txn.createdAt,
//         customer: txn.customerName,
//         remark: 'Payment Received'
//       })),
//       ...payoutTransactions.map(txn => ({
//         _id: txn._id,
//         type: 'payout',
//         transactionId: txn.transactionId || txn.utr,
//         reference: txn.utr,
//         amount: txn.amount,
//         transactionType: txn.transactionType,
//         status: txn.status,
//         method: txn.paymentMode,
//         date: txn.createdAt,
//         customer: '-',
//         remark: txn.remark || 'Payout Processed'
//       }))
//     ].sort((a, b) => new Date(b.date) - new Date(a.date));

//     res.status(200).json({
//       success: true,
//       data: {
//         merchantInfo: {
//           _id: merchant._id,
//           merchantName: merchant.merchantName,
//           company: merchant.company,
//           email: merchant.email,
//           contact: merchant.contact,
//           mid: merchant.mid,
//           status: merchant.status,
//           bankDetails: merchant.bankDetails,
//           userInfo: user
//         },
//         balanceSummary: {
//           availableBalance: merchant.availableBalance,
//           unsettledBalance: merchant.unsettledBalance,
//           totalCredits: merchant.totalCredits,
//           totalDebits: merchant.totalDebits,
//           netEarnings: merchant.netEarnings
//         },
//         transactionStats: {
//           totalTransactions: merchant.totalTransactions,
//           successfulTransactions: merchant.successfulTransactions,
//           failedTransactions: merchant.failedTransactions,
//           successRate: merchant.totalTransactions > 0 ?
//             ((merchant.successfulTransactions / merchant.totalTransactions) * 100).toFixed(2) : 0
//         },
//         transactions: allTransactions,
//         transactionCount: {
//           payments: paymentTransactions.length,
//           payouts: payoutTransactions.length,
//           total: allTransactions.length
//         }
//       }
//     });

//   } catch (error) {
//     console.error("Error fetching merchant details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error fetching merchant details",
//       error: error.message
//     });
//   }
// };

// 4. Update Merchant Balance (Credit/Debit)
export const updateMerchantBalance = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { merchantId } = req.params;
    const { amount, type, remark } = req.body; // type: 'credit' or 'debit'

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid Merchant ID",
      });
    }

    const merchant = await Merchant.findById(merchantId).session(session);
    if (!merchant) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const transactionAmount = parseFloat(amount);

    if (type === "debit" && merchant.availableBalance < transactionAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${merchant.availableBalance}, Required: ₹${transactionAmount}`,
      });
    }

    // Update merchant balance
    if (type === "credit") {
      merchant.availableBalance += transactionAmount;
      merchant.totalCredits += transactionAmount;
    } else if (type === "debit") {
      merchant.availableBalance -= transactionAmount;
      merchant.totalDebits += transactionAmount;
    }

    merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
    await merchant.save({ session });

    // Also update user balance
    const user = await User.findById(merchant.userId).session(session);
    if (user) {
      user.balance = merchant.availableBalance;
      await user.save({ session });
    }

    // Create payout transaction record
    const payoutTransaction = new PayoutTransaction({
      merchantId: merchant.userId,
      merchantName: merchant.merchantName,
      amount: transactionAmount,
      transactionType: type === "credit" ? "Credit" : "Debit",
      paymentMode: "Manual Adjustment",
      status: "Success",
      remark: remark || `${type === "credit" ? "Credit" : "Debit"} adjustment`,
      utr: `ADJ${Date.now()}`,
      transactionId: `ADJ${Date.now()}${Math.floor(Math.random() * 1000)}`,
    });

    await payoutTransaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Balance ${
        type === "credit" ? "credited" : "debited"
      } successfully`,
      data: {
        newBalance: merchant.availableBalance,
        transaction: payoutTransaction,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating merchant balance:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating balance",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// 5. Get Merchant Balance History
export const getMerchantBalanceHistory = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { days = 30 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Merchant ID",
      });
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get all transactions for balance history
    const paymentTransactions = await Transaction.find({
      merchantId: merchant.userId,
      createdAt: { $gte: startDate },
    })
      .select("amount status createdAt transactionId")
      .sort({ createdAt: 1 });

    const payoutTransactions = await PayoutTransaction.find({
      merchantId: merchant.userId,
      createdAt: { $gte: startDate },
    })
      .select("amount transactionType status createdAt utr")
      .sort({ createdAt: 1 });

    // Create balance timeline
    const balanceHistory = [];
    let runningBalance = 0;

    const allTransactions = [
      ...paymentTransactions
        .filter((txn) => ["SUCCESS", "Success"].includes(txn.status))
        .map((txn) => ({ ...txn.toObject(), type: "credit" })),
      ...payoutTransactions
        .filter((txn) => txn.status === "Success")
        .map((txn) => ({
          ...txn.toObject(),
          type: txn.transactionType.toLowerCase(),
        })),
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    allTransactions.forEach((transaction) => {
      if (transaction.type === "credit") {
        runningBalance += transaction.amount;
      } else {
        runningBalance -= transaction.amount;
      }

      balanceHistory.push({
        date: transaction.createdAt,
        type: transaction.type,
        amount: transaction.amount,
        balance: runningBalance,
        reference:
          transaction.type === "credit"
            ? transaction.transactionId
            : transaction.utr,
        description:
          transaction.type === "credit"
            ? "Payment Received"
            : "Payout Processed",
      });
    });

    res.status(200).json({
      success: true,
      data: {
        balanceHistory,
        currentBalance: merchant.availableBalance,
        startDate,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error("Error fetching balance history:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching balance history",
      error: error.message,
    });
  }
};

// controllers/merchantController.js (Updated)
// ... previous imports ...

// Get Merchant with Transactions
export const getMerchantWithTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const {
      transactionType,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Merchant ID",
      });
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Filter transactions based on query parameters
    let filteredTransactions = [...merchant.recentTransactions];

    if (transactionType && transactionType !== "all") {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.transactionType.toLowerCase() === transactionType.toLowerCase()
      );
    }

    if (status && status !== "all") {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredTransactions = filteredTransactions.filter(
        (t) => new Date(t.date) >= start
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredTransactions = filteredTransactions.filter(
        (t) => new Date(t.date) <= end
      );
    }

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedTransactions = filteredTransactions.slice(
      skip,
      skip + parseInt(limit)
    );

    // Calculate totals
    const totalCredits = filteredTransactions
      .filter((t) => t.transactionType === "Credit" && t.status === "Success")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = filteredTransactions
      .filter((t) => t.transactionType === "Debit" && t.status === "Success")
      .reduce((sum, t) => sum + t.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        merchantInfo: {
          _id: merchant._id,
          merchantName: merchant.merchantName,
          company: merchant.company,
          email: merchant.email,
          mid: merchant.mid,
          status: merchant.status,
        },
        balance: {
          available: merchant.availableBalance,
          unsettled: merchant.unsettledBalance,
          netEarnings: merchant.netEarnings,
        },
        transactions: paginatedTransactions,
        transactionSummary: {
          total: filteredTransactions.length,
          credits: totalCredits,
          debits: totalDebits,
          net: totalCredits - totalDebits,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredTransactions.length / limit),
          totalItems: filteredTransactions.length,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching merchant with transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching merchant transactions",
      error: error.message,
    });
  }
};

// Get Transaction Statistics
export const getMerchantTransactionStats = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const stats = {
      daily: merchant.transactionSummary.today,
      weekly: merchant.transactionSummary.last7Days,
      monthly: merchant.transactionSummary.last30Days,
      overall: {
        credits: merchant.totalCredits,
        debits: merchant.totalDebits,
        netEarnings: merchant.netEarnings,
        totalTransactions: merchant.totalTransactions,
      },
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching transaction stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching transaction statistics",
      error: error.message,
    });
  }
};

export const getMerchantDashboard = async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log("🔄 Fetching dashboard for merchant:", merchantId);

    // Validate merchantId
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID",
      });
    }

    // Get merchant info from User model
    const merchantInfo = await User.findById(merchantId).select(
      "firstname lastname company email contact mid status balance unsettleBalance"
    );

    if (!merchantInfo) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Get merchant data from Merchant model
    const merchantData = await Merchant.findOne({ userId: merchantId });

    // Get transaction stats
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          merchantId: merchantId,
          $or: [
            { status: "SUCCESS" },
            { status: "Success" },
            { status: "FAILED" },
            { status: "Failed" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          successfulTransactions: {
            $sum: {
              $cond: [{ $in: ["$status", ["SUCCESS", "Success"]] }, 1, 0],
            },
          },
          failedTransactions: {
            $sum: {
              $cond: [{ $in: ["$status", ["FAILED", "Failed"]] }, 1, 0],
            },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const stats = transactionStats[0] || {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalAmount: 0,
    };

    // Calculate success rate
    const successRate =
      stats.totalTransactions > 0
        ? Math.round(
            (stats.successfulTransactions / stats.totalTransactions) * 100
          )
        : 0;

    // Get recent transactions
    const recentTransactions = await Transaction.find({
      merchantId: merchantId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "transactionId amount status merchantOrderId paymentMethod customerName createdAt"
      );

    // Prepare response data
    const dashboardData = {
      merchantInfo: {
        merchantName:
          merchantInfo.company ||
          `${merchantInfo.firstname} ${merchantInfo.lastname}`,
        mid: merchantInfo.mid,
        status: merchantInfo.status,
        email: merchantInfo.email,
        contact: merchantInfo.contact,
      },
      balanceSummary: {
        availableBalance:
          merchantData?.availableBalance || merchantInfo.balance || 0,
        unsettledBalance:
          merchantData?.unsettledBalance || merchantInfo.unsettleBalance || 0,
        totalCredits: merchantData?.totalCredits || 0,
        totalDebits: merchantData?.totalDebits || 0,
        netEarnings: merchantData?.netEarnings || 0,
      },
      transactionStats: {
        totalTransactions: stats.totalTransactions,
        successfulTransactions: stats.successfulTransactions,
        failedTransactions: stats.failedTransactions,
        successRate: successRate,
        totalAmount: stats.totalAmount,
      },
      transactionCount: {
        payments: stats.totalTransactions,
        payouts: 0, // You can add payout logic if needed
        total: stats.totalTransactions,
      },
      transactions: recentTransactions.map((txn) => ({
        _id: txn._id,
        transactionId: txn.transactionId,
        type: "payment",
        transactionType: "Credit",
        amount: txn.amount,
        status: txn.status,
        reference: txn.merchantOrderId,
        method: txn.paymentMethod,
        remark: "Payment Received",
        date: txn.createdAt,
        customer: txn.customerName || "N/A",
      })),
    };

    console.log("✅ Dashboard data prepared for merchant:", merchantId);

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("❌ Error fetching merchant dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard data",
      error: error.message,
    });
  }
};

export const syncMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log("🔄 Syncing transactions for merchant:", merchantId);

    // Validate merchantId
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID",
      });
    }

    // Find unsynced transactions and sync them
    const unsyncedTransactions = await Transaction.find({
      merchantId: merchantId,
      synced: { $ne: true }, // Add a synced field to track sync status
    });

    let syncedCount = 0;

    // Sync each transaction
    for (const transaction of unsyncedTransactions) {
      try {
        // Your sync logic here (similar to the post-save hook)
        const merchant = await Merchant.findOne({ userId: merchantId });

        if (merchant) {
          // Add to paymentTransactions array if not already present
          if (!merchant.paymentTransactions.includes(transaction._id)) {
            merchant.paymentTransactions.push(transaction._id);
          }

          // Update recentTransactions array
          const newTransaction = {
            transactionId: transaction.transactionId,
            type: "payment",
            transactionType: "Credit",
            amount: transaction.amount,
            status: transaction.status,
            reference: transaction.merchantOrderId,
            method: transaction.paymentMethod,
            remark: "Payment Received",
            date: transaction.createdAt,
            customer: transaction.customerName || "N/A",
          };

          merchant.recentTransactions.unshift(newTransaction);

          // Keep only last 20 transactions
          if (merchant.recentTransactions.length > 20) {
            merchant.recentTransactions = merchant.recentTransactions.slice(
              0,
              20
            );
          }

          // Update balance if transaction is successful
          if (
            transaction.status === "SUCCESS" ||
            transaction.status === "Success"
          ) {
            merchant.availableBalance += transaction.amount;
            merchant.totalCredits += transaction.amount;
            merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;

            // Also update user balance
            await User.findByIdAndUpdate(merchantId, {
              $inc: { balance: transaction.amount },
            });
          }

          // Update transaction counts
          merchant.totalTransactions = merchant.paymentTransactions.length;
          merchant.successfulTransactions = merchant.paymentTransactions.filter(
            (txnId) => txnId.status === "SUCCESS" || txnId.status === "Success"
          ).length;

          await merchant.save();

          // Mark transaction as synced
          transaction.synced = true;
          await transaction.save();

          syncedCount++;
        }
      } catch (syncError) {
        console.error(
          `❌ Error syncing transaction ${transaction._id}:`,
          syncError
        );
      }
    }

    console.log(
      `✅ Synced ${syncedCount} transactions for merchant: ${merchantId}`
    );

    res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedCount} transactions`,
      syncedCount: syncedCount,
    });
  } catch (error) {
    console.error("❌ Error syncing merchant transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while syncing transactions",
      error: error.message,
    });
  }
};

// 3. Create Payment Transaction (WITH AUTO-SYNC)
export const createPaymentTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      merchantOrderId,
      amount,
      currency = "INR",
      status = "Pending",
      customerName,
      customerVpa,
      customerContact,
      paymentMethod,
      paymentOption,
      txnRefId,
      enpayTxnId,
      remark,
    } = req.body;

    // Validate Merchant
    const merchantUser = await User.findById(merchantId).session(session);
    if (!merchantUser || merchantUser.role !== "merchant") {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Merchant not found.",
      });
    }

    // Generate transaction ID
    const transactionId = await generateUniqueTransactionId();

    const newTransaction = new Transaction({
      transactionId,
      merchantId: merchantUser._id,
      merchantName:
        merchantUser.company ||
        `${merchantUser.firstname} ${merchantUser.lastname}`,
      merchantOrderId,
      amount: parseFloat(amount),
      currency,
      status,
      customerName,
      customerVpa,
      customerContact,
      paymentMethod,
      paymentOption,
      txnRefId,
      enpayTxnId,
      remark,
    });

    await newTransaction.save({ session });

    // AUTO-SYNC TO MERCHANT TABLE
    await autoSyncTransaction(merchantUser._id, newTransaction, "payment");
    await autoSyncToMerchant(merchantUser._id, newTransaction, "payment");

    // Update user balance if success
    if (["Success", "SUCCESS"].includes(status)) {
      merchantUser.balance += parseFloat(amount);
      await merchantUser.save({ session });
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Payment transaction created and synced to merchant.",
      data: newTransaction,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating payment transaction:", error);
    res.status(500).json({
      success: false,
      message: "Server error during payment transaction creation.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ========== EXISTING FUNCTIONS ==========

// Get All Merchants
export const getAllMerchants = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { merchantName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mid: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const merchants = await Merchant.find(query)
      .select(
        "merchantName company email contact mid availableBalance unsettledBalance totalCredits totalDebits netEarnings status createdAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Merchant.countDocuments(query);

    res.status(200).json({
      success: true,
      data: merchants,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching merchants",
      error: error.message,
    });
  }
};

// Get Merchant Users
export const getMerchantUsers = async (req, res) => {
  try {
    console.log("🔍 Fetching merchant users...");

    const users = await User.find({ role: "merchant" })
      .select("-password")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${users.length} merchant users`);

    const usersWithFinancialData = users.map((user) => ({
      ...user._doc,
      holdAmount: user.holdAmount || 0,
      unsettleBal: user.unsettleBalance || 0,
      todayNetPayin: 0,
      availableBal: user.balance || 0,
      payoutBal: 0,
      payoutMid: "N/A",
      // payoutBal: Math.random() > 0.5 ? 1500 : 1000,
      // payoutMid: Math.random() > 0.5 ? "PayoutOne/1 L" : "NA / NA",
      status: user.status || "Active",
    }));

    res.status(200).json({
      success: true,
      data: usersWithFinancialData,
    });
  } catch (error) {
    console.error("❌ Error fetching merchant users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching merchant users.",
      error: error.message,
    });
  }
};

// Create Merchant User
// controllers/merchantController.js - COMPLETELY FIXED VERSION
export const createMerchantUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstname, lastname, company, email, password, contact } = req.body;

    console.log("🔄 STEP 1: Starting merchant creation process...", req.body);

    // Enhanced Validation
    if (
      !firstname?.trim() ||
      !lastname?.trim() ||
      !email?.trim() ||
      !password ||
      !contact?.trim()
    ) {
      await session.abortTransaction();
      console.log("❌ Validation failed: Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Please enter all required fields.",
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await session.abortTransaction();
      console.log("❌ Validation failed: Invalid email format");
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    console.log("🔄 STEP 2: Checking for existing user...");

    // Check if user already exists (case insensitive)
    const existingUser = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      console.log("❌ User already exists:", email);
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    console.log("🔄 STEP 3: Generating MID and hashing password...");

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate MID
    const mid =
      "M" +
      Date.now().toString() +
      Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");

    console.log("🔄 STEP 4: Creating User document...");

    // 1. FIRST CREATE USER - WITH ALL REQUIRED FIELDS
    const userData = {
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      company: company?.trim() || "",
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "merchant",
      contact: contact.trim(),
      mid: mid,
      balance: 0,
      unsettleBalance: 0,
      status: "Active",
    };

    console.log("📝 User data to be saved:", userData);

    const user = new User(userData);

    // Validate user document before saving
    const userValidationError = user.validateSync();
    if (userValidationError) {
      await session.abortTransaction();
      console.log("❌ User validation failed:", userValidationError.errors);
      return res.status(400).json({
        success: false,
        message: `User validation failed: ${Object.values(
          userValidationError.errors
        )
          .map((err) => err.message)
          .join(", ")}`,
      });
    }

    const savedUser = await user.save({ session });
    console.log("✅ STEP 5: User created successfully:", savedUser._id);

    console.log("🔄 STEP 6: Creating Merchant document...");

    // 2. THEN CREATE MERCHANT RECORD
    const merchantName =
      company?.trim() || `${firstname.trim()} ${lastname.trim()}`;

    const merchantData = {
      userId: savedUser._id,
      merchantName: merchantName,
      company: company?.trim() || "",
      email: email.toLowerCase().trim(),
      contact: contact.trim(),
      mid: mid,
      availableBalance: 0,
      unsettledBalance: 0,
      totalCredits: 0,
      totalDebits: 0,
      netEarnings: 0,
      status: "Active",
      paymentTransactions: [],
      payoutTransactions: [],
      recentTransactions: [],
      transactionSummary: {
        today: { credits: 0, debits: 0, count: 0 },
        last7Days: { credits: 0, debits: 0, count: 0 },
        last30Days: { credits: 0, debits: 0, count: 0 },
      },
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
    };

    console.log("📝 Merchant data to be saved:", merchantData);

    const merchant = new Merchant(merchantData);

    // Validate merchant document before saving
    const merchantValidationError = merchant.validateSync();
    if (merchantValidationError) {
      await session.abortTransaction();
      console.log(
        "❌ Merchant validation failed:",
        merchantValidationError.errors
      );
      return res.status(400).json({
        success: false,
        message: `Merchant validation failed: ${Object.values(
          merchantValidationError.errors
        )
          .map((err) => err.message)
          .join(", ")}`,
      });
    }

    const savedMerchant = await merchant.save({ session });
    console.log("✅ STEP 7: Merchant created successfully:", savedMerchant._id);

    console.log("🔄 STEP 8: Updating user with merchant reference...");

    // 3. UPDATE USER WITH MERCHANT REFERENCE
    savedUser.merchantRef = savedMerchant._id;
    await savedUser.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log("🎉 STEP 9: Transaction committed successfully!");
    console.log("📊 Final Results:");
    console.log("   👤 User ID:", savedUser._id);
    console.log("   🏪 Merchant ID:", savedMerchant._id);
    console.log("   📧 Email:", savedUser.email);
    console.log("   🆔 MID:", savedUser.mid);

    // Prepare response without password
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "Merchant user created successfully in both tables",
      data: {
        user: userResponse,
        merchant: savedMerchant,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ FINAL ERROR creating merchant user:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      console.log(`❌ Duplicate key error on field: ${field}`);
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists.`,
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      console.log(`❌ Validation error: ${messages.join(", ")}`);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating merchant user.",
      error: error.message,
    });
  }
};

// Update Merchant User
export const updateMerchantUser = async (req, res) => {
  try {
    console.log("🔄 Updating merchant user:", req.params.id, req.body);

    const { firstname, lastname, company, email, contact, status, password } =
      req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user || user.role !== "merchant") {
      return res.status(404).json({
        success: false,
        message: "Merchant user not found or is not a merchant.",
      });
    }

    // Update fields
    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (company !== undefined) user.company = company;
    if (contact) user.contact = contact;
    if (status) user.status = status;

    // Email validation and uniqueness check
    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address for update.",
        });
      }
      const existingUserWithEmail = await User.findOne({ email });
      if (
        existingUserWithEmail &&
        existingUserWithEmail._id.toString() !== userId
      ) {
        return res.status(400).json({
          success: false,
          message: "Another user with this email already exists.",
        });
      }
      user.email = email;
    }

    // Password update
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long.",
        });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    console.log("✅ Merchant user updated successfully");

    res.status(200).json({
      success: true,
      message: "Merchant user updated successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("❌ Error updating merchant user:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating merchant user.",
      error: error.message,
    });
  }
};

// Delete Merchant User
export const deleteMerchantUser = async (req, res) => {
  try {
    console.log("🗑️ Deleting merchant user:", req.params.id);

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: Only merchant users can be deleted via this endpoint.",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    console.log("✅ Merchant user deleted successfully");

    res.status(200).json({
      success: true,
      message: "Merchant user deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Error deleting merchant user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting merchant user.",
      error: error.message,
    });
  }
};

// Get Merchant By ID
export const getMerchantById = async (req, res) => {
  try {
    const merchant = await User.findById(req.params.id).select("-password");

    if (!merchant || merchant.role !== "merchant") {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    res.status(200).json({
      success: true,
      data: merchant,
    });
  } catch (error) {
    console.error("Error fetching merchant:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get Merchant Details
export const getMerchantDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Merchant ID",
      });
    }

    // Get merchant basic info
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Get user reference
    const user = await User.findById(merchant.userId).select(
      "firstname lastname"
    );

    // Get payment transactions
    const paymentTransactions = await Transaction.find({
      merchantId: merchant.userId,
    })
      .select(
        "transactionId merchantOrderId amount status paymentMethod createdAt txnRefId customerName"
      )
      .sort({ createdAt: -1 })
      .limit(100);

    // Get payout transactions
    const payoutTransactions = await PayoutTransaction.find({
      merchantId: merchant.userId,
    })
      .select(
        "utr transactionId amount transactionType status paymentMode remark createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(100);

    // Calculate real-time statistics
    const totalCredits = paymentTransactions
      .filter((txn) => ["SUCCESS", "Success"].includes(txn.status))
      .reduce((sum, txn) => sum + txn.amount, 0);

    const totalDebits = payoutTransactions
      .filter(
        (txn) => txn.status === "Success" && txn.transactionType === "Debit"
      )
      .reduce((sum, txn) => sum + txn.amount, 0);

    // Update merchant with latest calculations
    merchant.totalCredits = totalCredits;
    merchant.totalDebits = totalDebits;
    merchant.netEarnings = totalCredits - totalDebits;
    merchant.totalTransactions = paymentTransactions.length;
    merchant.successfulTransactions = paymentTransactions.filter((txn) =>
      ["SUCCESS", "Success"].includes(txn.status)
    ).length;
    merchant.failedTransactions = paymentTransactions.filter((txn) =>
      ["FAILED", "Failed"].includes(txn.status)
    ).length;

    await merchant.save();

    // Combine transactions for timeline
    const allTransactions = [
      ...paymentTransactions.map((txn) => ({
        _id: txn._id,
        type: "payment",
        transactionId: txn.transactionId,
        reference: txn.merchantOrderId,
        amount: txn.amount,
        transactionType: "Credit",
        status: txn.status,
        method: txn.paymentMethod,
        date: txn.createdAt,
        customer: txn.customerName,
        remark: "Payment Received",
      })),
      ...payoutTransactions.map((txn) => ({
        _id: txn._id,
        type: "payout",
        transactionId: txn.transactionId || txn.utr,
        reference: txn.utr,
        amount: txn.amount,
        transactionType: txn.transactionType,
        status: txn.status,
        method: txn.paymentMode,
        date: txn.createdAt,
        customer: "-",
        remark: txn.remark || "Payout Processed",
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: {
        merchantInfo: {
          _id: merchant._id,
          merchantName: merchant.merchantName,
          company: merchant.company,
          email: merchant.email,
          contact: merchant.contact,
          mid: merchant.mid,
          status: merchant.status,
          bankDetails: merchant.bankDetails,
          userInfo: user,
        },
        balanceSummary: {
          availableBalance: merchant.availableBalance,
          unsettledBalance: merchant.unsettledBalance,
          totalCredits: merchant.totalCredits,
          totalDebits: merchant.totalDebits,
          netEarnings: merchant.netEarnings,
        },
        transactionStats: {
          totalTransactions: merchant.totalTransactions,
          successfulTransactions: merchant.successfulTransactions,
          failedTransactions: merchant.failedTransactions,
          successRate:
            merchant.totalTransactions > 0
              ? (
                  (merchant.successfulTransactions /
                    merchant.totalTransactions) *
                  100
                ).toFixed(2)
              : 0,
        },
        transactions: allTransactions,
        transactionCount: {
          payments: paymentTransactions.length,
          payouts: payoutTransactions.length,
          total: allTransactions.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching merchant details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching merchant details",
      error: error.message,
    });
  }
};

export const getMerchantPayoutBalance = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // Find the merchant and populate the payout transactions
    const merchant = await Merchant.findById(merchantId).populate(
      "payoutTransactions"
    );

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Calculate the total payout balance
    const totalPayouts = merchant.payoutTransactions.reduce((acc, txn) => {
      return acc + (txn.status === "SUCCESS" ? txn.amount : 0);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        merchantId: merchant._id,
        totalPayouts,
      },
    });
  } catch (error) {
    console.error("Error fetching merchant payout balance:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching merchant payout balance",
      error: error.message,
    });
  }
};

// controllers/merchantController.js
export const getMerchantConnectors = async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log("🔍 Fetching connector accounts for merchant:", merchantId);

    // Validate merchantId
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID",
      });
    }

    // Check if merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: "Active",
    })
      .populate("connectorId", "name connectorType")
      .populate("connectorAccountId", "name currency")
      .select("terminalId industry percentage isPrimary status")
      .lean();

    console.log(
      `✅ Found ${connectorAccounts.length} connector accounts for merchant: ${merchantId}`
    );

    const formattedAccounts = connectorAccounts.map((account) => ({
      _id: account._id,
      terminalId: account.terminalId,
      connector: account.connectorId?.name || "Unknown",
      assignedAccount: account.connectorAccountId?.name || "Unknown",
      connectorName: account.connectorId?.name || "Unknown",
      accountName: account.connectorAccountId?.name || "Unknown",
      currency: account.connectorAccountId?.currency || "INR",
      industry: account.industry,
      percentage: account.percentage,
      isPrimary: account.isPrimary,
      status: account.status,
    }));

    res.status(200).json({
      success: true,
      data: formattedAccounts,
    });
  } catch (error) {
    console.error("❌ Error fetching merchant connectors:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching connector accounts",
      error: error.message,
    });
  }
};

// Add to your merchantController.js
export const debugRoutes = async (req, res) => {
  try {
    const { merchantId } = req.params;
    console.log("🔍 DEBUG: Checking routes for merchant:", merchantId);

    // Check if merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Check connector accounts
    const connectorAccounts = await MerchantConnectorAccount.find({
      merchantId: merchantId,
      status: "Active",
    });

    res.json({
      success: true,
      message: "Route is working",
      merchant: {
        name: `${merchant.firstname} ${merchant.lastname}`,
        mid: merchant.mid,
      },
      connectorCount: connectorAccounts.length,
      connectors: connectorAccounts.map((acc) => ({
        id: acc._id,
        terminalId: acc.terminalId,
        status: acc.status,
      })),
    });
  } catch (error) {
    console.error("❌ DEBUG Route error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

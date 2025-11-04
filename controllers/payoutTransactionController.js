import PayoutTransaction from "../models/PayoutTransaction.js";
import User from "../models/User.js";
import Connector from "../models/Connector.js";
import ConnectorAccount from "../models/ConnectorAccount.js";
import mongoose from "mongoose";

// Generate unique transaction ID
const generateTransactionId = () => {
  const prefix = "O";
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
  const timestamp = Date.now().toString().substring(7);
  return prefix + randomChars + timestamp;
};

// Generate unique UTR
const generateUTR = () => {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

// 🆕 Get merchant transactions and balance
export const getMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        message: "Merchant ID is required"
      });
    }

    // Get merchant details
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    // Get all transactions for this merchant
    const transactions = await PayoutTransaction.find({ merchantId })
      .sort({ createdAt: -1 })
      .select('transactionId amount status type transactionType createdAt remark');

    // Calculate current balance from transactions
    let currentBalance = merchant.unsettleBalance || 0;
    
    // If you want to calculate balance from transactions history:
    const balanceFromTransactions = transactions.reduce((balance, transaction) => {
      if (transaction.status === "Success") {
        if (transaction.transactionType === "Debit") {
          return balance - transaction.amount;
        } else if (transaction.transactionType === "Credit") {
          return balance + transaction.amount;
        }
      }
      return balance;
    }, merchant.unsettleBalance);

    res.status(200).json({
      success: true,
      data: {
        merchant: {
          _id: merchant._id,
          name: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
          email: merchant.email,
          initialBalance: merchant.unsettleBalance || 0,
          currentBalance: balanceFromTransactions
        },
        transactions: transactions,
        summary: {
          totalTransactions: transactions.length,
          successfulTransactions: transactions.filter(t => t.status === "Success").length,
          pendingTransactions: transactions.filter(t => t.status === "Pending").length,
          failedTransactions: transactions.filter(t => t.status === "Failed").length,
          totalDebit: transactions
            .filter(t => t.transactionType === "Debit" && t.status === "Success")
            .reduce((sum, t) => sum + t.amount, 0),
          totalCredit: transactions
            .filter(t => t.transactionType === "Credit" && t.status === "Success")
            .reduce((sum, t) => sum + t.amount, 0)
        }
      }
    });
  } catch (error) {
    console.error("Get merchant transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching merchant transactions",
      error: error.message
    });
  }
};

// Create new payout transaction (Updated)
export const createPayoutTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      amount,
      accountNumber,
      connector,
      paymentMode = "IMPS",
      type = "Manual",
      remark = "",
      feeApplied = false,
      feeAmount = 0,
      transactionType = "Debit" // 🆕 ADDED: Debit/Credit
    } = req.body;

    // Validate required fields
    if (!merchantId || !amount || !accountNumber || !connector) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Merchant, amount, account number, and connector are required"
      });
    }

    // Check if merchant exists
    const merchant = await User.findById(merchantId).session(session);
    if (!merchant || merchant.role !== "merchant") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    // Check merchant balance for Debit transactions
    if (transactionType === "Debit" && merchant.unsettleBalance < parseFloat(amount)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });
    }

    // Generate unique IDs
    const transactionId = generateTransactionId();
    const orderId = Date.now().toString();
    const utr = generateUTR();

    // Create payout transaction
    const payoutTransaction = new PayoutTransaction({
      transactionId,
      orderId,
      utr,
      status: "Pending",
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      accountNumber,
      connector,
      amount: parseFloat(amount),
      paymentMode,
      type,
      transactionType, // 🆕 ADDED
      remark,
      feeApplied: Boolean(feeApplied),
      feeAmount: parseFloat(feeAmount) || 0,
      merchantId,
      webhook: "0 / 0"
    });

    await payoutTransaction.save({ session });

    // Update merchant balance based on transaction type
    if (transactionType === "Debit") {
      merchant.unsettleBalance -= parseFloat(amount);
    } else if (transactionType === "Credit") {
      merchant.unsettleBalance += parseFloat(amount);
    }
    
    await merchant.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: `Payout transaction created successfully (${transactionType})`,
      data: payoutTransaction
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Create payout transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payout transaction",
      error: error.message
    });
  }
};

// Get merchants for dropdown (Updated)
export const getMerchantsForPayout = async (req, res) => {
  try {
    const merchants = await User.find(
      { role: "merchant", status: "Active" },
      "firstname lastname company email unsettleBalance createdAt"
    ).sort({ company: 1 });

    // 🆕 Get transaction summary for each merchant
    const merchantsWithDetails = await Promise.all(
      merchants.map(async (merchant) => {
        const transactions = await PayoutTransaction.find({ 
          merchantId: merchant._id,
          status: "Success"
        });
        
        const totalDebit = transactions
          .filter(t => t.transactionType === "Debit")
          .reduce((sum, t) => sum + t.amount, 0);
          
        const totalCredit = transactions
          .filter(t => t.transactionType === "Credit")
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          _id: merchant._id,
          name: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
          email: merchant.email,
          balance: merchant.unsettleBalance || 0,
          totalTransactions: transactions.length,
          totalDebit,
          totalCredit,
          availableBalance: merchant.unsettleBalance || 0
        };
      })
    );

    res.status(200).json({
      success: true,
      data: merchantsWithDetails
    });
  } catch (error) {
    console.error("Get merchants for payout error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching merchants",
      error: error.message
    });
  }
};

// 🆕 Create Credit Transaction (Add funds to merchant)
export const createCreditTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      amount,
      remark = "Manual credit"
    } = req.body;

    if (!merchantId || !amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Merchant and amount are required"
      });
    }

    const merchant = await User.findById(merchantId).session(session);
    if (!merchant) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    // Generate unique IDs for credit transaction
    const transactionId = generateTransactionId();
    const orderId = Date.now().toString();
    const utr = generateUTR();

    // Create credit transaction
    const creditTransaction = new PayoutTransaction({
      transactionId,
      orderId,
      utr,
      status: "Success", // Credit transactions are immediately successful
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      accountNumber: "SYSTEM_CREDIT",
      connector: "SYSTEM",
      amount: parseFloat(amount),
      paymentMode: "SYSTEM",
      type: "Manual",
      transactionType: "Credit",
      remark,
      feeApplied: false,
      feeAmount: 0,
      merchantId,
      webhook: "0 / 0"
    });

    await creditTransaction.save({ session });

    // Update merchant balance (Add funds)
    merchant.unsettleBalance += parseFloat(amount);
    await merchant.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Credit transaction completed successfully",
      data: creditTransaction
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Create credit transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating credit transaction",
      error: error.message
    });
  }
};

// Get all payout transactions with filters
export const getPayoutTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      merchantId,
      connector,
      status,
      utr,
      accountNumber,
      transactionId,
      orderId,
      startDate,
      endDate,
      type
    } = req.query;

    const filter = {};

    // Build filter object
    if (merchantId) filter.merchantId = merchantId;
    if (connector && connector !== "-- Select Connector --") filter.connector = new RegExp(connector, "i");
    if (status && status !== "-- Select Status --") filter.status = status;
    if (utr) filter.utr = new RegExp(utr, "i");
    if (accountNumber) filter.accountNumber = new RegExp(accountNumber, "i");
    if (transactionId) filter.transactionId = new RegExp(transactionId, "i");
    if (orderId) filter.orderId = new RegExp(orderId, "i");
    if (type && type !== "Select Transaction Type") filter.type = type;

    // Date filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const transactions = await PayoutTransaction.find(filter)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .populate('merchantId', 'firstname lastname company email');

    const total = await PayoutTransaction.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: options.page,
        totalPages: Math.ceil(total / options.limit),
        totalItems: total,
        itemsPerPage: options.limit
      }
    });
  } catch (error) {
    console.error("Get payout transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payout transactions",
      error: error.message
    });
  }
};

// Get payout transaction by ID
export const getPayoutTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await PayoutTransaction.findById(id).populate("merchantId");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Payout transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error("Get payout transaction by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payout transaction",
      error: error.message
    });
  }
};

// Create new payout transaction
// export const createPayoutTransaction = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       merchantId,
//       amount,
//       accountNumber,
//       connector,
//       paymentMode = "IMPS",
//       type = "Manual",
//       remark = "",
//       feeApplied = false,
//       feeAmount = 0
//     } = req.body;

//     // Validate required fields
//     if (!merchantId || !amount || !accountNumber || !connector) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "Merchant, amount, account number, and connector are required"
//       });
//     }

//     // Check if merchant exists
//     const merchant = await User.findById(merchantId).session(session);
//     if (!merchant || merchant.role !== "merchant") {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: "Merchant not found"
//       });
//     }

//     // Check merchant balance
//     if (merchant.unsettleBalance < parseFloat(amount)) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient balance"
//       });
//     }

//     // Generate unique IDs
//     const transactionId = generateTransactionId();
//     const orderId = Date.now().toString();
//     const utr = generateUTR();

//     // Create payout transaction
//     const payoutTransaction = new PayoutTransaction({
//       transactionId,
//       orderId,
//       utr,
//       status: "Pending",
//       merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
//       accountNumber,
//       connector,
//       amount: parseFloat(amount),
//       paymentMode,
//       type,
//       remark,
//       feeApplied: Boolean(feeApplied),
//       feeAmount: parseFloat(feeAmount) || 0,
//       merchantId,
//       webhook: "0 / 0"
//     });

//     await payoutTransaction.save({ session });

//     // Update merchant balance
//     merchant.unsettleBalance -= parseFloat(amount);
//     await merchant.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: "Payout transaction created successfully",
//       data: payoutTransaction
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Create payout transaction error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error creating payout transaction",
//       error: error.message
//     });
//   }
// };

// Update payout transaction status
export const updatePayoutTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Success", "Pending", "Failed", "Processing"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const transaction = await PayoutTransaction.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate("merchantId");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Payout transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payout transaction status updated successfully",
      data: transaction
    });
  } catch (error) {
    console.error("Update payout transaction status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payout transaction status",
      error: error.message
    });
  }
};

// Get merchants for dropdown
// export const getMerchantsForPayout = async (req, res) => {
//   try {
//     const merchants = await User.find(
//       { role: "merchant", status: "Active" },
//       "firstname lastname company email unsettleBalance"
//     ).sort({ company: 1 });

//     const formattedMerchants = merchants.map(merchant => ({
//       _id: merchant._id,
//       name: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
//       email: merchant.email,
//       balance: merchant.unsettleBalance || 0
//     }));

//     res.status(200).json({
//       success: true,
//       data: formattedMerchants
//     });
//   } catch (error) {
//     console.error("Get merchants for payout error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching merchants",
//       error: error.message
//     });
//   }
// };

// Get connectors for dropdown
export const getConnectorsForPayout = async (req, res) => {
  try {
    const connectors = await Connector.find(
      { status: "Active", isPayoutSupport: true },
      "name className"
    ).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: connectors
    });
  } catch (error) {
    console.error("Get connectors for payout error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching connectors",
      error: error.message
    });
  }
};

// Get connector accounts for dropdown
export const getConnectorAccountsForPayout = async (req, res) => {
  try {
    const { connectorId } = req.params;
    
    const connectorAccounts = await ConnectorAccount.find(
      { connectorId, status: "Active" },
      "name currency"
    ).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: connectorAccounts
    });
  } catch (error) {
    console.error("Get connector accounts for payout error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching connector accounts",
      error: error.message
    });
  }
};

// Export to Excel
export const exportToExcel = async (req, res) => {
  try {
    const {
      merchantId,
      connector,
      status,
      utr,
      accountNumber,
      startDate,
      endDate
    } = req.query;

    const filter = {};

    if (merchantId) filter.merchantId = merchantId;
    if (connector) filter.connector = new RegExp(connector, "i");
    if (status) filter.status = status;
    if (utr) filter.utr = new RegExp(utr, "i");
    if (accountNumber) filter.accountNumber = new RegExp(accountNumber, "i");

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const transactions = await PayoutTransaction.find(filter)
      .sort({ createdAt: -1 })
      .populate('merchantId', 'company firstname lastname');

    // Convert to CSV format
    const csvData = transactions.map(transaction => ({
      'Transaction ID': transaction.transactionId,
      'Order ID': transaction.orderId,
      'UTR': transaction.utr,
      'Status': transaction.status,
      'Merchant Name': transaction.merchantName,
      'Account Number': transaction.accountNumber,
      'Connector': transaction.connector,
      'Amount': transaction.amount,
      'Payment Mode': transaction.paymentMode,
      'Type': transaction.type,
      'Webhook': transaction.webhook,
      'Created At': transaction.createdAt.toISOString(),
      'Remark': transaction.remark
    }));

    res.status(200).json({
      success: true,
      data: csvData,
      filename: `payouts_${new Date().toISOString().split('T')[0]}.csv`
    });
  } catch (error) {
    console.error("Export to Excel error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting data",
      error: error.message
    });
  }
};

// Get payout statistics
export const getPayoutStatistics = async (req, res) => {
  try {
    const totalPayouts = await PayoutTransaction.countDocuments();
    const successPayouts = await PayoutTransaction.countDocuments({ status: "Success" });
    const pendingPayouts = await PayoutTransaction.countDocuments({ status: "Pending" });
    const failedPayouts = await PayoutTransaction.countDocuments({ status: "Failed" });
    
    const totalAmount = await PayoutTransaction.aggregate([
      { $match: { status: "Success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPayouts,
        successPayouts,
        pendingPayouts,
        failedPayouts,
        totalAmount: totalAmount[0]?.total || 0
      }
    });
  } catch (error) {
    console.error("Get payout statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payout statistics",
      error: error.message
    });
  }
};
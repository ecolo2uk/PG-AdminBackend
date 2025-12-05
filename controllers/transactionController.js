import Merchant from "../models/Merchant.js";
import Transaction from "../models/Transaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import mongoose from "mongoose";
import User from "../models/User.js";

// --- Simple version without pagination for testing ---
export const getAllTransactionsSimple = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const transactions = await Transaction.find({})
      .populate("merchantId", "company firstname lastname email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Format transactions for frontend
    const formattedTransactions = transactions.map((transaction) => ({
      _id: transaction._id,
      transactionRefId: transaction.transactionId || transaction._id,
      merchantOrderId: transaction.merchantOrderId || "N/A",
      txnRefId: transaction.txnRefId || "N/A",
      utr: transaction.utr || "N/A",
      merchantName:
        transaction.merchantName ||
        (transaction.merchantId
          ? transaction.merchantId.company ||
            `${transaction.merchantId.firstname} ${transaction.merchantId.lastname}`
          : "N/A"),
      customerEmail: transaction.customerEmail || "N/A",
      connectorName: "Enpay", // Default value
      provider: "SKYPAL", // Default value
      transactionStatus: transaction.status || "PENDING",
      amount: transaction.amount
        ? parseFloat(transaction.amount).toFixed(2)
        : "0.00",
      webhookStatus: "NA / NA", // Default value
      transactionDate: transaction.createdAt,
      paymentMethod: transaction.paymentMethod,
      customerName: transaction.customerName,
      customerVpa: transaction.customerVPA,
      settlementStatus: "Pending", // Default value
    }));

    res.status(200).json(formattedTransactions);
  } catch (error) {
    console.error("Error fetching simple transactions:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// --- Get All Payment Transactions with Advanced Filters & Pagination ---
export const getAllPaymentTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "createdAt:-1",
      merchantId,
      status,
      transactionId,
      merchantOrderId,
      startDate,
      endDate,
      paymentMethod,
      customerContact,
      customerName,
    } = req.query;

    let matchQuery = {};
    if (merchantId) {
      if (!mongoose.Types.ObjectId.isValid(merchantId)) {
        return res.status(400).json({ message: "Invalid Merchant ID format." });
      }
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }
    if (status) matchQuery.status = status;
    if (transactionId) matchQuery.transactionId = transactionId;
    if (merchantOrderId) matchQuery.merchantOrderId = merchantOrderId;
    if (paymentMethod) matchQuery.paymentMethod = paymentMethod;
    if (customerContact) matchQuery.customerContact = customerContact;
    if (customerName)
      matchQuery.customerName = { $regex: customerName, $options: "i" };

    // Date range filter
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Parse sort parameter
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split(":");
      sortOptions[field] = order === "-1" ? -1 : 1;
    }

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "merchantId",
          foreignField: "_id",
          as: "merchantDetails",
        },
      },
      {
        $unwind: {
          path: "$merchantDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          transactionId: 1,
          merchantOrderId: 1,
          merchantId: 1,
          merchantName: {
            $ifNull: [
              "$merchantDetails.company",
              {
                $concat: [
                  "$merchantDetails.firstname",
                  " ",
                  "$merchantDetails.lastname",
                ],
              },
            ],
          },
          amount: 1,
          currency: 1,
          status: 1,
          paymentMethod: 1,
          paymentOption: 1,
          customerName: 1,
          customerVPA: 1,
          customerContact: 1,
          txnRefId: 1,
          enpayTxnId: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: sortOptions },
      { $skip: (parsedPage - 1) * parsedLimit },
      { $limit: parsedLimit },
    ];

    const transactions = await Transaction.aggregate(aggregationPipeline);
    const totalDocs = await Transaction.countDocuments(matchQuery);

    res.status(200).json({
      docs: transactions,
      totalDocs: totalDocs,
      limit: parsedLimit,
      page: parsedPage,
      totalPages: Math.ceil(totalDocs / parsedLimit),
      hasNextPage: parsedPage * parsedLimit < totalDocs,
      hasPrevPage: parsedPage > 1,
    });
  } catch (error) {
    console.error("Error fetching all payment transactions:", error);
    res.status(500).json({
      message: "Server Error fetching payments",
      error: error.message,
    });
  }
};

// --- Get a single Payment Transaction by ID or transactionId ---
export const getPaymentTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    let transaction;
    // First try to find by MongoDB _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      transaction = await Transaction.findById(id).populate(
        "merchantId",
        "company firstname lastname mid email"
      );
    }

    // If not found by _id, try by custom transactionId
    if (!transaction) {
      transaction = await Transaction.findOne({ transactionId: id }).populate(
        "merchantId",
        "company firstname lastname mid email"
      );
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Payment Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Error fetching payment transaction by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server Error fetching payment transaction",
      error: error.message,
    });
  }
};

// --- Update transaction status ---
export const updateTransactionStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, enpayTxnId, txnRefId, remark } = req.body;

    let transaction;
    if (mongoose.Types.ObjectId.isValid(id)) {
      transaction = await Transaction.findById(id).session(session);
    }
    if (!transaction) {
      transaction = await Transaction.findOne({ transactionId: id }).session(
        session
      );
    }

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const oldStatus = transaction.status;
    transaction.status = status;
    if (enpayTxnId) transaction.enpayTxnId = enpayTxnId;
    if (txnRefId) transaction.txnRefId = txnRefId;
    if (remark) transaction.remark = remark;

    await transaction.save({ session });
    const { autoSyncTransaction } = await import(
      "./transactionSyncController.js"
    );
    autoSyncTransaction(transaction.merchantId, transaction, "payment");

    // Handle balance updates
    const merchant = await User.findById(transaction.merchantId).session(
      session
    );
    if (merchant) {
      if (
        ["Success", "SUCCESS"].includes(status) &&
        !["Success", "SUCCESS"].includes(oldStatus)
      ) {
        merchant.balance += transaction.amount;
      }
      if (
        ["Refund", "REFUND"].includes(status) &&
        !["Refund", "REFUND"].includes(oldStatus)
      ) {
        merchant.balance -= transaction.amount;
      }
      await merchant.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Transaction status updated successfully.",
      data: transaction,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating transaction status:", error);
    res.status(500).json({
      success: false,
      message: "Server error during transaction status update.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// --- Get merchant payout balance ---
export const getMerchantPayoutBalance = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Merchant ID format.",
      });
    }

    const merchant = await User.findById(merchantId).select(
      "balance unsettleBalance"
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
        totalPayoutBalance: merchant.balance,
        unsettledBalance: merchant.unsettleBalance,
      },
    });
  } catch (error) {
    console.error("Error fetching merchant payout balance:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching merchant payout balance.",
      error: error.message,
    });
  }
};

export const syncAllMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Find all transactions for this merchant
    const paymentTransactions = await Transaction.find({
      merchantId: merchant.userId,
    }).sort({ createdAt: -1 });

    const payoutTransactions = await PayoutTransaction.find({
      merchantId: merchant.userId,
    }).sort({ createdAt: -1 });

    // Update merchant with transaction references
    merchant.paymentTransactions = paymentTransactions.map((txn) => txn._id);
    merchant.payoutTransactions = payoutTransactions.map((txn) => txn._id);

    await merchant.save();

    res.status(200).json({
      success: true,
      message: "All transactions synced successfully",
      data: {
        paymentCount: paymentTransactions.length,
        payoutCount: payoutTransactions.length,
        total: paymentTransactions.length + payoutTransactions.length,
      },
    });
  } catch (error) {
    console.error("Error syncing transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error syncing transactions",
      error: error.message,
    });
  }
};

// Helper function to generate unique transaction ID
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

// Auto-sync function
export const autoSyncToMerchant = async (merchantUserId, transaction, type) => {
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

    // Add to recent transactions
    const newTransaction = {
      transactionId: transaction.transactionId,
      type: type,
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
    if (merchant.recentTransactions.length > 20) {
      merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
    }

    // Update balance if successful
    if (transaction.status === "SUCCESS" || transaction.status === "Success") {
      merchant.availableBalance += transaction.amount;
      merchant.totalCredits += transaction.amount;
      merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
    }

    merchant.totalTransactions = merchant.paymentTransactions.length;
    merchant.successfulTransactions = merchant.paymentTransactions.filter(
      (txn) => txn.status === "SUCCESS" || txn.status === "Success"
    ).length;

    await merchant.save();
    console.log(
      `✅ Auto-synced ${type} transaction for merchant: ${merchant.merchantName}`
    );
  } catch (error) {
    console.error("❌ Error in auto-sync:", error);
  }
};

// Create Payment Transaction (WITH ENPAY INTEGRATION)
export const createPaymentTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      merchantOrderId,
      amount,
      currency = "INR",
      customerName,
      customerVPA,
      customerContact,
      paymentMethod = "UPI",
      paymentOption = "UPI_COLLECT",
      txnNote = "Payment for services",
      merchantVpa,
      returnURL,
      successURL,
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
    const merchantTrnId = `TRN${Date.now()}`;

    // Create transaction with PENDING status initially
    const newTransaction = new Transaction({
      transactionId,
      merchantId: merchantUser._id,
      merchantName:
        merchantUser.company ||
        `${merchantUser.firstname} ${merchantUser.lastname}`,
      merchantOrderId,
      amount: parseFloat(amount),
      currency,
      status: "PENDING",
      customerName,
      customerVPA,
      customerContact,
      paymentMethod,
      paymentOption,
      txnRefId: merchantTrnId,
      txnNote,
      merchantVpa,
      source: "enpay",
    });

    await newTransaction.save({ session });

    // Call Enpay API to initiate collect request
    try {
      const enpayResponse = await initiateCollectRequest({
        amount: amount.toString(),
        merchantHashId: "MERCDSH51Y7CD4YJLFIZR8NF", // Use your actual hash ID
        merchantOrderId,
        merchantTrnId,
        merchantVpa: merchantVpa || "enpay1.skypal@fino",
        returnURL: returnURL || "https://yourdomain.com/return",
        successURL: successURL || "https://yourdomain.com/success",
        txnNote: txnNote || "Collect for Order",
      });

      // Update transaction with Enpay response
      if (enpayResponse) {
        if (enpayResponse.code === 200 || enpayResponse.success) {
          newTransaction.status = "INITIATED";
          newTransaction.enpayTxnId = enpayResponse.data?.transactionId;
          newTransaction.paymentUrl = enpayResponse.data?.paymentUrl;
          newTransaction.qrCode = enpayResponse.data?.qrCode;
        } else {
          newTransaction.status = "FAILED";
          newTransaction.remark =
            enpayResponse.message || "Enpay API call failed";
        }
        await newTransaction.save({ session });
      }
    } catch (enpayError) {
      console.error("Enpay API error:", enpayError);
      newTransaction.status = "FAILED";
      newTransaction.remark = enpayError.message;
      await newTransaction.save({ session });
    }

    // AUTO-SYNC TO MERCHANT TABLE
    await autoSyncToMerchant(merchantUser._id, newTransaction, "payment");

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Payment transaction created and synced to merchant.",
      data: newTransaction,
      enpayResponse: enpayResponse || null,
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

// Keep all your other existing functions (getAllTransactionsSimple, getAllPaymentTransactions, etc.)
// ... [rest of your existing functions]

import PayoutTransaction from "../models/PayoutTransaction.js";
import User from "../models/User.js";
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
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: "merchantId",
        select: "firstname lastname company email"
      }
    };

    const transactions = await PayoutTransaction.find(filter)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .populate(options.populate);

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
      feeAmount = 0
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

    // Check merchant balance (if you have balance system)
    if (merchant.unsettleBalance !== undefined && merchant.unsettleBalance < amount) {
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
      status: "Pending", // Initial status
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      accountNumber,
      connector,
      amount: parseFloat(amount),
      paymentMode,
      type,
      remark,
      feeApplied,
      feeAmount: parseFloat(feeAmount),
      merchantId,
      webhook: "0 / 0"
    });

    await payoutTransaction.save({ session });

    // Update merchant balance if applicable
    if (merchant.unsettleBalance !== undefined) {
      merchant.unsettleBalance -= parseFloat(amount);
      await merchant.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Simulate payment processing (you can integrate with actual payment gateway)
    setTimeout(async () => {
      try {
        // Update transaction status based on some logic
        const randomStatus = Math.random() > 0.2 ? "Success" : "Failed";
        await PayoutTransaction.findByIdAndUpdate(
          payoutTransaction._id,
          { 
            status: randomStatus,
            webhook: randomStatus === "Success" ? "1 / 1" : "0 / 1"
          }
        );
      } catch (error) {
        console.error("Error updating transaction status:", error);
      }
    }, 5000);

    res.status(201).json({
      success: true,
      message: "Payout transaction created successfully",
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
export const getMerchantsForPayout = async (req, res) => {
  try {
    const merchants = await User.find(
      { role: "merchant", status: "Active" },
      "firstname lastname company email unsettleBalance"
    ).sort({ company: 1 });

    const formattedMerchants = merchants.map(merchant => ({
      _id: merchant._id,
      name: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      email: merchant.email,
      balance: merchant.unsettleBalance || 0
    }));

    res.status(200).json({
      success: true,
      data: formattedMerchants
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


import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// --- Simple version without pagination for testing ---
export const getAllTransactionsSimple = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const transactions = await Transaction.find({})
      .populate('merchantId', 'company firstname lastname email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    // Format transactions for frontend
    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      transactionRefId: transaction.transactionId || transaction._id,
      merchantOrderId: transaction.merchantOrderId || "N/A",
      utr: transaction.txnRefId || "N/A",
      merchantName: transaction.merchantName || 
                   (transaction.merchantId ? 
                    (transaction.merchantId.company || `${transaction.merchantId.firstname} ${transaction.merchantId.lastname}`) 
                    : "N/A"),
      customerEmail: transaction.customerEmail || "N/A",
      connectorName: "Enpay", // Default value
      provider: "SKYPAL", // Default value
      transactionStatus: transaction.status || "PENDING",
      amount: transaction.amount ? parseFloat(transaction.amount).toFixed(2) : "0.00",
      webhookStatus: "NA / NA", // Default value
      transactionDate: transaction.createdAt,
      paymentMethod: transaction.paymentMethod,
      customerName: transaction.customerName,
      customerVpa: transaction.customerVPA,
      settlementStatus: "Pending" // Default value
    }));

    res.status(200).json(formattedTransactions);
    
  } catch (error) {
    console.error('Error fetching simple transactions:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};

// --- Get All Payment Transactions with Advanced Filters & Pagination ---
export const getAllPaymentTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt:-1',
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
        return res.status(400).json({ message: 'Invalid Merchant ID format.' });
      }
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }
    if (status) matchQuery.status = status;
    if (transactionId) matchQuery.transactionId = transactionId;
    if (merchantOrderId) matchQuery.merchantOrderId = merchantOrderId;
    if (paymentMethod) matchQuery.paymentMethod = paymentMethod;
    if (customerContact) matchQuery.customerContact = customerContact;
    if (customerName) matchQuery.customerName = { $regex: customerName, $options: 'i' };

    // Date range filter
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Parse sort parameter
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortOptions[field] = order === '-1' ? -1 : 1;
    }

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchantDetails'
        }
      },
      {
        $unwind: {
          path: '$merchantDetails',
          preserveNullAndEmptyArrays: true
        }
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
              { $concat: ["$merchantDetails.firstname", " ", "$merchantDetails.lastname"] }
            ] 
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
        }
      },
      { $sort: sortOptions },
      { $skip: (parsedPage - 1) * parsedLimit },
      { $limit: parsedLimit }
    ];

    const transactions = await Transaction.aggregate(aggregationPipeline);
    const totalDocs = await Transaction.countDocuments(matchQuery);

    res.status(200).json({
      docs: transactions,
      totalDocs: totalDocs,
      limit: parsedLimit,
      page: parsedPage,
      totalPages: Math.ceil(totalDocs / parsedLimit),
      hasNextPage: (parsedPage * parsedLimit) < totalDocs,
      hasPrevPage: parsedPage > 1
    });

  } catch (error) {
    console.error('Error fetching all payment transactions:', error);
    res.status(500).json({ 
      message: 'Server Error fetching payments', 
      error: error.message 
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
      transaction = await Transaction.findById(id)
        .populate('merchantId', 'company firstname lastname mid email');
    }

    // If not found by _id, try by custom transactionId
    if (!transaction) {
      transaction = await Transaction.findOne({ transactionId: id })
        .populate('merchantId', 'company firstname lastname mid email');
    }

    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        message: 'Payment Transaction not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
    
  } catch (error) {
    console.error('Error fetching payment transaction by ID:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error fetching payment transaction', 
      error: error.message 
    });
  }
};

// --- Create a new payment transaction ---
// export const createPaymentTransaction = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       merchantId,
//       merchantOrderId,
//       amount,
//       currency = 'INR',
//       status = 'Pending',
//       customerName,
//       customerVPA,
//       customerContact,
//       paymentMethod,
//       paymentOption,
//       txnRefId,
//       enpayTxnId,
//       remark,
//     } = req.body;

//     // Validate Merchant
//     if (!mongoose.Types.ObjectId.isValid(merchantId)) {
//       await session.abortTransaction();
//       return res.status(400).json({ 
//         success: false,
//         message: "Invalid Merchant ID format." 
//       });
//     }

//     const merchant = await User.findById(merchantId).session(session);
//     if (!merchant || merchant.role !== 'merchant') {
//       await session.abortTransaction();
//       return res.status(404).json({ 
//         success: false,
//         message: "Merchant not found or not a merchant." 
//       });
//     }

//     // Generate unique transaction ID
//     const generateUniqueTransactionId = async () => {
//       let transactionId;
//       let isUnique = false;
//       while (!isUnique) {
//         transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
//         const existingTxn = await Transaction.findOne({ transactionId });
//         if (!existingTxn) {
//           isUnique = true;
//         }
//       }
//       return transactionId;
//     };

//     const transactionId = await generateUniqueTransactionId();

//     const newTransaction = new Transaction({
//       transactionId,
//       merchantId: merchant._id,
//       merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
//       merchantOrderId,
//       amount: parseFloat(amount),
//       currency,
//       status,
//       customerName,
//       customerVPA,
//       customerContact,
//       paymentMethod,
//       paymentOption,
//       txnRefId,
//       enpayTxnId,
//       remark,
//     });

//     await newTransaction.save({ session });
//   const { autoSyncTransaction } = await import('./transactionSyncController.js');
//   autoSyncTransaction(merchant._id, newTransaction, 'payment');

//     // Update merchant balance if status is Success
//     if (['Success', 'SUCCESS'].includes(status)) {
//       merchant.balance += parseFloat(amount);
//       await merchant.save({ session });
//     }

//     await session.commitTransaction();
    
//     res.status(201).json({
//       success: true,
//       message: "Payment transaction created successfully.",
//       data: newTransaction,
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     console.error("Error creating payment transaction:", error);
//     res.status(500).json({ 
//       success: false,
//       message: "Server error during payment transaction creation.", 
//       error: error.message 
//     });
//   } finally {
//     session.endSession();
//   }
// };

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
      transaction = await Transaction.findOne({ transactionId: id }).session(session);
    }

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Transaction not found." 
      });
    }

    const oldStatus = transaction.status;
    transaction.status = status;
    if (enpayTxnId) transaction.enpayTxnId = enpayTxnId;
    if (txnRefId) transaction.txnRefId = txnRefId;
    if (remark) transaction.remark = remark;

    await transaction.save({ session });
  const { autoSyncTransaction } = await import('./transactionSyncController.js');
  autoSyncTransaction(transaction.merchantId, transaction, 'payment');

    // Handle balance updates
    const merchant = await User.findById(transaction.merchantId).session(session);
    if (merchant) {
      if (['Success', 'SUCCESS'].includes(status) && !['Success', 'SUCCESS'].includes(oldStatus)) {
        merchant.balance += transaction.amount;
      }
      if (['Refund', 'REFUND'].includes(status) && !['Refund', 'REFUND'].includes(oldStatus)) {
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
      error: error.message 
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
        message: "Invalid Merchant ID format." 
      });
    }

    const merchant = await User.findById(merchantId).select('balance unsettleBalance');

    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found." 
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        totalPayoutBalance: merchant.balance,
        unsettledBalance: merchant.unsettleBalance,
      }
    });
    
  } catch (error) {
    console.error("Error fetching merchant payout balance:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching merchant payout balance.", 
      error: error.message 
    });
  }
};


// Sync all transactions for a merchant
export const syncMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Merchant ID"
      });
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    // Get latest transactions
    const paymentTransactions = await Transaction.find({ 
      merchantId: merchant.userId 
    })
    .select('transactionId merchantOrderId amount status paymentMethod createdAt txnRefId customerName')
    .sort({ createdAt: -1 })
    .limit(50);

    const payoutTransactions = await PayoutTransaction.find({ 
      merchantId: merchant.userId 
    })
    .select('utr transactionId amount transactionType status paymentMode remark createdAt')
    .sort({ createdAt: -1 })
    .limit(50);

    // Format transactions for merchant table
    const formattedTransactions = [
      ...paymentTransactions.map(txn => ({
        transactionId: txn.transactionId,
        type: 'payment',
        transactionType: 'Credit',
        amount: txn.amount,
        status: txn.status,
        reference: txn.merchantOrderId,
        method: txn.paymentMethod,
        remark: 'Payment Received',
        date: txn.createdAt,
        customer: txn.customerName || 'N/A'
      })),
      ...payoutTransactions.map(txn => ({
        transactionId: txn.transactionId || txn.utr,
        type: 'payout',
        transactionType: txn.transactionType,
        amount: txn.amount,
        status: txn.status,
        reference: txn.utr,
        method: txn.paymentMode,
        remark: txn.remark || 'Payout Processed',
        date: txn.createdAt,
        customer: 'N/A'
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update merchant with transactions
    merchant.recentTransactions = formattedTransactions.slice(0, 20); // Last 20 transactions
    
    // Calculate transaction summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // Today's summary
    const todayTransactions = formattedTransactions.filter(txn => 
      new Date(txn.date) >= today
    );
    merchant.transactionSummary.today = {
      credits: todayTransactions.filter(t => t.transactionType === 'Credit').reduce((sum, t) => sum + t.amount, 0),
      debits: todayTransactions.filter(t => t.transactionType === 'Debit').reduce((sum, t) => sum + t.amount, 0),
      count: todayTransactions.length
    };

    // Last 7 days summary
    const last7DaysTransactions = formattedTransactions.filter(txn => 
      new Date(txn.date) >= last7Days
    );
    merchant.transactionSummary.last7Days = {
      credits: last7DaysTransactions.filter(t => t.transactionType === 'Credit').reduce((sum, t) => sum + t.amount, 0),
      debits: last7DaysTransactions.filter(t => t.transactionType === 'Debit').reduce((sum, t) => sum + t.amount, 0),
      count: last7DaysTransactions.length
    };

    // Last 30 days summary
    const last30DaysTransactions = formattedTransactions.filter(txn => 
      new Date(txn.date) >= last30Days
    );
    merchant.transactionSummary.last30Days = {
      credits: last30DaysTransactions.filter(t => t.transactionType === 'Credit').reduce((sum, t) => sum + t.amount, 0),
      debits: last30DaysTransactions.filter(t => t.transactionType === 'Debit').reduce((sum, t) => sum + t.amount, 0),
      count: last30DaysTransactions.length
    };

    await merchant.save();

    res.status(200).json({
      success: true,
      message: "Transactions synced successfully",
      data: {
        transactions: merchant.recentTransactions,
        summary: merchant.transactionSummary
      }
    });

  } catch (error) {
    console.error("Error syncing transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error syncing transactions",
      error: error.message
    });
  }
};



// Auto-sync transaction to merchant
const autoSyncToMerchant = async (merchantUserId, transactionData, type) => {
  try {
    console.log(`🔄 Auto-syncing ${type} transaction to merchant table`);
    
    // Find merchant by userId
    const merchant = await Merchant.findOne({ userId: merchantUserId });
    if (!merchant) {
      console.log('❌ Merchant not found for auto-sync');
      return;
    }

    const newTransaction = {
      transactionId: transactionData.transactionId,
      type: type,
      transactionType: type === 'payment' ? 'Credit' : 'Debit',
      amount: transactionData.amount,
      status: transactionData.status,
      reference: type === 'payment' ? transactionData.merchantOrderId : transactionData.utr,
      method: type === 'payment' ? transactionData.paymentMethod : transactionData.paymentMode,
      remark: transactionData.remark || (type === 'payment' ? 'Payment Received' : 'Payout Processed'),
      date: transactionData.createdAt || new Date(),
      customer: transactionData.customerName || 'N/A'
    };

    // Add to recent transactions
    merchant.recentTransactions.unshift(newTransaction);
    if (merchant.recentTransactions.length > 20) {
      merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
    }

    // Update balance if transaction is successful
    if (transactionData.status === 'Success' || transactionData.status === 'SUCCESS') {
      if (type === 'payment') {
        // Credit for payments
        merchant.availableBalance += transactionData.amount;
        merchant.totalCredits += transactionData.amount;
      } else if (type === 'payout') {
        // Debit for payouts
        merchant.availableBalance -= transactionData.amount;
        merchant.totalDebits += transactionData.amount;
      }
      
      merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
    }

    // Update transaction summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(newTransaction.date) >= today) {
      if (newTransaction.transactionType === 'Credit') {
        merchant.transactionSummary.today.credits += newTransaction.amount;
      } else {
        merchant.transactionSummary.today.debits += newTransaction.amount;
      }
      merchant.transactionSummary.today.count += 1;
    }

    await merchant.save();
    console.log(`✅ Auto-synced ${type} transaction for merchant: ${merchant.merchantName}`);

  } catch (error) {
    console.error('❌ Error in auto-sync to merchant:', error);
  }
};

// Create Payment Transaction (WITH AUTO-SYNC)
export const createPaymentTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      merchantOrderId,
      amount,
      currency = 'INR',
      status = 'Pending',
      customerName,
      customerVPA,
      customerContact,
      paymentMethod,
      paymentOption,
      txnRefId,
      enpayTxnId,
      remark,
    } = req.body;

    // Validate Merchant
    const merchantUser = await User.findById(merchantId).session(session);
    if (!merchantUser || merchantUser.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found." 
      });
    }

    // Generate transaction ID
    const transactionId = await generateUniqueTransactionId();

    const newTransaction = new Transaction({
      transactionId,
      merchantId: merchantUser._id,
      merchantName: merchantUser.company || `${merchantUser.firstname} ${merchantUser.lastname}`,
      merchantOrderId,
      amount: parseFloat(amount),
      currency,
      status,
      customerName,
      customerVPA,
      customerContact,
      paymentMethod,
      paymentOption,
      txnRefId,
      enpayTxnId,
      remark,
    });

    await newTransaction.save({ session });

    // AUTO-SYNC TO MERCHANT TABLE
    await autoSyncToMerchant(merchantUser._id, newTransaction, 'payment');

    // Update user balance if success
    if (['Success', 'SUCCESS'].includes(status)) {
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
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};
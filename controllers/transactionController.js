// import Transaction from '../models/Transaction.js';
// import Merchant from '../models/Merchant.js';
// import mongoose from 'mongoose'; // Import mongoose to use mongoose.Types.ObjectId

// export const getAllTransactions = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, sort = 'transactionDate:-1', merchantId } = req.query;

//     let matchQuery = {};
//     if (merchantId) {
//       // If merchantId is provided as a query parameter, convert it to ObjectId for matching
//       // assuming merchantId in Transaction documents is actually the Merchant's _id (as a string)
//       if (!mongoose.Types.ObjectId.isValid(merchantId)) {
//         return res.status(400).json({ message: 'Invalid Merchant ID format.' });
//       }
//       matchQuery.merchantId = merchantId; // Match as string in transactions initially
//     }

//     // Parse sort parameter
//     const sortOptions = {};
//     if (sort) {
//       const [field, order] = sort.split(':');
//       sortOptions[field] = order === '-1' ? -1 : 1;
//     }

//     const aggregationPipeline = [
//       { $match: matchQuery }, // Filter transactions if merchantId is provided
//       {
//         $addFields: {
//           // Convert transaction.merchantId string to ObjectId for $lookup
//           merchantObjectId: {
//             $cond: {
//               if: { $ne: ["$merchantId", null] }, // Only convert if merchantId exists
//               then: { $toObjectId: "$merchantId" },
//               else: null
//             }
//           }
//         }
//       },
//       {
//         $lookup: {
//           from: 'merchants', // The name of the Merchant collection (usually lowercase and plural of model name)
//           localField: 'merchantObjectId', // Use the converted ObjectId field for lookup
//           foreignField: '_id', // Field from the merchants collection (which is ObjectId)
//           as: 'merchantDetails'
//         }
//       },
//       {
//         $unwind: {
//           path: '$merchantDetails',
//           preserveNullAndEmptyArrays: true // Keep transactions even if no merchant match
//         }
//       },
//       {
//         $addFields: {
//           merchantName: { $ifNull: ["$merchantDetails.name", "$merchantName"] } // Use joined name, or existing if not joined
//         }
//       },
//       {
//         $project: {
//           merchantDetails: 0, // Remove the joined merchantDetails object from the final output
//           merchantObjectId: 0, // Remove the temporary ObjectId field
//           // Explicitly include all other fields you need for the table
//           _id: 1,
//           transactionRefId: 1,
//           merchantOrderId: 1,
//           amount: 1,
//           transactionStatus: 1,
//           transactionDate: 1,
//           transactionsStatus: 1, // Keep this as a fallback if transactionStatus is sometimes empty
//           merchantName: 1, // Include the new merchantName
//           merchantId: 1 // Keep original merchantId for potential filtering/reference
//           // ... include other fields from your Transaction schema that the table might need
//         }
//       },
//       { $sort: sortOptions }, // Apply sorting after lookup
//       { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
//       { $limit: parseInt(limit, 10) }
//     ];

//     const transactions = await Transaction.aggregate(aggregationPipeline);
//     const totalDocs = await Transaction.countDocuments(matchQuery); // Count based on the initial match query

//     res.status(200).json({
//       docs: transactions,
//       totalDocs: totalDocs,
//       limit: parseInt(limit, 10),
//       page: parseInt(page, 10),
//       totalPages: Math.ceil(totalDocs / parseInt(limit, 10)),
//       hasNextPage: (parseInt(page, 10) * parseInt(limit, 10)) < totalDocs,
//       hasPrevPage: parseInt(page, 10) > 1
//     });

//   } catch (error) {
//     console.error('Error fetching transactions:', error);
//     res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// };

// // @desc    Get single transaction by ID or transactionRefId
// // @route   GET /api/transactions/:id
// // @access  Public
// export const getTransactionById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     console.log('Fetching transaction by ID:', id);

//     let transaction;

//     // First try to find by transactionRefId
//     transaction = await Transaction.findOne({ transactionRefId: id });
    
//     if (!transaction) {
//       // If not found by transactionRefId, try by MongoDB _id
//       transaction = await Transaction.findById(id);
//     }

//     if (!transaction) {
//       return res.status(404).json({
//         message: 'Transaction not found'
//       });
//     }

//     res.status(200).json(transaction);
//   } catch (error) {
//     console.error('Error fetching transaction by ID:', error);
//     res.status(500).json({
//       message: 'Server Error',
//       error: error.message
//     });
//   }
// };

// // Simple version without pagination for testing
// export const getAllTransactionsSimple = async (req, res) => {
//   try {
//     const transactions = await Transaction.find({})
//       .sort({ transactionDate: -1 })
//       .limit(100);
    
//     res.status(200).json(transactions);
//   } catch (error) {
//     console.error('Error fetching transactions:', error);
//     res.status(500).json({
//       message: 'Server Error',
//       error: error.message
//     });
//   }
// };

// // @desc    Create a new transaction
// // @route   POST /api/transactions
// // @access  Private
// export const createTransaction = async (req, res) => {
//   try {
//     const newTransaction = new Transaction(req.body);
//     await newTransaction.save();
//     res.status(201).json(newTransaction);
//   } catch (error) {
//     console.error('Error creating transaction:', error);
//     res.status(400).json({
//       message: 'Failed to create transaction',
//       error: error.message
//     });
//   }
// };

// // @desc    Update a transaction
// // @route   PUT /api/transactions/:id
// // @access  Private
// export const updateTransaction = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updatedTransaction = await Transaction.findByIdAndUpdate(id, req.body, {
//       new: true,
//       runValidators: true
//     });
//     if (!updatedTransaction) {
//       return res.status(404).json({
//         message: 'Transaction not found'
//       });
//     }
//     res.status(200).json(updatedTransaction);
//   } catch (error) {
//     console.error('Error updating transaction:', error);
//     res.status(400).json({
//       message: 'Failed to update transaction',
//       error: error.message
//     });
//   }
// };

// // @desc    Delete a transaction
// // @route   DELETE /api/transactions/:id
// // @access  Private
// export const deleteTransaction = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const deletedTransaction = await Transaction.findByIdAndDelete(id);
//     if (!deletedTransaction) {
//       return res.status(404).json({
//         message: 'Transaction not found'
//       });
//     }
//     res.status(200).json({
//       message: 'Transaction deleted successfully'
//     });
//   } catch (error) {
//     console.error('Error deleting transaction:', error);
//     res.status(500).json({
//       message: 'Server Error',
//       error: error.message
//     });
//   }
// };


// backend/controllers/transactionController.js
import Transaction from '../models/Transaction.js';
import User from '../models/User.js'; // Correctly import the User model, which contains merchants
import PayoutTransaction from '../models/PayoutTransaction.js'; // Import PayoutTransaction for combined views if needed
import mongoose from 'mongoose';

// Helper to generate a unique transaction ID (if not provided externally)
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

// --- Create a new payment transaction ---
// This is typically called by a webhook from a payment gateway or your internal payment processing logic.
export const createPaymentTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,      // The ID of the merchant for whom this transaction is (should be ObjectId)
      merchantOrderId, // Order ID from the merchant's system
      amount,
      currency = 'INR',
      status = 'Pending', // Initial status (e.g., 'INITIATED', 'PENDING')
      customerName,
      customerVPA,
      customerContact,
      paymentMethod,
      paymentOption,
      upiId,
      txnRefId,       // Our internal reference, could be UTR for UPI
      connectorTxnId, // Transaction ID from the external payment gateway/connector
      remark,
      // ... other fields from your Transaction model
    } = req.body;

    // 1. Validate Merchant
    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Invalid Merchant ID format." });
    }
    const merchant = await User.findById(merchantId).session(session);
    if (!merchant || merchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ message: "Merchant not found or not a merchant." });
    }

    const transactionId = await generateUniqueTransactionId(); // Our system's unique transaction ID

    const newTransaction = new Transaction({
      transactionId,    // Our unique ID for this transaction
      merchantId: merchant._id, // Store as ObjectId
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      merchantOrderId,
      amount: parseFloat(amount),
      currency,
      status,
      customerName,
      customerVPA,
      customerContact,
      paymentMethod,
      paymentOption,
      upiId,
      txnRefId,       // Can be used for UTR or other external references
      enpayTxnId: connectorTxnId, // Storing connector's transaction ID
      remark,
      // Add other fields as necessary
    });

    await newTransaction.save({ session });

    // 2. If status is 'Success', update merchant's balance
    // This logic should ideally be handled carefully, often in a post-transaction webhook
    // or a dedicated settlement process to avoid double-crediting.
    // For now, we'll assume direct credit on immediate success.
    if (['Success', 'SUCCESS'].includes(status)) {
      merchant.balance += parseFloat(amount);
      await merchant.save({ session });
    }

    await session.commitTransaction();
    res.status(201).json({
      message: "Payment transaction created successfully.",
      transaction: newTransaction,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating payment transaction:", error);
    res.status(500).json({ message: "Server error during payment transaction creation.", error: error.message });
  } finally {
    session.endSession();
  }
};


// --- Update a payment transaction status ---
// This is typically called by a webhook from a payment gateway to update transaction status.
export const updateTransactionStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // Expecting our internal `transactionId` or MongoDB `_id`
    const { status, connectorTxnId, txnRefId, remark } = req.body; // New status, and optional fields from gateway

    let transaction;
    if (mongoose.Types.ObjectId.isValid(id)) {
        transaction = await Transaction.findById(id).session(session);
    }
    if (!transaction) { // If not found by _id or invalid _id, try by our `transactionId`
        transaction = await Transaction.findOne({ transactionId: id }).session(session);
    }

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Transaction not found." });
    }

    const oldStatus = transaction.status;
    transaction.status = status;
    if (connectorTxnId) transaction.enpayTxnId = connectorTxnId;
    if (txnRefId) transaction.txnRefId = txnRefId; // For UTR or other gateway ref
    if (remark) transaction.remark = remark;

    await transaction.save({ session });

    // Handle balance update only if status changes to a successful state and wasn't already
    if (['Success', 'SUCCESS'].includes(status) && !['Success', 'SUCCESS'].includes(oldStatus)) {
      const merchant = await User.findById(transaction.merchantId).session(session);
      if (merchant) {
        merchant.balance += transaction.amount;
        await merchant.save({ session });
      }
    }
    // Handle Refund logic: If a transaction is marked as 'Refund', deduct from merchant balance
    if (['Refund', 'REFUND'].includes(status) && !['Refund', 'REFUND'].includes(oldStatus)) {
        const merchant = await User.findById(transaction.merchantId).session(session);
        if (merchant) {
            merchant.balance -= transaction.amount; // Deduct the refunded amount
            await merchant.save({ session });
        }
    }


    await session.commitTransaction();
    res.status(200).json({
      message: "Transaction status updated successfully.",
      transaction,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating transaction status:", error);
    res.status(500).json({ message: "Server error during transaction status update.", error: error.message });
  } finally {
    session.endSession();
  }
};


// --- Get All Payment Transactions with Advanced Filters & Pagination ---
export const getAllPaymentTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt:-1', // Default sort by latest
      merchantId,
      status,
      transactionId, // Our internal transactionId
      merchantOrderId,
      startDate,
      endDate,
      paymentMethod,
      customerContact,
      customerName,
      connectorId, // If you ever decide to store connectorId directly in Transaction model
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
    if (customerName) matchQuery.customerName = { $regex: customerName, $options: 'i' }; // Case-insensitive search

    // Date range filter for createdAt
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
          from: 'users', // Collection name for the User model
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
          merchantName: { $ifNull: ["$merchantDetails.company", { $concat: ["$merchantDetails.firstname", " ", "$merchantDetails.lastname"] }] }, // Use company if available, else combine names
          amount: 1,
          currency: 1,
          status: 1,
          paymentMethod: 1,
          paymentOption: 1,
          customerName: 1,
          customerVPA: 1,
          customerContact: 1,
          txnRefId: 1, // UTR or gateway reference
          enpayTxnId: 1, // Our gateway's transaction ID
          createdAt: 1,
          updatedAt: 1,
          // ... include any other fields you need for your table
          merchantDetails: 0, // Exclude the raw merchantDetails object
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
    res.status(500).json({ message: 'Server Error fetching payments', error: error.message });
  }
};


// --- Get a single Payment Transaction by ID or transactionId ---
export const getPaymentTransactionById = async (req, res) => {
  try {
    const { id } = req.params; // Can be MongoDB _id or our custom transactionId

    let transaction;
    // First try to find by MongoDB _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      transaction = await Transaction.findById(id)
        .populate('merchantId', 'company firstname lastname mid');
    }

    // If not found by _id or invalid _id format, try by our custom transactionId
    if (!transaction) {
      transaction = await Transaction.findOne({ transactionId: id })
        .populate('merchantId', 'company firstname lastname mid');
    }

    if (!transaction) {
      return res.status(404).json({ message: 'Payment Transaction not found' });
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error fetching payment transaction by ID:', error);
    res.status(500).json({ message: 'Server Error fetching payment transaction', error: error.message });
  }
};

// --- Get total payout balance for a merchant ---
// This retrieves the 'balance' field from the User model for a specific merchant.
export const getMerchantPayoutBalance = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
        return res.status(400).json({ message: "Invalid Merchant ID format." });
    }

    const merchant = await User.findById(merchantId).select('balance unsettleBalance');

    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ message: "Merchant not found." });
    }
    res.status(200).json({
      totalPayoutBalance: merchant.balance,
      unsettledBalance: merchant.unsettleBalance,
    });
  } catch (error) {
    console.error("Error fetching merchant payout balance:", error);
    res.status(500).json({ message: "Server error fetching merchant payout balance.", error: error.message });
  }
};

/*
// --- Combining Payment and Payout Transactions ---
// This is a more complex scenario if you want to display both in one table.
// It involves aggregating both Transaction and PayoutTransaction models.
export const getCombinedTransactions = async (req, res) => {
  try {
    const {
      page = 1, limit = 10, sort = 'createdAt:-1', merchantId, status,
      utr, transactionId, merchantOrderId, type // 'Debit'/'Credit' for payouts
    } = req.query;

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);

    const commonMatchQuery = {};
    if (merchantId) {
      if (!mongoose.Types.ObjectId.isValid(merchantId)) {
        return res.status(400).json({ message: 'Invalid Merchant ID format.' });
      }
      commonMatchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }
    if (status) commonMatchQuery.status = status;

    const paymentTransactionsPromise = Transaction.aggregate([
        { $match: commonMatchQuery },
        {
          $project: {
            _id: 1,
            refId: "$transactionId", // Map to common field name
            orderId: "$merchantOrderId",
            merchantId: "$merchantId",
            merchantName: "$merchantName",
            amount: "$amount",
            type: "Payment", // Hardcode type for payments
            status: "$status",
            createdAt: "$createdAt",
            // Add other relevant fields
          }
        }
    ]);

    const payoutTransactionsQuery = { ...commonMatchQuery };
    if (utr) payoutTransactionsQuery.utr = utr;
    if (type) payoutTransactionsQuery.transactionType = type; // Debit/Credit for payouts

    const payoutTransactionsPromise = PayoutTransaction.aggregate([
        { $match: payoutTransactionsQuery },
        {
          $project: {
            _id: 1,
            refId: "$utr", // Map to common field name
            orderId: null, // Payouts usually don't have merchantOrderId
            merchantId: "$merchantId",
            merchantName: "$merchantName",
            amount: "$amount",
            type: "$transactionType", // 'Debit' or 'Credit'
            status: "$status",
            createdAt: "$createdAt",
            // Add other relevant fields
          }
        }
    ]);

    const [paymentTransactions, payoutTransactions] = await Promise.all([
      paymentTransactionsPromise,
      payoutTransactionsPromise
    ]);

    let combinedTransactions = [...paymentTransactions, ...payoutTransactions];

    // Apply sorting
    if (sort) {
      const [field, order] = sort.split(':');
      combinedTransactions.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return order === '-1' ? 1 : -1;
        if (valA > valB) return order === '-1' ? -1 : 1;
        return 0;
      });
    }

    const totalDocs = combinedTransactions.length;
    const paginatedDocs = combinedTransactions.slice(
      (parsedPage - 1) * parsedLimit,
      parsedPage * parsedLimit
    );

    res.status(200).json({
      docs: paginatedDocs,
      totalDocs: totalDocs,
      limit: parsedLimit,
      page: parsedPage,
      totalPages: Math.ceil(totalDocs / parsedLimit),
      hasNextPage: (parsedPage * parsedLimit) < totalDocs,
      hasPrevPage: parsedPage > 1
    });

  } catch (error) {
    console.error('Error fetching combined transactions:', error);
    res.status(500).json({ message: 'Server Error fetching combined transactions', error: error.message });
  }
};
*/
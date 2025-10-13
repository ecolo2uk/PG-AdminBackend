import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import mongoose from 'mongoose'; // Import mongoose to use mongoose.Types.ObjectId

export const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'transactionDate:-1', merchantId } = req.query;

    let matchQuery = {};
    if (merchantId) {
      // If merchantId is provided as a query parameter, convert it to ObjectId for matching
      // assuming merchantId in Transaction documents is actually the Merchant's _id (as a string)
      if (!mongoose.Types.ObjectId.isValid(merchantId)) {
        return res.status(400).json({ message: 'Invalid Merchant ID format.' });
      }
      matchQuery.merchantId = merchantId; // Match as string in transactions initially
    }

    // Parse sort parameter
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortOptions[field] = order === '-1' ? -1 : 1;
    }

    const aggregationPipeline = [
      { $match: matchQuery }, // Filter transactions if merchantId is provided
      {
        $addFields: {
          // Convert transaction.merchantId string to ObjectId for $lookup
          merchantObjectId: {
            $cond: {
              if: { $ne: ["$merchantId", null] }, // Only convert if merchantId exists
              then: { $toObjectId: "$merchantId" },
              else: null
            }
          }
        }
      },
      {
        $lookup: {
          from: 'merchants', // The name of the Merchant collection (usually lowercase and plural of model name)
          localField: 'merchantObjectId', // Use the converted ObjectId field for lookup
          foreignField: '_id', // Field from the merchants collection (which is ObjectId)
          as: 'merchantDetails'
        }
      },
      {
        $unwind: {
          path: '$merchantDetails',
          preserveNullAndEmptyArrays: true // Keep transactions even if no merchant match
        }
      },
      {
        $addFields: {
          merchantName: { $ifNull: ["$merchantDetails.name", "$merchantName"] } // Use joined name, or existing if not joined
        }
      },
      {
        $project: {
          merchantDetails: 0, // Remove the joined merchantDetails object from the final output
          merchantObjectId: 0, // Remove the temporary ObjectId field
          // Explicitly include all other fields you need for the table
          _id: 1,
          transactionRefId: 1,
          merchantOrderId: 1,
          amount: 1,
          transactionStatus: 1,
          transactionDate: 1,
          transactionsStatus: 1, // Keep this as a fallback if transactionStatus is sometimes empty
          merchantName: 1, // Include the new merchantName
          merchantId: 1 // Keep original merchantId for potential filtering/reference
          // ... include other fields from your Transaction schema that the table might need
        }
      },
      { $sort: sortOptions }, // Apply sorting after lookup
      { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
      { $limit: parseInt(limit, 10) }
    ];

    const transactions = await Transaction.aggregate(aggregationPipeline);
    const totalDocs = await Transaction.countDocuments(matchQuery); // Count based on the initial match query

    res.status(200).json({
      docs: transactions,
      totalDocs: totalDocs,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10),
      totalPages: Math.ceil(totalDocs / parseInt(limit, 10)),
      hasNextPage: (parseInt(page, 10) * parseInt(limit, 10)) < totalDocs,
      hasPrevPage: parseInt(page, 10) > 1
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get single transaction by ID or transactionRefId
// @route   GET /api/transactions/:id
// @access  Public
export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching transaction by ID:', id);

    let transaction;

    // First try to find by transactionRefId
    transaction = await Transaction.findOne({ transactionRefId: id });
    
    if (!transaction) {
      // If not found by transactionRefId, try by MongoDB _id
      transaction = await Transaction.findById(id);
    }

    if (!transaction) {
      return res.status(404).json({
        message: 'Transaction not found'
      });
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};

// Simple version without pagination for testing
export const getAllTransactionsSimple = async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .sort({ transactionDate: -1 })
      .limit(100);
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (req, res) => {
  try {
    const newTransaction = new Transaction(req.body);
    await newTransaction.save();
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(400).json({
      message: 'Failed to create transaction',
      error: error.message
    });
  }
};

// @desc    Update a transaction
// @route   PUT /api/transactions/:id
// @access  Private
export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTransaction = await Transaction.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });
    if (!updatedTransaction) {
      return res.status(404).json({
        message: 'Transaction not found'
      });
    }
    res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(400).json({
      message: 'Failed to update transaction',
      error: error.message
    });
  }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTransaction = await Transaction.findByIdAndDelete(id);
    if (!deletedTransaction) {
      return res.status(404).json({
        message: 'Transaction not found'
      });
    }
    res.status(200).json({
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};
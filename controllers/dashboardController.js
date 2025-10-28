import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (filter) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_week':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setDate(now.getDate() + (6 - now.getDay()));
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        return {};
      }
      break;
    default:
      return {};
  }

  console.log(`📅 Date Range for ${filter}:`, {
    start: start.toISOString(),
    end: end.toISOString()
  });

  return {
    createdAt: {
      $gte: start,
      $lte: end
    }
  };
};

export const getAllMerchants = async (req, res) => {
  try {
    const merchants = await User.find({ 
      role: "merchant", 
      status: "Active" 
    })
    .select('_id firstname lastname company email contact')
    .sort({ firstname: 1 });

    console.log('✅ Merchants fetched from User model:', merchants.length);
    res.status(200).json(merchants);
  } catch (error) {
    console.error('❌ Error fetching merchants:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

export const getDashboardAnalytics = async (req, res) => {
  try {
    const { merchantId, timeFilter = 'today', startDate, endDate } = req.query;

    console.log('🟡 Fetching analytics with:', { merchantId, timeFilter, startDate, endDate });

    let matchQuery = {};
    
    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter, startDate, endDate);
      matchQuery = { ...matchQuery, ...dateRange };
    }

    // ✅ FIXED: Consistent status matching for all statuses
    const analytics = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSuccessAmount: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Success", "SUCCESS"]] }, "$amount", 0] 
            }
          },
          totalFailedAmount: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Failed", "FAILED"]] }, "$amount", 0] 
            }
          },
          totalPendingAmount: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Pending", "PENDING"]] }, "$amount", 0] 
            }
          },
          // ✅ FIXED: Refund status matching
          totalRefundAmount: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Refund", "REFUND"]] }, "$amount", 0] 
            }
          },
          totalSuccessOrders: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Success", "SUCCESS"]] }, 1, 0] 
            }
          },
          totalFailedOrders: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Failed", "FAILED"]] }, 1, 0] 
            }
          },
          totalPendingOrders: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Pending", "PENDING"]] }, 1, 0] 
            }
          },
          // ✅ FIXED: Refund orders count
          totalRefundOrders: {
            $sum: { 
              $cond: [{ $in: ["$status", ["Refund", "REFUND"]] }, 1, 0] 
            }
          },
          totalTransactions: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          totalSuccessAmount: { $ifNull: ["$totalSuccessAmount", 0] },
          totalFailedAmount: { $ifNull: ["$totalFailedAmount", 0] },
          totalPendingAmount: { $ifNull: ["$totalPendingAmount", 0] },
          totalRefundAmount: { $ifNull: ["$totalRefundAmount", 0] },
          totalSuccessOrders: { $ifNull: ["$totalSuccessOrders", 0] },
          totalFailedOrders: { $ifNull: ["$totalFailedOrders", 0] },
          totalPendingOrders: { $ifNull: ["$totalPendingOrders", 0] },
          totalRefundOrders: { $ifNull: ["$totalRefundOrders", 0] },
          totalTransactions: { $ifNull: ["$totalTransactions", 0] }
        }
      }
    ]);

    const result = analytics.length > 0 ? analytics[0] : {
      totalSuccessAmount: 0,
      totalFailedAmount: 0,
      totalPendingAmount: 0,
      totalRefundAmount: 0,
      totalSuccessOrders: 0,
      totalFailedOrders: 0,
      totalPendingOrders: 0,
      totalRefundOrders: 0,
      totalTransactions: 0
    };

    console.log('✅ Analytics result:', result);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error fetching dashboard analytics:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};

export const getTransactionsByMerchant = async (req, res) => {
  try {
    const { merchantId, timeFilter = 'today', page = 1, limit = 10 } = req.query;

    console.log('🟡 Fetching transactions by merchant:', { merchantId, timeFilter });

    let matchQuery = {};
    
    // Merchant filter
    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    // Date filter
    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter);
      matchQuery = { ...matchQuery, ...dateRange };
    }

    console.log('🔍 Match Query for merchant transactions:', JSON.stringify(matchQuery, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchantInfo'
        }
      },
      {
        $unwind: {
          path: '$merchantInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          transactionId: 1,
          merchantOrderId: 1,
          amount: 1,
          status: 1,
          currency: 1,
          createdAt: 1,
          updatedAt: 1,
          merchantName: {
            $cond: {
              if: { 
                $and: [
                  "$merchantInfo",
                  "$merchantInfo.company",
                  { $ne: ["$merchantInfo.company", ""] }
                ]
              },
              then: "$merchantInfo.company",
              else: {
                $cond: {
                  if: { 
                    $and: [
                      "$merchantInfo",
                      "$merchantInfo.firstname", 
                      "$merchantInfo.lastname"
                    ]
                  },
                  then: { $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"] },
                  else: "$merchantName"
                }
              }
            }
          },
          merchantEmail: "$merchantInfo.email",
          merchantContact: "$merchantInfo.contact"
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const totalDocs = await Transaction.countDocuments(matchQuery);

    console.log(`✅ Found ${transactions.length} transactions for merchant ${merchantId}`);

    res.status(200).json({
      docs: transactions,
      totalDocs,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(totalDocs / parseInt(limit)),
      hasNextPage: page * limit < totalDocs,
      hasPrevPage: page > 1
    });

  } catch (error) {
    console.error('❌ Error fetching transactions by merchant:', error);
    console.error('🔍 Error details:', error.message);
    console.error('🔍 Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getMerchantTransactionSummary = async (req, res) => {
  try {
    const { timeFilter = 'today', merchantId } = req.query;

    console.log('🟡 Fetching merchant summary with:', { timeFilter, merchantId });

    let matchQuery = {};
    
    // Merchant filter with ObjectId conversion
    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    // Date filter
    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter);
      matchQuery = { ...matchQuery, ...dateRange };
    }

    console.log('🔍 Match Query:', JSON.stringify(matchQuery, null, 2));

    const merchantSummary = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$merchantId",
          totalTransactions: { $sum: 1 },
          successCount: { 
            $sum: { 
              $cond: [{ $in: ["$status", ["Success", "SUCCESS"]] }, 1, 0] 
            } 
          },
          pendingCount: { 
            $sum: { 
              $cond: [{ $in: ["$status", ["Pending", "PENDING"]] }, 1, 0] 
            } 
          },
          failedCount: { 
            $sum: { 
              $cond: [{ $in: ["$status", ["Failed", "FAILED"]] }, 1, 0] 
            } 
          },
          refundCount: { 
            $sum: { 
              $cond: [{ $eq: ["$status", "REFUND"] }, 1, 0] 
            } 
          },
          totalAmount: { $sum: "$amount" }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'merchantInfo'
        }
      },
      {
        $unwind: {
          path: '$merchantInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          merchantId: "$_id",
          merchantName: {
            $cond: {
              if: { $and: ["$merchantInfo", "$merchantInfo.company", { $ne: ["$merchantInfo.company", ""] }] },
              then: "$merchantInfo.company",
              else: {
                $cond: {
                  if: { $and: ["$merchantInfo", "$merchantInfo.firstname", "$merchantInfo.lastname"] },
                  then: { $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"] },
                  else: "Unknown Merchant"
                }
              }
            }
          },
          merchantEmail: { $ifNull: ["$merchantInfo.email", "N/A"] },
          merchantContact: { $ifNull: ["$merchantInfo.contact", "N/A"] },
          totalTransactions: 1,
          successCount: 1,
          pendingCount: 1,
          failedCount: 1,
          refundCount: 1,
          totalAmount: 1
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    console.log('✅ Merchant summary fetched:', merchantSummary.length, 'merchants');
    console.log('📊 Sample merchant data:', merchantSummary[0]);

    res.status(200).json(merchantSummary);
  } catch (error) {
    console.error('❌ Error fetching merchant transaction summary:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Get Transactions by Merchant and Status - COMPLETE WORKING VERSION
export const getTransactionsByMerchantStatus = async (req, res) => {
  try {
    const { merchantId, status, timeFilter = 'today', page = 1, limit = 10 } = req.query;

    console.log('🟡 Fetching transactions with:', { merchantId, status, timeFilter });

    let matchQuery = {};
    
    // CRITICAL FIX: Convert merchantId to ObjectId for query
    if (merchantId && merchantId !== 'all') {
      // Convert string to ObjectId for querying
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    // Status filter
    if (status && status !== 'all') {
      const statusMapping = {
        'SUCCESS': ['Success', 'SUCCESS'],
        'PENDING': ['Pending', 'PENDING'],
        'FAILED': ['Failed', 'FAILED'],
        'REFUND': ['REFUND', 'Refund']
      };
      
      if (statusMapping[status]) {
        matchQuery.status = { $in: statusMapping[status] };
      } else {
        matchQuery.status = { $regex: new RegExp(status, 'i') };
      }
    }

    // Date filter
    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter);
      matchQuery = { ...matchQuery, ...dateRange };
    }

    console.log('🔍 Final Match Query:', JSON.stringify(matchQuery, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Use aggregation with proper ObjectId handling
    const transactions = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchantInfo'
        }
      },
      {
        $unwind: {
          path: '$merchantInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          transactionId: 1,
          merchantOrderId: 1,
          amount: 1,
          status: 1,
          currency: 1,
          createdAt: 1,
          merchantName: {
            $cond: {
              if: { 
                $and: [
                  "$merchantInfo",
                  "$merchantInfo.company",
                  { $ne: ["$merchantInfo.company", ""] }
                ]
              },
              then: "$merchantInfo.company",
              else: {
                $cond: {
                  if: { 
                    $and: [
                      "$merchantInfo",
                      "$merchantInfo.firstname", 
                      "$merchantInfo.lastname"
                    ]
                  },
                  then: { $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"] },
                  else: "$merchantName" // Fallback to original merchantName
                }
              }
            }
          }
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const totalDocs = await Transaction.countDocuments(matchQuery);

    console.log(`✅ Found ${transactions.length} transactions out of ${totalDocs} total`);

    res.status(200).json({
      docs: transactions,
      totalDocs,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(totalDocs / parseInt(limit)),
      hasNextPage: page * limit < totalDocs,
      hasPrevPage: page > 1
    });

  } catch (error) {
    console.error('❌ Error fetching transactions by merchant status:', error);
    console.error('🔍 Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Recent Orders
export const getRecentOrders = async (req, res) => {
  try {
    const { limit = 10, merchantId, status, timeFilter = 'today' } = req.query;

    let matchQuery = {};
    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = merchantId;
    }
    if (status && status !== 'all') {
      matchQuery.status = { $regex: new RegExp(status, 'i') };
    }

    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter);
      matchQuery = { ...matchQuery, ...dateRange };
    }

    const transactions = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchantInfo'
        }
      },
      {
        $unwind: {
          path: '$merchantInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          transactionId: 1,
          merchantOrderId: 1,
          amount: 1,
          status: 1,
          createdAt: 1,
          merchantName: {
            $cond: {
              if: { $and: ["$merchantInfo", "$merchantInfo.company"] },
              then: "$merchantInfo.company",
              else: {
                $cond: {
                  if: { $and: ["$merchantInfo", "$merchantInfo.firstname", "$merchantInfo.lastname"] },
                  then: { $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"] },
                  else: "Unknown Merchant"
                }
              }
            }
          }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: parseInt(limit, 10) }
    ]);

    const totalDocs = await Transaction.countDocuments(matchQuery);
    
    console.log('✅ Recent orders fetched:', transactions.length);

    res.status(200).json({
      docs: transactions,
      totalDocs,
      limit: parseInt(limit, 10),
      page: 1,
      totalPages: Math.ceil(totalDocs / parseInt(limit, 10)),
      hasNextPage: false,
      hasPrevPage: false
    });

  } catch (error) {
    console.error('❌ Error fetching recent orders:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

// Debug endpoint to check data structure
export const debugDataStructure = async (req, res) => {
  try {
    // Check a sample transaction
    const sampleTransaction = await Transaction.findOne();
    console.log('🔍 Sample Transaction:', sampleTransaction);
    
    // Check a sample merchant
    const sampleMerchant = await User.findOne({ role: "merchant" });
    console.log('🔍 Sample Merchant:', sampleMerchant);
    
    // Check if merchantId matches
    const merchantIdInTransaction = sampleTransaction?.merchantId;
    const merchantIdInUser = sampleMerchant?._id?.toString();
    
    console.log('🔍 ID Comparison:', {
      transactionMerchantId: merchantIdInTransaction,
      userMerchantId: merchantIdInUser,
      typeTransaction: typeof merchantIdInTransaction,
      typeUser: typeof merchantIdInUser,
      areEqual: merchantIdInTransaction === merchantIdInUser
    });

    res.status(200).json({
      sampleTransaction: {
        merchantId: sampleTransaction?.merchantId,
        merchantName: sampleTransaction?.merchantName,
        type: typeof sampleTransaction?.merchantId
      },
      sampleMerchant: {
        _id: sampleMerchant?._id,
        company: sampleMerchant?.company,
        firstname: sampleMerchant?.firstname,
        lastname: sampleMerchant?.lastname,
        type: typeof sampleMerchant?._id
      },
      comparison: {
        areIdsMatching: merchantIdInTransaction === merchantIdInUser,
        transactionId: merchantIdInTransaction,
        userId: merchantIdInUser
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add this to your dashboardController.js

// Helper function to determine the grouping for aggregation based on timeFilter
const getGroupingForSalesReport = (timeFilter) => {
    switch (timeFilter) {
        case 'today':
        case 'yesterday':
            // Group by hour for daily breakdown
            return {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
                hour: { $hour: "$createdAt" }
            };
        case 'this_week':
        case 'last_week':
        case 'this_month':
        case 'last_month':
            // Group by day of month
            return {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" }
            };
        case 'this_year':
        case 'last_year':
        case 'custom': // If custom range spans months/years
            // Group by month
            return {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
            };
        default:
            // Default to grouping by day if no specific filter
            return {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" }
            };
    }
};

export const getSalesReport = async (req, res) => {
    try {
        const { merchantId, timeFilter = 'today', startDate, endDate } = req.query;
        console.log('🟡 Fetching sales report with:', { merchantId, timeFilter, startDate, endDate });

        let matchQuery = {};

        if (merchantId && merchantId !== 'all') {
            matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
        }

        const dateRange = getDateRange(timeFilter, startDate, endDate);
        matchQuery = { ...matchQuery, ...dateRange };

        console.log('🔍 Sales Report Match Query:', JSON.stringify(matchQuery, null, 2));

        const groupById = getGroupingForSalesReport(timeFilter);

        const salesReport = await Transaction.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: groupById,
                    // Income from successful transactions
                    totalIncome: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["Success", "SUCCESS"]] }, "$amount", 0]
                        }
                    },
                    // Cost of Sales from failed transactions
                    totalCostOfSales: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["Failed", "FAILED"]] }, "$amount", 0]
                        }
                    },
                    // ✅ ADDED: Refund amount separately
                    totalRefundAmount: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["Refund", "REFUND"]] }, "$amount", 0]
                        }
                    },
                    // Pending transactions
                    totalPendingAmount: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["Pending", "PENDING"]] }, "$amount", 0]
                        }
                    },
                    // Total amount for all transactions (for verification)
                    totalAmount: { $sum: "$amount" },
                    // Count transactions by status for debugging
                    successCount: {
                        $sum: { $cond: [{ $in: ["$status", ["Success", "SUCCESS"]] }, 1, 0] }
                    },
                    failedCount: {
                        $sum: { $cond: [{ $in: ["$status", ["Failed", "FAILED"]] }, 1, 0] }
                    },
                    pendingCount: {
                        $sum: { $cond: [{ $in: ["$status", ["Pending", "PENDING"]] }, 1, 0] }
                    },
                    refundCount: {
                        $sum: { $cond: [{ $in: ["$status", ["Refund", "REFUND"]] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: { $ifNull: ["$_id.day", 1] },
                            hour: { $ifNull: ["$_id.hour", 0] }
                        }
                    },
                    month: "$_id.month",
                    hour: "$_id.hour",
                    totalIncome: { $ifNull: ["$totalIncome", 0] },
                    totalCostOfSales: { $ifNull: ["$totalCostOfSales", 0] },
                    totalRefundAmount: { $ifNull: ["$totalRefundAmount", 0] }, // ✅ ADDED
                    totalPendingAmount: { $ifNull: ["$totalPendingAmount", 0] },
                    totalAmount: { $ifNull: ["$totalAmount", 0] },
                    successCount: 1,
                    failedCount: 1,
                    pendingCount: 1,
                    refundCount: 1
                }
            },
            { $sort: { date: 1 } }
        ]);

        console.log(`✅ Sales report fetched: ${salesReport.length} entries`);
        
        if (salesReport.length > 0) {
            console.log('📊 Sales report details:', {
                firstEntry: salesReport[0],
                totalEntries: salesReport.length,
                totalIncome: salesReport.reduce((sum, item) => sum + item.totalIncome, 0),
                totalPending: salesReport.reduce((sum, item) => sum + item.totalPendingAmount, 0),
                totalCost: salesReport.reduce((sum, item) => sum + item.totalCostOfSales, 0),
                totalRefund: salesReport.reduce((sum, item) => sum + item.totalRefundAmount, 0), // ✅ ADDED
                totalAmount: salesReport.reduce((sum, item) => sum + item.totalAmount, 0)
            });
        } else {
            console.log('📊 No sales report data found for the given filters');
        }
        
        res.status(200).json(salesReport);

    } catch (error) {
        console.error('❌ Error fetching sales report:', error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};



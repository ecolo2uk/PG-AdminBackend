// controllers/dashboardController.js
import Transaction from '../models/Transaction.js';
import User from '../models/User.js'; // Assuming User model contains merchant info
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
      start.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setDate(now.getDate() + (6 - now.getDay())); // End of current week (Saturday)
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
      end.setHours(23, 59, 59, 999);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
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

  // Use 'createdAt' for filtering since 'timestamps: true' adds it
  return {
    createdAt: {
      $gte: start,
      $lte: end
    }
  };
};

// Helper to unify transaction status for aggregation
const getUnifiedStatusMatch = (status) => {
  const statusMappings = {
    'SUCCESS': ['Success', 'SUCCESS'],
    'PENDING': ['Pending', 'PENDING'],
    'FAILED': ['Failed', 'FAILED'],
    'REFUND': ['Refund', 'REFUND'],
    'INITIATED': ['Initiated', 'INITIATED'],
  };
  return statusMappings[status.toUpperCase()] || [status]; // Default to original status if no mapping
};

// Helper to get transaction amount regardless of schema
const getTransactionAmountField = {
  $cond: {
    if: { $ne: ["$amount", undefined] },
    then: "$amount",
    else: { $ifNull: ["$Amount", 0] } // Fallback to old 'Amount' field
  }
};

// Helper to get transaction status regardless of schema
const getTransactionStatusField = {
  $cond: {
    if: { $ne: ["$status", undefined] },
    then: "$status",
    else: { $ifNull: ["$Transaction Status", "Unknown"] } // Fallback to old 'Transaction Status'
  }
};

// Helper to get transaction ID regardless of schema
const getTransactionIdField = {
  $cond: {
    if: { $ne: ["$transactionId", undefined] },
    then: "$transactionId",
    else: { $ifNull: ["$Transaction Reference ID", "N/A"] }
  }
};

// Helper to get merchantOrderId regardless of schema
const getMerchantOrderIdField = {
  $cond: {
    if: { $ne: ["$merchantOrderId", undefined] },
    then: "$merchantOrderId",
    else: { $ifNull: ["$Vendor Ref ID", "N/A"] }
  }
};

// Helper to get merchantName regardless of schema
const getMerchantNameField = {
  $cond: {
    if: { $ne: ["$merchantName", undefined] },
    then: "$merchantName",
    else: { $ifNull: ["$Merchant Name", "Unknown Merchant"] }
  }
};

// Helper to get createdAt regardless of schema
const getCreatedAtField = {
  $cond: {
    if: { $ne: ["$createdAt", undefined] },
    then: "$createdAt",
    else: { // Attempt to parse Transaction Date from old schema
      $cond: {
        if: { $ne: ["$Transaction Date", undefined] },
        then: { $dateFromString: { dateString: "$Transaction Date" } },
        else: new Date()
      }
    }
  }
};

export const getAllMerchants = async (req, res) => {
  try {
    const merchants = await User.find({
        role: "merchant",
        status: "Active"
      })
      .select('_id firstname lastname company email contact')
      .sort({
        firstname: 1
      });

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
    const {
      merchantId,
      timeFilter = 'today',
      startDate,
      endDate
    } = req.query;

    console.log('🟡 Fetching analytics with:', {
      merchantId,
      timeFilter,
      startDate,
      endDate
    });

    let matchQuery = {};

    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    const dateRange = getDateRange(timeFilter, startDate, endDate);
    // Use the unified createdAt field for date filtering
    matchQuery = { ...matchQuery, ...dateRange
    };


    const analytics = await Transaction.aggregate([
      // First, normalize status and amount fields
      {
        $addFields: {
          unifiedStatus: getTransactionStatusField,
          unifiedAmount: getTransactionAmountField,
          unifiedCreatedAt: getCreatedAtField // Add unified createdAt for matching
        }
      },
      // Now match using the unified fields
      {
        $match: {
          ...matchQuery,
          // Ensure date range also applies to the unifiedCreatedAt
          ...(matchQuery.createdAt && {
            unifiedCreatedAt: matchQuery.createdAt
          })
        }
      },
      {
        $group: {
          _id: null,
          totalSuccessAmount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("SUCCESS")]
              }, "$unifiedAmount", 0]
            }
          },
          totalFailedAmount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("FAILED")]
              }, "$unifiedAmount", 0]
            }
          },
          totalPendingAmount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("PENDING")]
              }, "$unifiedAmount", 0]
            }
          },
          totalRefundAmount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("REFUND")]
              }, "$unifiedAmount", 0]
            }
          },
          totalSuccessOrders: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("SUCCESS")]
              }, 1, 0]
            }
          },
          totalFailedOrders: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("FAILED")]
              }, 1, 0]
            }
          },
          totalPendingOrders: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("PENDING")]
              }, 1, 0]
            }
          },
          totalRefundOrders: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("REFUND")]
              }, 1, 0]
            }
          },
          totalTransactions: {
            $sum: 1
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalSuccessAmount: {
            $ifNull: ["$totalSuccessAmount", 0]
          },
          totalFailedAmount: {
            $ifNull: ["$totalFailedAmount", 0]
          },
          totalPendingAmount: {
            $ifNull: ["$totalPendingAmount", 0]
          },
          totalRefundAmount: {
            $ifNull: ["$totalRefundAmount", 0]
          },
          totalSuccessOrders: {
            $ifNull: ["$totalSuccessOrders", 0]
          },
          totalFailedOrders: {
            $ifNull: ["$totalFailedOrders", 0]
          },
          totalPendingOrders: {
            $ifNull: ["$totalPendingOrders", 0]
          },
          totalRefundOrders: {
            $ifNull: ["$totalRefundOrders", 0]
          },
          totalTransactions: {
            $ifNull: ["$totalTransactions", 0]
          }
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

export const getTransactionsByMerchantStatus = async (req, res) => {
  try {
    const {
      merchantId,
      status,
      timeFilter = 'today',
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = req.query;

    console.log('🟡 Fetching transactions by merchant and status with:', {
      merchantId,
      status,
      timeFilter,
      startDate,
      endDate
    });

    let matchQuery = {};

    if (merchantId && merchantId !== 'all' && merchantId !== 'null' && mongoose.Types.ObjectId.isValid(merchantId)) {
    matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
  } else if (merchantId === 'null') { // Handle explicit 'null' string for unknown merchant
    matchQuery.merchantId = null; 
  }
    if (status && status !== 'all') {
      matchQuery.unifiedStatus = {
        $in: getUnifiedStatusMatch(status)
      };
    }

    const dateRange = getDateRange(timeFilter, startDate, endDate);
    // Use the unified createdAt field for date filtering
    matchQuery = { ...matchQuery,
      ...(dateRange.createdAt && {
        unifiedCreatedAt: dateRange.createdAt
      })
    };


    console.log('🔍 Match Query for merchant transactions:', JSON.stringify(matchQuery, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.aggregate([
      // First, normalize status, amount, and ID fields
      {
        $addFields: {
          unifiedStatus: getTransactionStatusField,
          unifiedAmount: getTransactionAmountField,
          unifiedTransactionId: getTransactionIdField,
          unifiedMerchantOrderId: getMerchantOrderIdField,
          unifiedCreatedAt: getCreatedAtField,
          unifiedMerchantName: getMerchantNameField,
          merchantRefId: "$merchantId" // Preserve original merchantId for lookup
        }
      },
      // Now match using the unified fields
      {
        $match: matchQuery
      },
      {
        $lookup: {
          from: 'users', // Collection name for User model
          localField: 'merchantRefId', // Original merchantId from Transaction document
          foreignField: '_id', // _id field from User document
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
          _id: 1,
          transactionId: "$unifiedTransactionId",
          merchantOrderId: "$unifiedMerchantOrderId",
          amount: "$unifiedAmount",
          status: "$unifiedStatus",
          currency: {
            $ifNull: ["$currency", "INR"]
          }, // Assume INR if not present
          createdAt: "$unifiedCreatedAt",
          updatedAt: {
            $ifNull: ["$updatedAt", "$createdAt"]
          },
          // Dynamically determine merchant name
          merchantName: {
            $cond: {
              if: {
                $and: [
                  "$merchantInfo",
                  "$merchantInfo.company",
                  {
                    $ne: ["$merchantInfo.company", ""]
                  }
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
                  then: {
                    $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"]
                  },
                  else: "$unifiedMerchantName" // Fallback to unifiedMerchantName from transaction
                }
              }
            }
          },
          merchantEmail: "$merchantInfo.email",
          merchantContact: "$merchantInfo.contact"
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // For totalDocs, we can use the same match query
    const totalDocs = await Transaction.aggregate([
      {
        $addFields: {
          unifiedStatus: getTransactionStatusField,
          unifiedCreatedAt: getCreatedAtField,
          merchantRefId: "$merchantId"
        }
      },
      {
        $match: matchQuery
      },
      {
        $count: "total"
      }
    ]);

    console.log(`✅ Found ${transactions.length} transactions out of ${totalDocs.length > 0 ? totalDocs[0].total : 0} total`);

    res.status(200).json({
      docs: transactions,
      totalDocs: totalDocs.length > 0 ? totalDocs[0].total : 0,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil((totalDocs.length > 0 ? totalDocs[0].total : 0) / parseInt(limit)),
      hasNextPage: (parseInt(page) * parseInt(limit)) < (totalDocs.length > 0 ? totalDocs[0].total : 0),
      hasPrevPage: parseInt(page) > 1
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


export const getMerchantTransactionSummary = async (req, res) => {
  try {
    const {
      timeFilter = 'today',
      merchantId,
      startDate,
      endDate
    } = req.query;

    console.log('🟡 Fetching merchant summary with:', {
      timeFilter,
      merchantId,
      startDate,
      endDate
    });

    let matchQuery = {};

    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    const dateRange = getDateRange(timeFilter, startDate, endDate);
    matchQuery = { ...matchQuery,
      ...(dateRange.createdAt && {
        unifiedCreatedAt: dateRange.createdAt
      })
    };


    console.log('🔍 Match Query:', JSON.stringify(matchQuery, null, 2));

    const merchantSummary = await Transaction.aggregate([
      // First, normalize status, amount, and ID fields
      {
        $addFields: {
          unifiedStatus: getTransactionStatusField,
          unifiedAmount: getTransactionAmountField,
          unifiedCreatedAt: getCreatedAtField
        }
      },
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: "$merchantId", // Group by the actual merchantId field (ObjectId)
          totalTransactions: {
            $sum: 1
          },
          successCount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("SUCCESS")]
              }, 1, 0]
            }
          },
          pendingCount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("PENDING")]
              }, 1, 0]
            }
          },
          failedCount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("FAILED")]
              }, 1, 0]
            }
          },
          refundCount: {
            $sum: {
              $cond: [{
                $in: ["$unifiedStatus", getUnifiedStatusMatch("REFUND")]
              }, 1, 0]
            }
          },
          totalAmount: {
            $sum: "$unifiedAmount"
          }
        }
      },
      {
        $lookup: {
          from: 'users', // Assuming your User model is in 'users' collection
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
              if: {
                $and: ["$merchantInfo", "$merchantInfo.company", {
                  $ne: ["$merchantInfo.company", ""]
                }]
              },
              then: "$merchantInfo.company",
              else: {
                $cond: {
                  if: {
                    $and: ["$merchantInfo", "$merchantInfo.firstname", "$merchantInfo.lastname"]
                  },
                  then: {
                    $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"]
                  },
                  else: "Unknown Merchant"
                }
              }
            }
          },
          merchantEmail: {
            $ifNull: ["$merchantInfo.email", "N/A"]
          },
          merchantContact: {
            $ifNull: ["$merchantInfo.contact", "N/A"]
          },
          totalTransactions: 1,
          successCount: 1,
          pendingCount: 1,
          failedCount: 1,
          refundCount: 1,
          totalAmount: 1
        }
      },
      {
        $sort: {
          totalAmount: -1
        }
      }
    ]);

    console.log('✅ Merchant summary fetched:', merchantSummary.length, 'merchants');
    if (merchantSummary.length > 0) {
      console.log('📊 Sample merchant data:', merchantSummary[0]);
    }


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


// New endpoint for ALL transactions
export const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      timeFilter = 'today',
      status, // Optional status filter
      merchantId, // Optional merchant filter
      startDate,
      endDate
    } = req.query;

    console.log('🟡 Fetching all transactions with:', {
      page,
      limit,
      timeFilter,
      status,
      merchantId,
      startDate,
      endDate
    });

    let matchQuery = {};

    const dateRange = getDateRange(timeFilter, startDate, endDate);
    matchQuery = { ...matchQuery,
      ...(dateRange.createdAt && {
        unifiedCreatedAt: dateRange.createdAt
      })
    };


    if (status && status !== 'all') {
      matchQuery.unifiedStatus = {
        $in: getUnifiedStatusMatch(status)
      };
    }

    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    console.log('🔍 Final Match Query for all transactions:', JSON.stringify(matchQuery, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const aggregationPipeline = [{
        $addFields: {
          unifiedTransactionId: getTransactionIdField,
          unifiedMerchantOrderId: getMerchantOrderIdField,
          unifiedAmount: getTransactionAmountField,
          unifiedStatus: getTransactionStatusField,
          unifiedMerchantName: getMerchantNameField,
          unifiedCreatedAt: getCreatedAtField,
          merchantRefId: "$merchantId" // Preserve original merchantId for lookup
        }
      },
      {
        $match: matchQuery
      },
      {
        $lookup: {
          from: 'users', // Collection name for User model
          localField: 'merchantRefId', // Original merchantId from Transaction document
          foreignField: '_id', // _id field from User document
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
          _id: 1, // Keep original _id for unique keys
          transactionId: "$unifiedTransactionId",
          merchantOrderId: "$unifiedMerchantOrderId",
          amount: "$unifiedAmount",
          status: "$unifiedStatus",
          currency: {
            $ifNull: ["$currency", "INR"]
          },
          createdAt: "$unifiedCreatedAt",
          updatedAt: {
            $ifNull: ["$updatedAt", "$createdAt"]
          }, // Fallback to createdAt if updatedAt missing
          merchantName: {
            $cond: {
              if: {
                $and: [
                  "$merchantInfo",
                  "$merchantInfo.company",
                  {
                    $ne: ["$merchantInfo.company", ""]
                  }
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
                  then: {
                    $concat: ["$merchantInfo.firstname", " ", "$merchantInfo.lastname"]
                  },
                  else: "$unifiedMerchantName" // Fallback to merchantName from transaction
                }
              }
            }
          },
          customerName: {
            $ifNull: ["$customerName", "$Customer Name"]
          },
          customerVPA: {
            $ifNull: ["$customerVPA", "$Customer VPA"]
          },
          customerContact: {
            $ifNull: ["$customerContact", "$Customer Contact No"]
          }
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: parseInt(limit)
      }
    ];

    const transactions = await Transaction.aggregate(aggregationPipeline);

    // Calculate total documents with the same match query
    const totalDocsPipeline = [{
        $addFields: {
          unifiedTransactionId: getTransactionIdField,
          unifiedMerchantOrderId: getMerchantOrderIdField,
          unifiedAmount: getTransactionAmountField,
          unifiedStatus: getTransactionStatusField,
          unifiedMerchantName: getMerchantNameField,
          unifiedCreatedAt: getCreatedAtField,
          merchantRefId: "$merchantId"
        }
      },
      {
        $match: matchQuery
      },
      {
        $count: "total"
      }
    ];
    const totalDocsResult = await Transaction.aggregate(totalDocsPipeline);
    const totalDocs = totalDocsResult.length > 0 ? totalDocsResult[0].total : 0;


    console.log(`✅ Fetched ${transactions.length} transactions out of ${totalDocs} total.`);

    res.status(200).json({
      docs: transactions,
      totalDocs,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(totalDocs / parseInt(limit)),
      hasNextPage: (parseInt(page) * parseInt(limit)) < totalDocs,
      hasPrevPage: parseInt(page) > 1
    });

  } catch (error) {
    console.error('❌ Error fetching all transactions:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
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



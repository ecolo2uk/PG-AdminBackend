// controllers/dashboardController.js
import Transaction from '../models/Transaction.js';
import User from '../models/User.js'; // Assuming User model contains merchant info
import mongoose from 'mongoose';

const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (filter) {
    case 'all_time': // For testing all data
  start = new Date(0); // Beginning of time
  end = new Date(); // Now
  break;
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
  // Last 7 days (including today)
  start = new Date(now);
  start.setDate(now.getDate() - 6); // Last 6 days + today = 7 days
  start.setHours(0, 0, 0, 0);
  end = new Date(now);
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

const getUnifiedStatusMatch = (status) => {
  console.log('🔍 Checking status mapping for:', status);
  
  const statusMappings = {
    'SUCCESS': ['SUCCESS', 'Success', 'success', 'SUCCESSFUL', 'successful'],
    'FAILED': ['FAILED', 'Failed', 'failed', 'FAILURE', 'failure', 'REJECTED', 'rejected'],
    'PENDING': ['PENDING', 'Pending', 'pending', 'INITIATED', 'Initiated', 'initiated', 'GENERATED', 'Generated', 'generated'],
    'REFUND': ['REFUND', 'Refund', 'refund', 'REFUNDED', 'refunded']
  };
  
  const upperStatus = status?.toUpperCase();
  const matchedStatuses = statusMappings[upperStatus] || [status];
  
  console.log('📊 Status mapping result:', {
    input: status,
    upperStatus: upperStatus,
    matchedStatuses: matchedStatuses
  });
  
  return matchedStatuses;
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
// controllers/dashboardController.js



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


// controllers/dashboardController.js मध्ये getMerchantTransactionSummary update करा
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

    // ✅ FIXED: Build filters
    const dateFilter = getDateRange(timeFilter, startDate, endDate);
    
    let merchantMatch = {};
    if (merchantId && merchantId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(merchantId)) {
        merchantMatch.merchantId = new mongoose.Types.ObjectId(merchantId);
      } else {
        merchantMatch.merchantId = merchantId;
      }
    }

    const matchQuery = {
      ...dateFilter,
      ...merchantMatch
    };

    console.log('🔍 Match Query:', JSON.stringify(matchQuery, null, 2));

    // ✅ FIXED: Use manual grouping instead of complex aggregation
    const transactions = await Transaction.find(matchQuery);
    
    console.log(`📊 Found ${transactions.length} transactions for merchant summary`);

    // Group by merchantId manually
    const merchantMap = new Map();
    
    transactions.forEach(transaction => {
      const merchantId = transaction.merchantId?.toString() || 'unknown';
      const amount = Number(transaction.amount) || 0;
      const status = String(transaction.status).toUpperCase().trim();
      
      if (!merchantMap.has(merchantId)) {
        merchantMap.set(merchantId, {
          merchantId: merchantId,
          merchantName: transaction.merchantName || 'Unknown Merchant',
          totalTransactions: 0,
          successCount: 0,
          failedCount: 0,
          pendingCount: 0,
          refundCount: 0,
          totalAmount: 0
        });
      }
      
      const merchantData = merchantMap.get(merchantId);
      merchantData.totalTransactions += 1;
      merchantData.totalAmount += amount;
      
      // Count by status
      if (['SUCCESS', 'SUCCESSFUL'].includes(status)) {
        merchantData.successCount += 1;
      } else if (['FAILED', 'FAILURE', 'FALLED'].includes(status)) {
        merchantData.failedCount += 1;
      } else if (['PENDING', 'INITIATED', 'GENERATED'].includes(status)) {
        merchantData.pendingCount += 1;
      } else if (['REFUND', 'REFUNDED'].includes(status)) {
        merchantData.refundCount += 1;
      }
    });

    // Convert map to array
    let merchantSummary = Array.from(merchantMap.values());
    
    // ✅ FIXED: Enhance with merchant info from User model
    const merchantIds = merchantSummary.map(m => m.merchantId).filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (merchantIds.length > 0) {
      const merchantsInfo = await User.find({
        _id: { $in: merchantIds }
      }).select('_id firstname lastname company email contact');
      
      const merchantInfoMap = new Map();
      merchantsInfo.forEach(merchant => {
        merchantInfoMap.set(merchant._id.toString(), merchant);
      });
      
      // Update merchant names with info from User model
      merchantSummary = merchantSummary.map(merchant => {
        const merchantInfo = merchantInfoMap.get(merchant.merchantId);
        if (merchantInfo) {
          return {
            ...merchant,
            merchantName: merchantInfo.company || `${merchantInfo.firstname} ${merchantInfo.lastname}`,
            merchantEmail: merchantInfo.email || 'N/A',
            merchantContact: merchantInfo.contact || 'N/A'
          };
        }
        return merchant;
      });
    }

    // Sort by total amount
    merchantSummary.sort((a, b) => b.totalAmount - a.totalAmount);

    console.log('✅ Merchant summary processed:', merchantSummary.length, 'merchants');
    
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

// controllers/dashboardController.js मध्ये getSalesReport update करा
export const getSalesReport = async (req, res) => {
    try {
        const { merchantId, timeFilter = 'this_week', startDate, endDate } = req.query;
        console.log('🟡 Fetching sales report with:', { merchantId, timeFilter, startDate, endDate });

        // ✅ FIXED: Use manual processing instead of aggregation
        const dateFilter = getDateRange(timeFilter, startDate, endDate);
        
        let merchantMatch = {};
        if (merchantId && merchantId !== 'all') {
            if (mongoose.Types.ObjectId.isValid(merchantId)) {
                merchantMatch.merchantId = new mongoose.Types.ObjectId(merchantId);
            } else {
                merchantMatch.merchantId = merchantId;
            }
        }

        const matchQuery = {
            ...dateFilter,
            ...merchantMatch
        };

        console.log('🔍 Sales Report Match Query:', JSON.stringify(matchQuery, null, 2));

        // ✅ FIXED: Get all transactions and process manually
        const transactions = await Transaction.find(matchQuery);
        
        console.log(`📊 Found ${transactions.length} transactions for sales report`);

        // Group by date manually
        const dailyData = new Map();
        
        transactions.forEach(transaction => {
            const date = new Date(transaction.createdAt);
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            if (!dailyData.has(dateKey)) {
                dailyData.set(dateKey, {
                    date: new Date(dateKey),
                    totalIncome: 0,
                    totalCostOfSales: 0,
                    totalRefundAmount: 0,
                    totalPendingAmount: 0,
                    successCount: 0,
                    failedCount: 0,
                    pendingCount: 0,
                    refundCount: 0
                });
            }
            
            const dayData = dailyData.get(dateKey);
            const amount = Number(transaction.amount) || 0;
            const status = String(transaction.status).toUpperCase().trim();
            
            // Count by status and amount
            if (['SUCCESS', 'SUCCESSFUL'].includes(status)) {
                dayData.successCount += 1;
                dayData.totalIncome += amount;
            } else if (['FAILED', 'FAILURE', 'FALLED'].includes(status)) {
                dayData.failedCount += 1;
                dayData.totalCostOfSales += amount;
            } else if (['PENDING', 'INITIATED', 'GENERATED'].includes(status)) {
                dayData.pendingCount += 1;
                dayData.totalPendingAmount += amount;
            } else if (['REFUND', 'REFUNDED'].includes(status)) {
                dayData.refundCount += 1;
                dayData.totalRefundAmount += amount;
            }
        });

        // Convert to array and sort by date
        let salesReport = Array.from(dailyData.values())
            .map(item => ({
                ...item,
                date: item.date.toISOString()
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`✅ Sales report processed: ${salesReport.length} days`);

        // Fill missing dates
        let finalReport = salesReport;
        if (salesReport.length === 0 || salesReport.length < 7) {
            console.log('📊 Filling missing dates in sales report');
            finalReport = fillMissingDatesManual(salesReport, timeFilter);
        }
        
        console.log('📊 Final sales report data:', finalReport);
        res.status(200).json(finalReport);

    } catch (error) {
        console.error('❌ Error fetching sales report:', error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

// ✅ FIXED: Manual date filling function
const fillMissingDatesManual = (existingData, timeFilter) => {
    const now = new Date();
    const result = [];
    let daysToShow = 7; // Default for this_week
    
    if (timeFilter === 'this_month') daysToShow = 30;
    else if (timeFilter === 'last_month') daysToShow = 30;
    else if (timeFilter === 'this_week') daysToShow = 7;
    
    for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dateString = date.toISOString().split('T')[0];
        const existing = existingData.find(item => {
            const itemDate = new Date(item.date).toISOString().split('T')[0];
            return itemDate === dateString;
        });
        
        if (existing) {
            result.push(existing);
        } else {
            result.push({
                date: date.toISOString(),
                totalIncome: 0,
                totalCostOfSales: 0,
                totalRefundAmount: 0,
                totalPendingAmount: 0,
                successCount: 0,
                failedCount: 0,
                pendingCount: 0,
                refundCount: 0
            });
        }
    }
    
    return result;
};
// controllers/dashboardController.js मध्ये getDashboardAnalytics update करा
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { timeFilter, merchantId, startDate, endDate } = req.query;
    
    console.log('🟡 Fetching dashboard analytics with:', {
      timeFilter,
      merchantId,
      startDate,
      endDate
    });

    // ✅ FIXED: Build proper date filter
    const dateFilter = getDateRange(timeFilter, startDate, endDate);
    
    // ✅ FIXED: Handle mixed merchantId types
    let merchantFilter = {};
    if (merchantId && merchantId !== 'all') {
      // Check if merchantId is valid ObjectId
      if (mongoose.Types.ObjectId.isValid(merchantId)) {
        merchantFilter.merchantId = new mongoose.Types.ObjectId(merchantId);
      } else {
        // If it's a string, use string comparison
        merchantFilter.merchantId = merchantId;
      }
    }

    console.log('🔍 Final filters:', {
      dateFilter,
      merchantFilter
    });

    // ✅ FIXED: Use direct MongoDB queries instead of aggregation
    const matchQuery = {
      ...dateFilter,
      ...merchantFilter
    };

    console.log('🔍 Match Query:', JSON.stringify(matchQuery, null, 2));

    // Get all transactions with the filter
    const transactions = await Transaction.find(matchQuery);

    console.log(`📊 Found ${transactions.length} transactions for analytics`);

    // ✅ FIXED: Manual counting with proper status mapping
    const statusMapping = {
      'SUCCESS': ['SUCCESS', 'Success', 'success'],
      'FAILED': ['FAILED', 'Failed', 'failed', 'FALLED'],
      'PENDING': ['PENDING', 'Pending', 'pending', 'GENERATED', 'INITIATED'],
      'REFUND': ['REFUND', 'Refund', 'refund', 'REFUNDED']
    };

    let analytics = {
      totalSuccessAmount: 0,
      totalFailedAmount: 0,
      totalPendingAmount: 0,
      totalRefundAmount: 0,
      totalSuccessOrders: 0,
      totalFailedOrders: 0,
      totalPendingOrders: 0,
      totalRefundOrders: 0,
      totalTransactions: transactions.length
    };

    // Manual counting for each transaction
    transactions.forEach(transaction => {
      const amount = Number(transaction.amount) || 0;
      const status = String(transaction.status).toUpperCase().trim();

      // Debug log for first few transactions
      if (analytics.totalTransactions < 5) {
        console.log(`🔍 Sample Transaction - Status: "${status}", Amount: ${amount}`);
      }

      // Map to unified status
      if (statusMapping.SUCCESS.includes(status)) {
        analytics.totalSuccessAmount += amount;
        analytics.totalSuccessOrders += 1;
      } else if (statusMapping.FAILED.includes(status)) {
        analytics.totalFailedAmount += amount;
        analytics.totalFailedOrders += 1;
      } else if (statusMapping.PENDING.includes(status)) {
        analytics.totalPendingAmount += amount;
        analytics.totalPendingOrders += 1;
      } else if (statusMapping.REFUND.includes(status)) {
        analytics.totalRefundAmount += amount;
        analytics.totalRefundOrders += 1;
      } else {
        console.log(`⚠️ Unknown status: ${status}`);
      }
    });

    console.log('✅ Final Analytics Result:', analytics);
    res.json(analytics);

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ✅ CORRECTED: Export checkTransaction function
export const checkTransaction = async (req, res) => {
  try {
    const { timeFilter, merchantId } = req.query;
    
    console.log('🟡 Checking transactions with:', { timeFilter, merchantId });
    
    const dateFilter = getDateRange(timeFilter);
    const merchantFilter = merchantId && merchantId !== 'all' 
      ? { merchantId: merchantId } 
      : {};

    const transactions = await Transaction.find({
      ...dateFilter,
      ...merchantFilter
    });

    console.log(`📊 Found ${transactions.length} transactions for status check`);

    // ✅ FIXED: Unified status aggregation
    const statusMapping = {
      'SUCCESS': ['SUCCESS', 'Success', 'success'],
      'FAILED': ['FAILED', 'Failed', 'failed', 'FALLED'],
      'PENDING': ['PENDING', 'Pending', 'pending', 'GENERATED', 'INITIATED'],
      'REFUND': ['REFUND', 'Refund', 'refund']
    };

    const result = {};

    transactions.forEach(transaction => {
      const amount = Number(transaction.amount) || 0;
      const status = String(transaction.status).toUpperCase();

      let unifiedStatus = 'OTHER';
      
      if (statusMapping.SUCCESS.includes(status)) unifiedStatus = 'SUCCESS';
      else if (statusMapping.FAILED.includes(status)) unifiedStatus = 'FAILED';
      else if (statusMapping.PENDING.includes(status)) unifiedStatus = 'PENDING';
      else if (statusMapping.REFUND.includes(status)) unifiedStatus = 'REFUND';

      if (!result[unifiedStatus]) {
        result[unifiedStatus] = {
          _id: unifiedStatus,
          count: 0,
          totalAmount: 0
        };
      }

      result[unifiedStatus].count += 1;
      result[unifiedStatus].totalAmount += amount;
    });

    // Convert to array and ensure all 4 statuses exist
    const finalResult = ['SUCCESS', 'FAILED', 'PENDING', 'REFUND'].map(status => ({
      _id: status,
      count: result[status]?.count || 0,
      totalAmount: result[status]?.totalAmount || 0
    }));

    console.log('✅ Unified Transaction Status:', finalResult);
    res.json(finalResult);

  } catch (error) {
    console.error('❌ Check transaction error:', error);
    res.status(500).json({ error: error.message });
  }
};
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
// Helper function to get date ranges - UPDATED WITH CUSTOM RANGE
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

// Get All Merchant Users for Filter
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
    
    // Merchant filter with ObjectId conversion
    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    // Date filter
    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter, startDate, endDate);
      matchQuery = { ...matchQuery, ...dateRange };
    }

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
          totalRefundAmount: {
            $sum: { 
              $cond: [{ $eq: ["$status", "REFUND"] }, "$amount", 0] 
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
          totalRefundOrders: {
            $sum: { 
              $cond: [{ $eq: ["$status", "REFUND"] }, 1, 0] 
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

// Get Transactions by Merchant - NEW ENDPOINT
// Get Transactions by Merchant - NEW ENDPOINT
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


// Enhanced Sale Report Data API for Line Chart
export const getSaleReportData = async (req, res) => {
  try {
    const { timeFilter = 'today', merchantId } = req.query;

    console.log('🟡 Fetching sale report data with:', { timeFilter, merchantId });

    let matchQuery = {
      status: { $in: ['Success', 'SUCCESS'] } // Only successful transactions
    };
    
    // Merchant filter
    if (merchantId && merchantId !== 'all') {
      matchQuery.merchantId = new mongoose.Types.ObjectId(merchantId);
    }

    // Date filter
    if (timeFilter !== 'all') {
      const dateRange = getDateRange(timeFilter);
      matchQuery = { ...matchQuery, ...dateRange };
    }

    console.log('🔍 Sale Report Match Query:', JSON.stringify(matchQuery, null, 2));

    let chartData;
    
    switch (timeFilter) {
      case 'today':
        chartData = await getHourlySalesData(matchQuery);
        break;
      case 'month':
        chartData = await getDailySalesData(matchQuery);
        break;
      case 'year':
        chartData = await getMonthlySalesData(matchQuery);
        break;
      default:
        chartData = await getDailySalesData(matchQuery);
    }

    // Get summary statistics
    const summary = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSalesAmount: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageTransactionValue: { $avg: '$amount' },
          maxTransaction: { $max: '$amount' },
          minTransaction: { $min: '$amount' }
        }
      }
    ]);

    // Get income vs cost data (for demo - you can modify based on your business logic)
    const incomeCostData = await getIncomeCostData(matchQuery, timeFilter);

    const result = {
      chartData: chartData || [],
      incomeCostData: incomeCostData || [],
      summary: summary.length > 0 ? summary[0] : {
        totalSalesAmount: 0,
        totalTransactions: 0,
        averageTransactionValue: 0,
        maxTransaction: 0,
        minTransaction: 0
      },
      timeFilter: timeFilter
    };

    console.log('✅ Enhanced sale report data fetched:', {
      dataPoints: result.chartData.length,
      totalSales: result.summary.totalSalesAmount
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error fetching sale report data:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

// Enhanced helper functions with better data structure
const getHourlySalesData = async (matchQuery) => {
  const salesData = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          hour: { $hour: '$createdAt' }
        },
        sales: { $sum: '$amount' },
        transactions: { $sum: 1 }
      }
    },
    { $sort: { '_id.hour': 1 } },
    {
      $project: {
        _id: 0,
        name: {
          $let: {
            vars: {
              hourStr: { $toString: '$_id.hour' }
            },
            in: {
              $concat: [
                { $cond: { if: { $lt: ['$_id.hour', 10] }, then: '0', else: '' } },
                '$_id.hour',
                ':00'
              ]
            }
          }
        },
        sales: 1,
        transactions: 1,
        hour: '$_id.hour'
      }
    }
  ]);

  // Fill missing hours
  return fillMissingHours(salesData);
};

const getDailySalesData = async (matchQuery) => {
  const salesData = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          day: { $dayOfMonth: '$createdAt' }
        },
        sales: { $sum: '$amount' },
        transactions: { $sum: 1 }
      }
    },
    { $sort: { '_id.day': 1 } },
    {
      $project: {
        _id: 0,
        name: { $concat: [ { $toString: '$_id.day' } ] },
        sales: 1,
        transactions: 1,
        day: '$_id.day'
      }
    }
  ]);

  return fillMissingDays(salesData);
};

const getMonthlySalesData = async (matchQuery) => {
  const salesData = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          month: { $month: '$createdAt' }
        },
        sales: { $sum: '$amount' },
        transactions: { $sum: 1 }
      }
    },
    { $sort: { '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        name: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id.month', 1] }, then: 'Jan' },
              { case: { $eq: ['$_id.month', 2] }, then: 'Feb' },
              { case: { $eq: ['$_id.month', 3] }, then: 'Mar' },
              { case: { $eq: ['$_id.month', 4] }, then: 'Apr' },
              { case: { $eq: ['$_id.month', 5] }, then: 'May' },
              { case: { $eq: ['$_id.month', 6] }, then: 'Jun' },
              { case: { $eq: ['$_id.month', 7] }, then: 'Jul' },
              { case: { $eq: ['$_id.month', 8] }, then: 'Aug' },
              { case: { $eq: ['$_id.month', 9] }, then: 'Sep' },
              { case: { $eq: ['$_id.month', 10] }, then: 'Oct' },
              { case: { $eq: ['$_id.month', 11] }, then: 'Nov' },
              { case: { $eq: ['$_id.month', 12] }, then: 'Dec' }
            ],
            default: 'Unknown'
          }
        },
        sales: 1,
        transactions: 1,
        month: '$_id.month'
      }
    }
  ]);

  return fillMissingMonths(salesData);
};

// Income vs Cost Data (Demo - adjust based on your business logic)
const getIncomeCostData = async (matchQuery, timeFilter) => {
  // For demo, we'll create sample data
  // In real scenario, you would calculate income and cost from your data
  const baseData = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    }
  ]);

  const totalIncome = baseData.length > 0 ? baseData[0].totalIncome : 0;
  
  // Demo cost calculation (30% of income as cost)
  const totalCost = totalIncome * 0.3;
  
  return {
    income: totalIncome,
    cost: totalCost,
    netProfit: totalIncome - totalCost
  };
};

// Fill missing data functions
const fillMissingHours = (data) => {
  const filledData = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = hour.toString().padStart(2, '0') + ':00';
    const existingData = data.find(item => item.hour === hour);
    
    filledData.push({
      name: hourStr,
      sales: existingData?.sales || 0,
      transactions: existingData?.transactions || 0,
      hour: hour
    });
  }
  return filledData;
};

const fillMissingDays = (data) => {
  const filledData = [];
  const daysInMonth = new Date().getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const existingData = data.find(item => item.day === day);
    
    filledData.push({
      name: day.toString(),
      sales: existingData?.sales || 0,
      transactions: existingData?.transactions || 0,
      day: day
    });
  }
  return filledData;
};

const fillMissingMonths = (data) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filledData = [];
  
  monthNames.forEach((monthName, index) => {
    const monthNumber = index + 1;
    const existingData = data.find(item => item.month === monthNumber);
    
    filledData.push({
      name: monthName,
      sales: existingData?.sales || 0,
      transactions: existingData?.transactions || 0,
      month: monthNumber
    });
  });
  
  return filledData;
};

// Debug endpoint तयार करा
export const debugSaleReport = async (req, res) => {
  try {
    const { timeFilter = 'today' } = req.query;
    
    console.log('🔍 DEBUG: Checking database state...');
    
    // 1. Total transactions count
    const totalTransactions = await Transaction.countDocuments();
    console.log('📊 Total transactions in database:', totalTransactions);
    
    // 2. Check if any successful transactions exist
    const successTransactions = await Transaction.countDocuments({ 
      status: { $in: ['Success', 'SUCCESS'] } 
    });
    console.log('✅ Successful transactions:', successTransactions);
    
    // 3. Sample transactions
    const sampleTransactions = await Transaction.find().limit(5);
    console.log('📝 Sample transactions:', sampleTransactions);
    
    // 4. Check date range
    const dateRange = getDateRange(timeFilter);
    console.log('📅 Date range for', timeFilter, ':', dateRange);
    
    // 5. Check query with date range
    const transactionsInRange = await Transaction.countDocuments({
      ...dateRange,
      status: { $in: ['Success', 'SUCCESS'] }
    });
    console.log('🎯 Transactions in date range:', transactionsInRange);
    
    res.status(200).json({
      totalTransactions,
      successTransactions,
      sampleTransactions,
      dateRange,
      transactionsInRange,
      message: 'Debug information collected'
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
};
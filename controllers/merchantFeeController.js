// controllers/merchantFeeController.js
import MerchantFee from '../models/MerchantFee.js';
import User from '../models/User.js';

// Create Merchant Fee
export const createMerchantFee = async (req, res) => {
  try {
    const { 
      merchantId, 
      amount, 
      feeType, 
      description, 
      currency = 'INR',
      status = 'PROCESSED',
      metadata = {}
    } = req.body;

    console.log('💰 Creating merchant fee:', { merchantId, amount, feeType });

    // Validate required fields
    if (!merchantId || !amount || !feeType || !description) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: merchantId, amount, feeType, description'
      });
    }

    // Validate merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Create merchant fee
    const merchantFee = new MerchantFee({
      merchantId,
      merchantName: merchant.name,
      merchantEmail: merchant.email,
      amount: parseFloat(amount),
      feeType,
      description,
      currency,
      status,
      metadata,
      processedBy: req.user?.name || 'Admin'
    });

    await merchantFee.save();

    console.log('✅ Merchant fee created successfully:', merchantFee._id);

    res.status(201).json({
      success: true,
      message: 'Merchant fee created successfully',
      data: merchantFee
    });

  } catch (error) {
    console.error('❌ Error creating merchant fee:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating merchant fee',
      error: error.message
    });
  }
};

// Get Merchant Fee History
export const getMerchantFeeHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      startDate, 
      endDate, 
      feeType, 
      status,
      merchantId 
    } = req.query;

    console.log('📊 Fetching merchant fee history with filters:', { 
      search, startDate, endDate, feeType, status, merchantId 
    });

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { merchantName: { $regex: search, $options: 'i' } },
        { merchantEmail: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { transactionReference: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.appliedDate = {};
      if (startDate) query.appliedDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.appliedDate.$lte = end;
      }
    }

    // Fee type filter
    if (feeType) {
      query.feeType = feeType;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Merchant filter
    if (merchantId) {
      query.merchantId = merchantId;
    }

    const fees = await MerchantFee.find(query)
      .populate('merchantId', 'name email companyName')
      .sort({ appliedDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MerchantFee.countDocuments(query);

    // Calculate summary statistics
    const totalAmount = await MerchantFee.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const feeTypeSummary = await MerchantFee.aggregate([
      { $match: query },
      { $group: { _id: '$feeType', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: fees,
      summary: {
        totalAmount: totalAmount[0]?.total || 0,
        totalFees: total,
        feeTypeSummary
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching merchant fee history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching merchant fee history',
      error: error.message
    });
  }
};

// Get Merchant Fee by ID
export const getMerchantFeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const fee = await MerchantFee.findById(id)
      .populate('merchantId', 'name email companyName phone address');

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Merchant fee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: fee
    });
  } catch (error) {
    console.error('❌ Error fetching merchant fee:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching merchant fee',
      error: error.message
    });
  }
};

// Update Merchant Fee
export const updateMerchantFee = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const fee = await MerchantFee.findById(id);
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Merchant fee not found'
      });
    }

    // Update fee
    Object.assign(fee, updateData);
    await fee.save();

    res.status(200).json({
      success: true,
      message: 'Merchant fee updated successfully',
      data: fee
    });
  } catch (error) {
    console.error('❌ Error updating merchant fee:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating merchant fee',
      error: error.message
    });
  }
};

// Delete Merchant Fee
export const deleteMerchantFee = async (req, res) => {
  try {
    const { id } = req.params;

    const fee = await MerchantFee.findById(id);
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Merchant fee not found'
      });
    }

    await MerchantFee.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Merchant fee deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting merchant fee:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting merchant fee',
      error: error.message
    });
  }
};

// Get merchants list for dropdown
export const getMerchantsList = async (req, res) => {
  try {
    const merchants = await User.find({ 
      role: 'merchant',
      status: 'active'
    }).select('name email companyName');

    res.status(200).json({
      success: true,
      data: merchants
    });
  } catch (error) {
    console.error('❌ Error fetching merchants list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching merchants list',
      error: error.message
    });
  }
};

// Get fee statistics
export const getFeeStatistics = async (req, res) => {
  try {
    const { period = 'month' } = req.query; // day, week, month, year
    
    let groupFormat;
    switch (period) {
      case 'day':
        groupFormat = { day: { $dayOfMonth: '$appliedDate' }, month: { $month: '$appliedDate' }, year: { $year: '$appliedDate' } };
        break;
      case 'week':
        groupFormat = { week: { $week: '$appliedDate' }, year: { $year: '$appliedDate' } };
        break;
      case 'year':
        groupFormat = { year: { $year: '$appliedDate' } };
        break;
      default:
        groupFormat = { month: { $month: '$appliedDate' }, year: { $year: '$appliedDate' } };
    }

    const statistics = await MerchantFee.aggregate([
      {
        $group: {
          _id: groupFormat,
          totalAmount: { $sum: '$amount' },
          totalFees: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1, '_id.day': -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('❌ Error fetching fee statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fee statistics',
      error: error.message
    });
  }
};
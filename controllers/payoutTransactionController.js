import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import Connector from '../models/Connector.js';
import mongoose from 'mongoose';

// Utility for generating UTR
const generateUtr = () => `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`;

// --- Payout to Merchant ---
export const createPayoutToMerchant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
      paymentMode,
      amount,
      customerEmail,
      customerPhoneNumber,
      remark,
      responseUrl,
    } = req.body;

    console.log('📦 Creating payout to merchant with data:', req.body);

    // Validate required fields
    if (!merchantId || !amount || !bankName || !accountNumber || !ifscCode || !accountHolderName) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Missing required fields: merchantId, amount, bankName, accountNumber, ifscCode, accountHolderName" 
      });
    }

    // Validate initiating merchant
    const initiatingMerchant = await User.findById(merchantId).session(session);
    if (!initiatingMerchant || initiatingMerchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Initiating merchant not found." 
      });
    }
    
    // Check balance
    const payoutAmount = parseFloat(amount);
    if (initiatingMerchant.balance < payoutAmount) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: `Insufficient balance. Available: ₹${initiatingMerchant.balance}, Required: ₹${payoutAmount}` 
      });
    }

    console.log(`💰 Merchant balance: ${initiatingMerchant.balance}, Payout amount: ${payoutAmount}`);

    // Deduct amount from initiating merchant's balance
    initiatingMerchant.balance -= payoutAmount;
    await initiatingMerchant.save({ session });

    // Create Payout Transaction
    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName: initiatingMerchant.company || `${initiatingMerchant.firstname} ${initiatingMerchant.lastname}`,
      recipientBankName: bankName,
      recipientAccountNumber: accountNumber,
      recipientIfscCode: ifscCode,
      recipientAccountHolderName: accountHolderName,
      recipientAccountType: accountType || 'Saving',
      amount: payoutAmount,
      currency: 'INR',
      paymentMode: paymentMode || 'IMPS',
      transactionType: 'Debit',
      status: 'Success',
      customerEmail,
      customerPhoneNumber,
      remark,
      responseUrl,
      utr: generateUtr(),
    });
    
    const savedPayout = await newPayout.save({ session });
    await session.commitTransaction();
    
    console.log('✅ Payout created successfully:', savedPayout._id);
    
    res.status(201).json({
      success: true,
      message: "Payout initiated successfully",
      payoutTransaction: savedPayout,
      newBalance: initiatingMerchant.balance
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error creating payout to merchant:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during payout creation.",
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// --- Get Payout Transactions ---
export const getPayoutTransactions = async (req, res) => {
  try {
    const { 
      merchantId, 
      status, 
      paymentMode, 
      transactionType, 
      startDate, 
      endDate, 
      utr,
      page = 1,
      limit = 10
    } = req.query;

    console.log('📥 Fetching payout transactions with query:', req.query);

    let query = {};
    
    // Build query based on filters
    if (merchantId && merchantId !== 'undefined') {
      query.merchantId = merchantId;
    }
    if (status && status !== 'undefined') query.status = status;
    if (paymentMode && paymentMode !== 'undefined') query.paymentMode = paymentMode;
    if (transactionType && transactionType !== 'undefined') query.transactionType = transactionType;
    if (utr && utr !== 'undefined') query.utr = { $regex: utr, $options: 'i' };

    // Date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    console.log('🔍 Final query:', query);

    const skip = (page - 1) * limit;
    
    // Fetch transactions with population
    const payouts = await PayoutTransaction.find(query)
      .populate('merchantId', 'company firstname lastname email')
      .populate('recipientMerchantId', 'company firstname lastname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PayoutTransaction.countDocuments(query);

    console.log(`✅ Found ${payouts.length} payout transactions`);

    res.status(200).json({
      success: true,
      data: payouts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("❌ Error fetching payout transactions:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching payout transactions.",
      error: error.message 
    });
  }
};

// --- Create Internal Payout Transaction ---
export const createInternalPayoutTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId,
      transactionType,
      amount,
      remark,
      applyFee = false,
    } = req.body;

    console.log('📦 Creating internal payout with data:', req.body);

    const merchant = await User.findById(merchantId).session(session);
    if (!merchant || merchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found." 
      });
    }

    const finalAmount = parseFloat(amount);

    if (transactionType === 'Debit') {
      if (merchant.balance < finalAmount) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false,
          message: "Insufficient balance." 
        });
      }
      merchant.balance -= finalAmount;
    } else if (transactionType === 'Credit') {
      merchant.balance += finalAmount;
    } else {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Invalid transaction type." 
      });
    }

    await merchant.save({ session });

    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      amount: finalAmount,
      applyFee: applyFee,
      transactionType,
      paymentMode: 'Wallet Transfer',
      status: 'Success',
      remark,
      utr: generateUtr(),
    });
    
    const savedPayout = await newPayout.save({ session });
    await session.commitTransaction();

    console.log('✅ Internal payout created:', savedPayout._id);
    
    res.status(201).json({
      success: true,
      message: `Balance ${transactionType === 'Debit' ? 'debited' : 'credited'} successfully.`,
      newBalance: merchant.balance,
      payoutTransaction: savedPayout,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error creating internal payout:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during transaction." 
    });
  } finally {
    session.endSession();
  }
};

// --- Get single Payout Transaction by ID ---
export const getPayoutTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await PayoutTransaction.findById(id)
      .populate('merchantId', 'company firstname lastname email')
      .populate('recipientMerchantId', 'company firstname lastname email');

    if (!payout) {
      return res.status(404).json({ 
        success: false,
        message: "Payout transaction not found." 
      });
    }
    
    res.status(200).json({
      success: true,
      data: payout
    });

  } catch (error) {
    console.error("Error fetching payout transaction:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching payout transaction." 
    });
  }
};

// --- Get Merchant Bank Details ---
export const getMerchantBankDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await User.findById(merchantId).select('bankDetails company firstname lastname');

    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found." 
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        bankDetails: merchant.bankDetails,
        merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`
      }
    });

  } catch (error) {
    console.error("Error fetching bank details:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching bank details." 
    });
  }
};

// --- Fetch all Merchants ---
export const getAllMerchantsForPayout = async (req, res) => {
  try {
    console.log('🔄 getAllMerchantsForPayout function called');
    
    // Database connection check
    console.log('📊 MongoDB connection state:', mongoose.connection.readyState);
    console.log('🏪 Database name:', mongoose.connection.name);

    // First, let's see ALL users in database
    const allUsers = await User.find({}).select('_id firstname lastname role status email').lean();
    console.log('👥 TOTAL USERS IN DATABASE:', allUsers.length);
    console.log('📋 All users:', JSON.stringify(allUsers, null, 2));

    // Now find only merchants
    const merchants = await User.find({ 
      role: 'merchant',
      status: 'Active'
    })
    .select('_id firstname lastname company email contact balance bankDetails mid')
    .lean();

    console.log('✅ MERCHANTS FOUND:', merchants.length);
    console.log('📋 Merchant details:', JSON.stringify(merchants, null, 2));

    if (merchants.length === 0) {
      console.log('⚠️ No active merchants found with role="merchant"');
      
      // Check if there are users with merchant role but different status
      const allMerchantsAnyStatus = await User.find({ role: 'merchant' })
        .select('_id firstname lastname role status')
        .lean();
      console.log('🔍 All merchants (any status):', allMerchantsAnyStatus);
    }

    res.status(200).json({
      success: true,
      data: merchants,
      total: merchants.length,
      message: `Found ${merchants.length} active merchants`
    });

  } catch (error) {
    console.error('❌ ERROR in getAllMerchantsForPayout:', error);
    res.status(500).json({ 
      success: false,
      message: "Database error",
      error: error.message
    });
  }
};

// --- Fetch Payout Supported Connectors ---
export const getPayoutSupportedConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({ isPayoutSupport: true, status: 'Active' })
      .select('_id name');
    
    res.status(200).json({
      success: true,
      data: connectors
    });
  } catch (error) {
    console.error("Error fetching connectors:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching connectors." 
    });
  }
};
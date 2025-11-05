import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import Connector from '../models/Connector.js';
import mongoose from 'mongoose';

// Utility for generating UTR
const generateUtr = () => `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`;

// --- Payout to Merchant (Admin Initiated to another Merchant) ---
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

    // 1. Validate initiating merchant and their balance
    const initiatingMerchant = await User.findById(merchantId).session(session);
    if (!initiatingMerchant || initiatingMerchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Initiating merchant not found or not a merchant." 
      });
    }
    
    if (initiatingMerchant.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Insufficient balance for payout." 
      });
    }

    // 2. Deduct amount from initiating merchant's balance
    initiatingMerchant.balance -= parseFloat(amount);
    await initiatingMerchant.save({ session });

    // 3. Create Payout Transaction record
    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName: initiatingMerchant.company || `${initiatingMerchant.firstname} ${initiatingMerchant.lastname}`,
      recipientBankName: bankName,
      recipientAccountNumber: accountNumber,
      recipientIfscCode: ifscCode,
      recipientAccountHolderName: accountHolderName,
      recipientAccountType: accountType,
      amount: parseFloat(amount),
      currency: 'INR',
      paymentMode,
      transactionType: 'Debit',
      status: 'Success',
      customerEmail,
      customerPhoneNumber,
      remark,
      responseUrl,
      utr: generateUtr(),
    });
    
    await newPayout.save({ session });
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: "Payout initiated successfully",
      payoutTransaction: newPayout,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating payout to merchant:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during payout creation." 
    });
  } finally {
    session.endSession();
  }
};

// --- Create Internal Payout Transaction (Debit/Credit for a merchant's balance) ---
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
      feeAmount = 0,
    } = req.body;

    const merchant = await User.findById(merchantId).session(session);
    if (!merchant || merchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found or not a merchant." 
      });
    }

    let finalAmount = parseFloat(amount);
    let finalFeeAmount = parseFloat(feeAmount);

    if (applyFee && finalFeeAmount > 0) {
      if (transactionType === 'Debit') {
        finalAmount += finalFeeAmount;
      } else {
        finalAmount -= finalFeeAmount;
        if (finalAmount < 0) {
          await session.abortTransaction();
          return res.status(400).json({ 
            success: false,
            message: "Credit amount cannot be negative after fee deduction." 
          });
        }
      }
    }

    if (transactionType === 'Debit') {
      if (merchant.balance < finalAmount) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false,
          message: "Insufficient balance for this debit transaction." 
        });
      }
      merchant.balance -= finalAmount;
    } else if (transactionType === 'Credit') {
      merchant.balance += finalAmount;
    } else {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: "Invalid transaction type. Must be 'Debit' or 'Credit'." 
      });
    }

    await merchant.save({ session });

    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      amount: parseFloat(amount),
      feeAmount: applyFee ? finalFeeAmount : 0,
      applyFee: applyFee,
      transactionType,
      paymentMode: 'Wallet Transfer',
      status: 'Success',
      remark,
      utr: generateUtr(),
    });
    
    await newPayout.save({ session });
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: `Merchant balance ${transactionType === 'Debit' ? 'debited' : 'credited'} successfully.`,
      newBalance: merchant.balance,
      payoutTransaction: newPayout,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating internal payout transaction:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during internal payout transaction." 
    });
  } finally {
    session.endSession();
  }
};

// --- Get Payout Transactions for a Merchant or Admin ---
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
      connectorId,
      page = 1,
      limit = 10
    } = req.query;

    let query = {};
    if (merchantId) query.merchantId = merchantId;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;
    if (transactionType) query.transactionType = transactionType;
    if (utr) query.utr = { $regex: utr, $options: 'i' };
    if (connectorId) query.connectorId = connectorId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const payouts = await PayoutTransaction.find(query)
      .populate('merchantId', 'company firstname lastname')
      .populate('recipientMerchantId', 'company firstname lastname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PayoutTransaction.countDocuments(query);

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
    console.error("Error fetching payout transactions:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching payout transactions." 
    });
  }
};

// --- Get a single Payout Transaction by ID ---
export const getPayoutTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await PayoutTransaction.findById(id)
      .populate('merchantId', 'company firstname lastname')
      .populate('recipientMerchantId', 'company firstname lastname');

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
    console.error("Error fetching payout transaction by ID:", error);
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
    console.error("Error fetching merchant bank details:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching merchant bank details." 
    });
  }
};

// --- Update Merchant Bank Details ---
export const updateMerchantBankDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { bankName, accountNumber, ifscCode, accountHolderName, accountType } = req.body;

    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found or not a merchant." 
      });
    }

    merchant.bankDetails = {
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
    };
    
    await merchant.save();
    
    res.status(200).json({ 
      success: true,
      message: "Merchant bank details updated successfully.", 
      data: merchant.bankDetails 
    });

  } catch (error) {
    console.error("Error updating merchant bank details:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error updating merchant bank details." 
    });
  }
};

// --- Fetch all Merchants ---
export const getAllMerchantsForPayout = async (req, res) => {
  try {
    const merchants = await User.find({ role: 'merchant', status: 'Active' })
      .select('_id company firstname lastname mid balance bankDetails');
    
    res.status(200).json({
      success: true,
      data: merchants
    });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching merchants." 
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
    console.error("Error fetching payout supported connectors:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error fetching payout supported connectors." 
    });
  }
};
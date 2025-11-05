// backend/controllers/payoutController.js
import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import Connector from '../models/Connector.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import mongoose from 'mongoose';

// Utility for generating UTR (placeholder for now)
const generateUtr = () => `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`;

// --- Payout to Merchant (Admin Initiated to another Merchant) ---
export const createPayoutToMerchant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      merchantId, // This is the ID of the merchant INITIATING or requesting the payout (source of funds)
      recipientMerchantId, // The merchant receiving the payout (destination)
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
      webhookUrl,
    } = req.body;

    // 1. Validate initiating merchant and their balance
    const initiatingMerchant = await User.findById(merchantId).session(session);
    if (!initiatingMerchant || initiatingMerchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ message: "Initiating merchant not found or not a merchant." });
    }
    if (initiatingMerchant.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient balance for payout." });
    }

    // 2. Validate recipient merchant if internal
    let recipientUser = null;
    if (recipientMerchantId) {
      recipientUser = await User.findById(recipientMerchantId).session(session);
      if (!recipientUser || recipientUser.role !== 'merchant') {
        await session.abortTransaction();
        return res.status(404).json({ message: "Recipient merchant not found or not a merchant." });
      }
      // If recipient is an internal merchant, use their stored bank details if not provided
      if (!bankName && recipientUser.bankDetails?.bankName) {
        // Use recipientUser's stored bank details
      }
    }

    // 3. Deduct amount from initiating merchant's balance
    initiatingMerchant.balance -= amount;
    await initiatingMerchant.save({ session });

    // 4. Create Payout Transaction record
    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName: initiatingMerchant.company || `${initiatingMerchant.firstname} ${initiatingMerchant.lastname}`,
      recipientMerchantId,
      recipientBankName: bankName,
      recipientAccountNumber: accountNumber,
      recipientIfscCode: ifscCode,
      recipientAccountHolderName: accountHolderName,
      recipientAccountType: accountType,
      amount,
      currency: 'INR', // Assuming INR for now
      paymentMode,
      transactionType: 'Debit', // This is a debit from the initiating merchant's perspective
      status: 'Initiated', // Will be 'Success' or 'Failed' after external processing
      customerEmail,
      customerPhoneNumber,
      remark,
      responseUrl,
      webhookUrl,
      utr: generateUtr(), // Placeholder UTR
    });
    await newPayout.save({ session });

    // 5. Simulate external payout process (or integrate with actual connector here)
    // For now, let's simulate success after a delay.
    // In a real system, you'd call a connector API.
    // The connector would return a status and potentially a real UTR.

    // Simulate success after some processing (e.g., webhook callback)
    // For now, directly setting to Success. In reality, this would be async.
    newPayout.status = 'Success';
    await newPayout.save({ session });

    await session.commitTransaction();
    res.status(201).json({
      message: "Payout initiated successfully. Status will be updated.",
      payoutTransaction: newPayout,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating payout to merchant:", error);
    res.status(500).json({ message: "Server error during payout creation." });
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
      transactionType, // 'Debit' or 'Credit'
      amount,
      remark,
      applyFee = false,
      feeAmount = 0,
    } = req.body;

    const merchant = await User.findById(merchantId).session(session);
    if (!merchant || merchant.role !== 'merchant') {
      await session.abortTransaction();
      return res.status(404).json({ message: "Merchant not found or not a merchant." });
    }

    let finalAmount = parseFloat(amount);
    let finalFeeAmount = parseFloat(feeAmount);

    if (applyFee && finalFeeAmount > 0) {
        // If it's a debit and fee is applied, total deduction is amount + fee
        // If it's a credit and fee is applied, total credit is amount - fee
        if (transactionType === 'Debit') {
            finalAmount += finalFeeAmount;
        } else { // Credit
            finalAmount -= finalFeeAmount;
            if (finalAmount < 0) {
                await session.abortTransaction();
                return res.status(400).json({ message: "Credit amount cannot be negative after fee deduction." });
            }
        }
    }


    if (transactionType === 'Debit') {
      if (merchant.balance < finalAmount) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Insufficient balance for this debit transaction." });
      }
      merchant.balance -= finalAmount;
    } else if (transactionType === 'Credit') {
      merchant.balance += finalAmount;
    } else {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid transaction type. Must be 'Debit' or 'Credit'." });
    }

    await merchant.save({ session });

    const newPayout = new PayoutTransaction({
      merchantId,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      amount: parseFloat(amount), // Store original amount, fee is separate
      feeAmount: applyFee ? finalFeeAmount : 0,
      applyFee: applyFee,
      transactionType,
      paymentMode: 'Wallet Transfer', // Internal transfer
      status: 'Success', // Internal transactions are usually instant success
      remark,
      utr: generateUtr(), // Still generate a UTR for internal tracking
    });
    await newPayout.save({ session });

    await session.commitTransaction();
    res.status(201).json({
      message: `Merchant balance ${transactionType === 'Debit' ? 'debited' : 'credited'} successfully.`,
      newBalance: merchant.balance,
      payoutTransaction: newPayout,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating internal payout transaction:", error);
    res.status(500).json({ message: "Server error during internal payout transaction." });
  } finally {
    session.endSession();
  }
};

// --- Get Payout Transactions for a Merchant or Admin ---
export const getPayoutTransactions = async (req, res) => {
  try {
    const { merchantId, status, paymentMode, transactionType, startDate, endDate, utr, connectorId } = req.query;

    let query = {};
    // If an admin is fetching, they might specify merchantId.
    // If a merchant is fetching, their ID will be passed directly.
    if (merchantId) query.merchantId = merchantId;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;
    if (transactionType) query.transactionType = transactionType;
    if (utr) query.utr = utr;
    if (connectorId) query.connectorId = connectorId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payouts = await PayoutTransaction.find(query)
      .populate('merchantId', 'company firstname lastname') // Populate merchant details
      .populate('recipientMerchantId', 'company firstname lastname') // Populate recipient merchant details
      .sort({ createdAt: -1 });

    res.status(200).json(payouts);
  } catch (error) {
    console.error("Error fetching payout transactions:", error);
    res.status(500).json({ message: "Server error fetching payout transactions." });
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
      return res.status(404).json({ message: "Payout transaction not found." });
    }
    res.status(200).json(payout);
  } catch (error) {
    console.error("Error fetching payout transaction by ID:", error);
    res.status(500).json({ message: "Server error fetching payout transaction." });
  }
};

// --- Get Merchant Bank Details (for Payout to Merchant form pre-fill) ---
export const getMerchantBankDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await User.findById(merchantId).select('bankDetails company firstname lastname');

    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ message: "Merchant not found." });
    }
    res.status(200).json({
      bankDetails: merchant.bankDetails,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`
    });
  } catch (error) {
    console.error("Error fetching merchant bank details:", error);
    res.status(500).json({ message: "Server error fetching merchant bank details." });
  }
};

// --- Update Merchant Bank Details (for their own profile) ---
export const updateMerchantBankDetails = async (req, res) => {
  try {
    const { merchantId } = req.params; // The merchant whose bank details are being updated
    const { bankName, accountNumber, ifscCode, accountHolderName, accountType } = req.body;

    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ message: "Merchant not found or not a merchant." });
    }

    merchant.bankDetails = {
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
    };
    await merchant.save();

    res.status(200).json({ message: "Merchant bank details updated successfully.", bankDetails: merchant.bankDetails });
  } catch (error) {
    console.error("Error updating merchant bank details:", error);
    res.status(500).json({ message: "Server error updating merchant bank details." });
  }
};

// --- Fetch all Merchants (for dropdowns) ---
export const getAllMerchantsForPayout = async (req, res) => {
    try {
        const merchants = await User.find({ role: 'merchant', status: 'Active' })
                                  .select('_id company firstname lastname mid balance');
        res.status(200).json(merchants);
    } catch (error) {
        console.error("Error fetching merchants:", error);
        res.status(500).json({ message: "Server error fetching merchants." });
    }
};

// --- Fetch Payout Supported Connectors ---
export const getPayoutSupportedConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({ isPayoutSupport: true, status: 'Active' }).select('_id name');
    res.status(200).json(connectors);
  } catch (error) {
    console.error("Error fetching payout supported connectors:", error);
    res.status(500).json({ message: "Server error fetching payout supported connectors." });
  }
};
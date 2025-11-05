import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import Connector from '../models/Connector.js';
import csv from 'csv-express';

const generateUniqueId = (prefix) => {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export const getPayoutTransactions = async (req, res) => {
  try {
    const {
      merchant, connector, status, utr, accountNumber,
      transactionId, orderId, startDate, endDate, type,
      limit = 10, page = 1
    } = req.query;

    const query = {};

    if (merchant) query.merchantId = merchant;
    if (connector) query.connector = connector;
    if (status) query.status = status;
    if (utr) query.utr = { $regex: utr, $options: 'i' };
    if (accountNumber) query.accountNumber = { $regex: accountNumber, $options: 'i' };
    if (transactionId) query.transactionId = { $regex: transactionId, $options: 'i' };
    if (orderId) query.orderId = { $regex: orderId, $options: 'i' };
    if (type) query.type = type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const options = {
      limit: parseInt(limit, 10),
      skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      sort: { createdAt: -1 },
    };

    const transactions = await PayoutTransaction.find(query, null, options)
      .populate('merchantId', 'company email')
      .lean();
      
    const totalTransactions = await PayoutTransaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(totalTransactions / limit),
      totalTransactions,
    });
  } catch (error) {
    console.error("Error fetching payout transactions:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getMerchantList = async (req, res) => {
  try {
    const merchants = await User.find({ role: 'merchant', status: 'Active' }, '_id company email balance').lean();
    const formattedMerchants = merchants.map(m => ({
      _id: m._id,
      name: m.company || m.email,
      balance: m.balance || 0,
      email: m.email
    }));
    res.status(200).json({ success: true, data: formattedMerchants });
  } catch (error) {
    console.error("Error fetching merchants list:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getConnectorList = async (req, res) => {
  try {
    const connectors = await Connector.find({ isPayoutSupport: true, status: 'Active' }, '_id name').lean();
    res.status(200).json({ success: true, data: connectors });
  } catch (error) {
    console.error("Error fetching connectors list:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const createPayoutTransaction = async (req, res) => {
  const {
    merchantId, amount, accountNumber, connector, paymentMode, type,
    transactionType, remark, feeApplied, feeAmount
  } = req.body;

  try {
    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ success: false, message: "Merchant not found or not a valid merchant." });
    }

    const connectorConfig = await Connector.findOne({ name: connector, isPayoutSupport: true, status: 'Active' });
    if (!connectorConfig) {
      return res.status(404).json({ success: false, message: "Connector not found or does not support payouts." });
    }

    const finalAmount = parseFloat(amount);
    const finalFeeAmount = feeApplied ? parseFloat(feeAmount) : 0;
    const netAmount = finalAmount - finalFeeAmount;

    if (isNaN(finalAmount) || finalAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount. Amount must be a positive number." });
    }
    if (feeApplied && (isNaN(finalFeeAmount) || finalFeeAmount < 0)) {
        return res.status(400).json({ success: false, message: "Invalid fee amount. Fee must be a non-negative number." });
    }
    if (netAmount < 0) {
        return res.status(400).json({ success: false, message: "Net amount cannot be negative. Adjust amount or fee." });
    }

    if (transactionType === 'Debit' && merchant.balance < finalAmount) {
      return res.status(400).json({ success: false, message: `Insufficient merchant balance. Current balance: ₹${merchant.balance.toFixed(2)}` });
    }

    const utr = generateUniqueId('UTR');
    const transactionId = generateUniqueId('TXN');
    const orderId = generateUniqueId('ORD');

    const newPayoutTransaction = new PayoutTransaction({
      merchantId,
      merchantName: merchant.company || merchant.email,
      amount: finalAmount,
      accountNumber,
      connector,
      paymentMode,
      type: type || "Manual",
      transactionType,
      remark,
      feeApplied,
      feeAmount: finalFeeAmount,
      netAmount,
      utr,
      transactionId,
      orderId,
      status: "Pending",
    });

    await newPayoutTransaction.save();

    if (transactionType === 'Debit') {
      merchant.balance -= finalAmount;
    } else {
      merchant.balance += finalAmount;
    }
    await merchant.save();

    res.status(201).json({ 
      success: true, 
      message: `${transactionType} payout transaction created successfully.`, 
      data: newPayoutTransaction 
    });
  } catch (error) {
    console.error("Error creating payout transaction:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getMerchantTransactionsSummary = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const transactions = await PayoutTransaction.find({ merchantId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const totalDebit = transactions.filter(t => t.transactionType === 'Debit').reduce((sum, t) => sum + t.amount, 0);
    const totalCredit = transactions.filter(t => t.transactionType === 'Credit').reduce((sum, t) => sum + t.amount, 0);

    const summary = {
      totalTransactions: transactions.length,
      totalDebit,
      totalCredit,
    };

    res.status(200).json({ success: true, data: { transactions, summary } });
  } catch (error) {
    console.error("Error fetching merchant transactions:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const exportPayoutTransactions = async (req, res) => {
  try {
    const {
      merchant, connector, status, utr, accountNumber,
      transactionId, orderId, startDate, endDate, type,
    } = req.query;

    const query = {};

    if (merchant) query.merchantId = merchant;
    if (connector) query.connector = connector;
    if (status) query.status = status;
    if (utr) query.utr = { $regex: utr, $options: 'i' };
    if (accountNumber) query.accountNumber = { $regex: accountNumber, $options: 'i' };
    if (transactionId) query.transactionId = { $regex: transactionId, $options: 'i' };
    if (orderId) query.orderId = { $regex: orderId, $options: 'i' };
    if (type) query.type = type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const transactions = await PayoutTransaction.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const csvData = transactions.map(t => ({
      'Transaction ID': t.transactionId,
      'Order ID': t.orderId,
      'UTR': t.utr,
      'Status': t.status,
      'Merchant Name': t.merchantName,
      'Account Number': t.accountNumber,
      'Connector': t.connector,
      'Amount (INR)': t.amount,
      'Payment Mode': t.paymentMode,
      'Type': t.type,
      'Transaction Type': t.transactionType,
      'Fee Applied': t.feeApplied ? 'Yes' : 'No',
      'Fee Amount': t.feeAmount,
      'Net Amount': t.netAmount,
      'Remark': t.remark,
      'Webhook Status': t.webhook,
      'Created At': new Date(t.createdAt).toLocaleString(),
    }));

    res.csv(csvData, true, { 
      'Content-Disposition': `attachment; filename="payouts_${new Date().toISOString().split('T')[0]}.csv"` 
    });

  } catch (error) {
    console.error("Error exporting payout transactions:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updatePayoutTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Success", "Pending", "Failed", "Processing", "Refund"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status provided." });
    }

    const transaction = await PayoutTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    transaction.status = status;
    await transaction.save();

    res.status(200).json({ success: true, message: "Transaction status updated successfully.", data: transaction });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
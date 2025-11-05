import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import Connector from '../models/Connector.js';

// Helper function to generate unique IDs
const generateUniqueId = (prefix) => {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
};

// @desc    Get all payout transactions
// @route   GET /api/payout-transactions
export const getPayoutTransactions = async (req, res) => {
  try {
    console.log("🔍 Fetching payout transactions...");
    
    const {
      merchant, connector, status, utr, accountNumber,
      transactionId, orderId, startDate, endDate, type,
      limit = 10, page = 1
    } = req.query;

    const query = {};

    if (merchant && merchant !== '') query.merchantId = merchant;
    if (connector && connector !== '') query.connector = connector;
    if (status && status !== '') query.status = status;
    if (utr && utr !== '') query.utr = { $regex: utr, $options: 'i' };
    if (accountNumber && accountNumber !== '') query.accountNumber = { $regex: accountNumber, $options: 'i' };
    if (transactionId && transactionId !== '') query.transactionId = { $regex: transactionId, $options: 'i' };
    if (orderId && orderId !== '') query.orderId = { $regex: orderId, $options: 'i' };
    if (type && type !== '') query.type = type;

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
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 },
    };

    const transactions = await PayoutTransaction.find(query)
      .populate('merchantId', 'firstname lastname company email balance')
      .lean();

    const totalTransactions = await PayoutTransaction.countDocuments(query);

    console.log(`✅ Found ${transactions.length} transactions`);

    res.status(200).json({
      success: true,
      data: transactions,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTransactions / limit),
      totalTransactions,
    });
  } catch (error) {
    console.error("❌ Error fetching payout transactions:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// @desc    Get merchants list
// @route   GET /api/payout-transactions/merchants/list
export const getMerchantList = async (req, res) => {
  try {
    console.log("🔍 Fetching merchants list...");
    
    // Check database connection
    const dbState = mongoose.connection.readyState;
    console.log(`📊 Database connection state: ${dbState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
    
    const merchants = await User.find({ 
      role: 'merchant', 
      status: 'Active' 
    }).select('_id firstname lastname company email balance contact mid').lean();

    console.log(`✅ Found ${merchants.length} merchants in database`);

    const formattedMerchants = merchants.map(merchant => {
      const merchantName = merchant.company || 
                          `${merchant.firstname || ''} ${merchant.lastname || ''}`.trim() || 
                          merchant.email;
      
      return {
        _id: merchant._id,
        name: merchantName,
        email: merchant.email,
        balance: merchant.balance || 0,
        company: merchant.company,
        firstname: merchant.firstname,
        lastname: merchant.lastname,
        contact: merchant.contact,
        mid: merchant.mid
      };
    });

    res.status(200).json({ 
      success: true, 
      data: formattedMerchants,
      message: `Found ${formattedMerchants.length} merchants`
    });
  } catch (error) {
    console.error("❌ Error fetching merchants list:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get connectors list
// @route   GET /api/payout-transactions/connectors/list
export const getConnectorList = async (req, res) => {
  try {
    console.log("🔍 Fetching connectors list...");
    
    const connectors = await Connector.find({ 
      isPayoutSupport: true, 
      status: 'Active' 
    }).select('_id name connectorType payoutModes minPayoutAmount maxPayoutAmount').lean();

    console.log(`✅ Found ${connectors.length} connectors with payout support`);

    res.status(200).json({ 
      success: true, 
      data: connectors,
      message: `Found ${connectors.length} connectors`
    });
  } catch (error) {
    console.error("❌ Error fetching connectors list:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// @desc    Create payout transaction
// @route   POST /api/payout-transactions
export const createPayoutTransaction = async (req, res) => {
  try {
    console.log("💰 Creating payout transaction:", req.body);
    
    const {
      merchantId, amount, accountNumber, connector, paymentMode, type,
      transactionType, remark, feeApplied, feeAmount
    } = req.body;

    // Validate required fields
    if (!merchantId || !amount || !accountNumber || !connector) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: merchantId, amount, accountNumber, connector"
      });
    }

    // Find merchant
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    console.log(`📊 Merchant found: ${merchant.company || merchant.firstname}`);

    // Validate connector
    const connectorConfig = await Connector.findOne({ 
      name: connector, 
      isPayoutSupport: true, 
      status: 'Active' 
    });
    
    if (!connectorConfig) {
      return res.status(404).json({
        success: false,
        message: "Connector not found or does not support payouts"
      });
    }

    // Validate amount
    const finalAmount = parseFloat(amount);
    const finalFeeAmount = feeApplied ? parseFloat(feeAmount || 0) : 0;
    const netAmount = finalAmount - finalFeeAmount;

    if (isNaN(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Amount must be a positive number."
      });
    }

    if (feeApplied && (isNaN(finalFeeAmount) || finalFeeAmount < 0)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fee amount. Fee must be a non-negative number."
      });
    }

    if (netAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Net amount cannot be negative. Adjust amount or fee."
      });
    }

    // Check balance for debit transactions
    if (transactionType === 'Debit' && merchant.balance < finalAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient merchant balance. Current balance: ₹${merchant.balance.toFixed(2)}`
      });
    }

    // Generate unique IDs
    const utr = generateUniqueId('UTR');
    const transactionId = generateUniqueId('TXN');
    const orderId = generateUniqueId('ORD');

    // Create payout transaction
    const newPayoutTransaction = new PayoutTransaction({
      merchantId,
      merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`.trim() || merchant.email,
      amount: finalAmount,
      accountNumber,
      connector,
      paymentMode: paymentMode || 'IMPS',
      type: type || 'Manual',
      transactionType: transactionType || 'Debit',
      remark: remark || '',
      feeApplied: feeApplied || false,
      feeAmount: finalFeeAmount,
      netAmount,
      utr,
      transactionId,
      orderId,
      status: "Pending",
      webhook: "0 / 0"
    });

    await newPayoutTransaction.save();

    // Update merchant balance
    if (transactionType === 'Debit') {
      merchant.balance -= finalAmount;
    } else {
      merchant.balance += finalAmount;
    }
    
    await merchant.save();

    console.log("✅ Payout transaction created successfully:", newPayoutTransaction._id);

    res.status(201).json({
      success: true,
      message: `${transactionType} payout transaction created successfully.`,
      data: newPayoutTransaction
    });

  } catch (error) {
    console.error("❌ Error creating payout transaction:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Get merchant transactions summary
// @route   GET /api/payout-transactions/merchant/:merchantId/transactions
export const getMerchantTransactionsSummary = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log(`🔍 Fetching transactions for merchant: ${merchantId}`);

    const transactions = await PayoutTransaction.find({ merchantId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const totalDebit = transactions
      .filter(t => t.transactionType === 'Debit')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalCredit = transactions
      .filter(t => t.transactionType === 'Credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const summary = {
      totalTransactions: transactions.length,
      totalDebit,
      totalCredit,
      netBalance: totalCredit - totalDebit
    };

    console.log(`✅ Found ${transactions.length} transactions for merchant`);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        summary
      }
    });
  } catch (error) {
    console.error("❌ Error fetching merchant transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Export to CSV
// @route   GET /api/payout-transactions/export/excel
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

    // Convert to CSV
    const headers = [
      'Transaction ID',
      'Order ID',
      'UTR',
      'Status',
      'Merchant Name',
      'Account Number',
      'Connector',
      'Amount (INR)',
      'Payment Mode',
      'Type',
      'Transaction Type',
      'Fee Applied',
      'Fee Amount',
      'Net Amount',
      'Remark',
      'Webhook Status',
      'Created At'
    ];

    const csvData = transactions.map(t => [
      t.transactionId,
      t.orderId,
      t.utr,
      t.status,
      t.merchantName,
      t.accountNumber,
      t.connector,
      t.amount,
      t.paymentMode,
      t.type,
      t.transactionType,
      t.feeApplied ? 'Yes' : 'No',
      t.feeAmount,
      t.netAmount,
      t.remark,
      t.webhook,
      new Date(t.createdAt).toLocaleString()
    ]);

    let csvContent = headers.join(',') + '\n';
    csvData.forEach(row => {
      csvContent += row.map(field => `"${field}"`).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payouts_${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);

  } catch (error) {
    console.error("❌ Error exporting payout transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Update transaction status
// @route   PATCH /api/payout-transactions/:id/status
export const updatePayoutTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Success", "Pending", "Failed", "Processing", "Refund"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided."
      });
    }

    const transaction = await PayoutTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found."
      });
    }

    transaction.status = status;
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Transaction status updated successfully.",
      data: transaction
    });
  } catch (error) {
    console.error("❌ Error updating transaction status:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
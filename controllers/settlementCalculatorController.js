// controllers/settlementCalculatorController.js
import SettlementCalculation from '../models/SettlementCalculation.js';
import Connector from '../models/Connector.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import Transaction from '../models/Transaction.js'; // Assuming you have Transaction model

// Calculate Settlement
export const calculateSettlement = async (req, res) => {
  try {
    const { connectorId, connectorAccountId, startDate, endDate } = req.body;

    // Validate required fields
    if (!connectorId || !connectorAccountId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate connector
    const connector = await Connector.findById(connectorId);
    if (!connector) {
      return res.status(404).json({
        success: false,
        message: 'Connector not found'
      });
    }

    // Validate connector account
    const connectorAccount = await ConnectorAccount.findById(connectorAccountId);
    if (!connectorAccount) {
      return res.status(404).json({
        success: false,
        message: 'Connector account not found'
      });
    }

    // Calculate settlement based on transactions
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of the day

    // Fetch transactions for the given period and connector account
    const transactions = await Transaction.find({
      connectorAccountId: connectorAccountId,
      createdAt: {
        $gte: start,
        $lte: end
      }
    });

    // Calculate amounts
    const totalTransactions = transactions.length;
    const successTransactions = transactions.filter(t => t.status === 'Success').length;
    const failedTransactions = transactions.filter(t => t.status === 'Failed').length;
    
    const calculatedAmount = transactions
      .filter(t => t.status === 'Success')
      .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

    // Calculate gateway charges (example: 2% of successful amount)
    const gatewayFeePercentage = connectorAccount.limits?.gatewayFeePercentage || 2;
    const gatewayCharges = (calculatedAmount * gatewayFeePercentage) / 100;
    const netAmount = calculatedAmount - gatewayCharges;

    // Create calculation record
    const calculation = new SettlementCalculation({
      connectorId,
      connectorAccountId,
      startDate: start,
      endDate: end,
      calculatedAmount,
      totalTransactions,
      successTransactions,
      failedTransactions,
      gatewayCharges,
      netAmount,
      calculationData: {
        gatewayFeePercentage,
        transactionsAnalyzed: totalTransactions,
        calculationPeriod: `${startDate} to ${endDate}`
      },
      createdBy: req.user?.id
    });

    await calculation.save();

    res.status(200).json({
      success: true,
      message: 'Settlement calculated successfully',
      data: {
        calculation,
        connector: {
          name: connector.name,
          type: connector.connectorType
        },
        connectorAccount: {
          name: connectorAccount.name,
          currency: connectorAccount.currency
        }
      }
    });

  } catch (error) {
    console.error('Error calculating settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating settlement',
      error: error.message
    });
  }
};

// Get Calculation History
export const getCalculationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { 'connectorData.name': { $regex: search, $options: 'i' } },
        { 'connectorAccountData.name': { $regex: search, $options: 'i' } }
      ];
    }

    const calculations = await SettlementCalculation.find(query)
      .populate('connectorId', 'name connectorType')
      .populate('connectorAccountId', 'name currency')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SettlementCalculation.countDocuments(query);

    res.status(200).json({
      success: true,
      data: calculations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching calculation history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calculation history',
      error: error.message
    });
  }
};

// Get Calculation by ID
export const getCalculationById = async (req, res) => {
  try {
    const { id } = req.params;

    const calculation = await SettlementCalculation.findById(id)
      .populate('connectorId')
      .populate('connectorAccountId')
      .populate('createdBy', 'name email');

    if (!calculation) {
      return res.status(404).json({
        success: false,
        message: 'Calculation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: calculation
    });
  } catch (error) {
    console.error('Error fetching calculation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calculation',
      error: error.message
    });
  }
};

// Get connectors for calculator (only active ones)
export const getCalculatorConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({ 
      status: 'Active'
    }).select('name connectorType status');

    res.status(200).json({
      success: true,
      data: connectors
    });
  } catch (error) {
    console.error('Error fetching connectors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connectors',
      error: error.message
    });
  }
};

// Get connector accounts by connector ID
export const getCalculatorConnectorAccounts = async (req, res) => {
  try {
    const { connectorId } = req.params;

    const connectorAccounts = await ConnectorAccount.find({ 
      connectorId,
      status: 'Active'
    }).select('name currency status limits');

    res.status(200).json({
      success: true,
      data: connectorAccounts
    });
  } catch (error) {
    console.error('Error fetching connector accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connector accounts',
      error: error.message
    });
  }
};
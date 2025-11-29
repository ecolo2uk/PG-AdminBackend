// controllers/bankSettlementController.js
import BankSettlement from '../models/BankSettlement.js';
import Connector from '../models/Connector.js';
import ConnectorAccount from '../models/ConnectorAccount.js';

// Create Bank Settlement
export const createBankSettlement = async (req, res) => {
  try {
    const { connectorId, connectorAccountId, settlementAmount, settlementDate, remarks } = req.body;

    console.log('🏦 Creating bank settlement:', { connectorId, connectorAccountId, settlementAmount });

    // Validate required fields
    if (!connectorId || !connectorAccountId || !settlementAmount || !settlementDate) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: connectorId, connectorAccountId, settlementAmount, settlementDate'
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

    // Generate settlement ID
    const settlementCount = await BankSettlement.countDocuments();
    const settlementId = `BS${Date.now()}${settlementCount + 1}`;

    // Create bank settlement
    const bankSettlement = new BankSettlement({
      settlementId,
      connectorId,
      connectorAccountId,
      connectorName: connector.name,
      accountName: connectorAccount.name,
      settlementAmount: parseFloat(settlementAmount),
      settlementDate: new Date(settlementDate),
      remarks: remarks || '',
      status: 'COMPLETED',
      processedBy: req.user?.name || 'Admin'
    });

    await bankSettlement.save();

    console.log('✅ Bank settlement created successfully:', bankSettlement._id);

    res.status(201).json({
      success: true,
      message: 'Bank settlement created successfully',
      data: bankSettlement
    });

  } catch (error) {
    console.error('❌ Error creating bank settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bank settlement',
      error: error.message
    });
  }
};

// Get Bank Settlement History
export const getBankSettlementHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, startDate, endDate, connectorId } = req.query;

    console.log('📊 Fetching bank settlement history with filters:', { search, startDate, endDate, connectorId });

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { settlementId: { $regex: search, $options: 'i' } },
        { connectorName: { $regex: search, $options: 'i' } },
        { accountName: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.settlementDate = {};
      if (startDate) query.settlementDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.settlementDate.$lte = end;
      }
    }

    // Connector filter
    if (connectorId) {
      query.connectorId = connectorId;
    }

    const settlements = await BankSettlement.find(query)
      .populate('connectorId', 'name connectorType')
      .populate('connectorAccountId', 'name currency')
      .sort({ settlementDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BankSettlement.countDocuments(query);

    res.status(200).json({
      success: true,
      data: settlements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching bank settlement history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank settlement history',
      error: error.message
    });
  }
};

// Get Bank Settlement by ID
export const getBankSettlementById = async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await BankSettlement.findById(id)
      .populate('connectorId')
      .populate('connectorAccountId');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Bank settlement not found'
      });
    }

    res.status(200).json({
      success: true,
      data: settlement
    });
  } catch (error) {
    console.error('❌ Error fetching bank settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank settlement',
      error: error.message
    });
  }
};

// Update Bank Settlement
export const updateBankSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const settlement = await BankSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Bank settlement not found'
      });
    }

    // Update settlement
    Object.assign(settlement, updateData);
    await settlement.save();

    res.status(200).json({
      success: true,
      message: 'Bank settlement updated successfully',
      data: settlement
    });
  } catch (error) {
    console.error('❌ Error updating bank settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bank settlement',
      error: error.message
    });
  }
};

// Delete Bank Settlement
export const deleteBankSettlement = async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await BankSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Bank settlement not found'
      });
    }

    await BankSettlement.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Bank settlement deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting bank settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bank settlement',
      error: error.message
    });
  }
};

// Get connectors for bank settlement
export const getBankSettlementConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({ 
      status: 'Active'
    }).select('name connectorType status');

    res.status(200).json({
      success: true,
      data: connectors
    });
  } catch (error) {
    console.error('❌ Error fetching connectors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connectors',
      error: error.message
    });
  }
};

// Get connector accounts by connector ID for bank settlement
export const getBankSettlementConnectorAccounts = async (req, res) => {
  try {
    const { connectorId } = req.params;

    const connectorAccounts = await ConnectorAccount.find({ 
      connectorId,
      status: 'Active'
    }).select('name currency status');

    res.status(200).json({
      success: true,
      data: connectorAccounts
    });
  } catch (error) {
    console.error('❌ Error fetching connector accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connector accounts',
      error: error.message
    });
  }
};
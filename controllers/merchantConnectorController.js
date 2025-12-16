import MerchantConnectorAccount from "../models/MerchantConnectorAccount.js";
import Connector from "../models/Connector.js";
import ConnectorAccount from "../models/ConnectorAccount.js";
import User from "../models/User.js";

// Helper function to generate terminal ID
const generateTerminalId = () => {
  return (
    "PGID" +
    Date.now().toString().substr(-7) +
    Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0")
  );
};

// Get merchant connector accounts
export const getMerchantConnectorAccounts = async (req, res) => {
  try {
    const { merchantId } = req.params;
    // console.log("🔍 Fetching connector accounts for merchant:", merchantId);

    const accounts = await MerchantConnectorAccount.find({ merchantId })
      .populate("connectorId", "name connectorType")
      .populate("connectorAccountId", "name currency")
      .lean();

    // console.log(`✅ Found ${accounts.length} connector accounts`);

    const formattedAccounts = accounts.map((account) => ({
      _id: account._id,
      terminalId: account.terminalId,
      name: account.connectorAccountId?.name || "N/A",
      industry: account.industry,
      connector: account.connectorId?.name || "N/A",
      assignedAccount: account.connectorAccountId?.name || "N/A",
      percentage: account.percentage,
      currency: account.connectorAccountId?.currency || "INR",
      status: account.status,
      isPrimary: account.isPrimary,
      connectorId: account.connectorId?._id,
      connectorAccountId: account.connectorAccountId?._id,
    }));

    res.status(200).json({
      success: true,
      data: formattedAccounts,
    });
  } catch (error) {
    console.error("❌ Error fetching merchant connector accounts:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching connector accounts",
      error: error.message,
    });
  }
};

// Get available connectors for merchant
export const getAvailableConnectors = async (req, res) => {
  try {
    const { merchantId } = req.params;
    // console.log("🔍 Fetching available connectors for merchant:", merchantId);

    // Check if merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Get all active connectors
    const connectors = await Connector.find({ status: "Active" }).lean();
    // console.log(`✅ Found ${connectors.length} active connectors`);

    const connectorsWithAccounts = [];

    for (const connector of connectors) {
      // Get available accounts for this connector
      const availableAccounts = await ConnectorAccount.find({
        connectorId: connector._id,
        status: "Active",
      })
        .select("name currency")
        .lean();

      connectorsWithAccounts.push({
        connector: {
          _id: connector._id,
          name: connector.name,
          type: connector.connectorType,
        },
        availableAccounts: availableAccounts,
      });
    }

    res.status(200).json({
      success: true,
      data: connectorsWithAccounts,
    });
  } catch (error) {
    console.error("❌ Error fetching available connectors:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching available connectors",
      error: error.message,
    });
  }
};

// Add merchant connector account
export const addMerchantConnectorAccount = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { connectorId, connectorAccountId, industry, percentage, isPrimary } =
      req.body;

    // console.log(
    //   "💰 Adding connector account for merchant:",
    //   merchantId,
    //   req.body
    // );

    // Validation
    if (!connectorId || !connectorAccountId || !industry) {
      return res.status(400).json({
        success: false,
        message:
          "Connector, Connector Account, and Industry are required fields",
      });
    }

    // Check if merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== "merchant") {
      return res.status(404).json({
        success: false,
        message: "Merchant not found or invalid merchant",
      });
    }

    // Check if connector exists
    const connector = await Connector.findById(connectorId);
    if (!connector) {
      return res.status(404).json({
        success: false,
        message: "Connector not found",
      });
    }

    // Check if connector account exists
    const connectorAccount = await ConnectorAccount.findById(
      connectorAccountId
    );
    if (!connectorAccount) {
      return res.status(404).json({
        success: false,
        message: "Connector account not found",
      });
    }

    // Check if account is already assigned to this merchant
    const existingAccount = await MerchantConnectorAccount.findOne({
      merchantId,
      connectorAccountId,
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "This connector account is already assigned to the merchant",
      });
    }

    // If setting as primary, unset other primary accounts
    if (isPrimary) {
      await MerchantConnectorAccount.updateMany(
        { merchantId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    // Generate terminal ID
    const terminalId = generateTerminalId();

    // Create new merchant connector account
    const newAccount = new MerchantConnectorAccount({
      merchantId,
      connectorId,
      connectorAccountId,
      terminalId,
      industry,
      percentage: percentage || 100,
      isPrimary: isPrimary || false,
      status: "Active",
    });

    const savedAccount = await newAccount.save();

    // Populate the saved account for response
    const populatedAccount = await MerchantConnectorAccount.findById(
      savedAccount._id
    )
      .populate("connectorId", "name connectorType")
      .populate("connectorAccountId", "name currency")
      .lean();

    const responseData = {
      _id: populatedAccount._id,
      terminalId: populatedAccount.terminalId,
      name: populatedAccount.connectorAccountId?.name,
      industry: populatedAccount.industry,
      connector: populatedAccount.connectorId?.name,
      assignedAccount: populatedAccount.connectorAccountId?.name,
      percentage: populatedAccount.percentage,
      currency: populatedAccount.connectorAccountId?.currency,
      status: populatedAccount.status,
      isPrimary: populatedAccount.isPrimary,
    };

    // console.log("✅ Connector account added successfully:", savedAccount._id);

    res.status(201).json({
      success: true,
      message: "Connector account added successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error adding merchant connector account:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding connector account",
      error: error.message,
    });
  }
};

// Update merchant connector account
export const updateMerchantConnectorAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { connectorId, connectorAccountId, industry, percentage, isPrimary } =
      req.body;

    // console.log("🔄 Updating connector account:", accountId, req.body);

    const account = await MerchantConnectorAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Connector account not found",
      });
    }

    // If setting as primary, unset other primary accounts
    if (isPrimary) {
      await MerchantConnectorAccount.updateMany(
        { merchantId: account.merchantId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    // Update fields
    if (connectorId) account.connectorId = connectorId;
    if (connectorAccountId) account.connectorAccountId = connectorAccountId;
    if (industry) account.industry = industry;
    if (percentage !== undefined) account.percentage = percentage;
    if (isPrimary !== undefined) account.isPrimary = isPrimary;

    const updatedAccount = await account.save();

    // Populate the updated account for response
    const populatedAccount = await MerchantConnectorAccount.findById(
      updatedAccount._id
    )
      .populate("connectorId", "name connectorType")
      .populate("connectorAccountId", "name currency")
      .lean();

    const responseData = {
      _id: populatedAccount._id,
      terminalId: populatedAccount.terminalId,
      name: populatedAccount.connectorAccountId?.name,
      industry: populatedAccount.industry,
      connector: populatedAccount.connectorId?.name,
      assignedAccount: populatedAccount.connectorAccountId?.name,
      percentage: populatedAccount.percentage,
      currency: populatedAccount.connectorAccountId?.currency,
      status: populatedAccount.status,
      isPrimary: populatedAccount.isPrimary,
    };

    // console.log("✅ Connector account updated successfully");

    res.status(200).json({
      success: true,
      message: "Connector account updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error updating merchant connector account:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating connector account",
      error: error.message,
    });
  }
};

// Delete merchant connector account
export const deleteMerchantConnectorAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    // console.log("🗑️ Deleting connector account:", accountId);

    const account = await MerchantConnectorAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Connector account not found",
      });
    }

    await MerchantConnectorAccount.findByIdAndDelete(accountId);

    // console.log("✅ Connector account deleted successfully");

    res.status(200).json({
      success: true,
      message: "Connector account deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting merchant connector account:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting connector account",
      error: error.message,
    });
  }
};

// Set primary account
export const setPrimaryAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    // console.log("⭐ Setting primary account:", accountId);

    const account = await MerchantConnectorAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Connector account not found",
      });
    }

    // Unset all primary accounts for this merchant
    await MerchantConnectorAccount.updateMany(
      { merchantId: account.merchantId, isPrimary: true },
      { $set: { isPrimary: false } }
    );

    // Set this account as primary
    account.isPrimary = true;
    await account.save();

    // console.log("✅ Primary account set successfully");

    res.status(200).json({
      success: true,
      message: "Primary account set successfully",
    });
  } catch (error) {
    console.error("❌ Error setting primary account:", error);
    res.status(500).json({
      success: false,
      message: "Server error while setting primary account",
      error: error.message,
    });
  }
};

// Get account limits
export const getAccountLimits = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Implementation for getting account limits
    res.status(200).json({
      success: true,
      data: {
        minTransactionAmount: 100,
        maxTransactionAmount: 10000,
        perDayLimit: 50000,
        perTransactionLimit: 10000,
      },
    });
  } catch (error) {
    console.error("Error getting account limits:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting account limits",
      error: error.message,
    });
  }
};

// Update account limits
export const updateAccountLimits = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Implementation for updating account limits
    res.status(200).json({
      success: true,
      message: "Account limits updated successfully",
    });
  } catch (error) {
    console.error("Error updating account limits:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating account limits",
      error: error.message,
    });
  }
};

// Get account rates
export const getAccountRates = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Implementation for getting account rates
    res.status(200).json({
      success: true,
      data: {
        upiMdr: 7.0,
        gatewayFee: 4.5,
        rollingReserve: 0.0,
        successTransactionFee: 0.0,
        chargebackFee: 0.0,
        refundFee: 1000.0,
        setupFee: 0.0,
      },
    });
  } catch (error) {
    console.error("Error getting account rates:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting account rates",
      error: error.message,
    });
  }
};

// Update account rates
export const updateAccountRates = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Implementation for updating account rates
    res.status(200).json({
      success: true,
      message: "Account rates updated successfully",
    });
  } catch (error) {
    console.error("Error updating account rates:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating account rates",
      error: error.message,
    });
  }
};

// Get account details
export const getAccountDetails = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await MerchantConnectorAccount.findById(accountId)
      .populate("connectorId", "name connectorType")
      .populate("connectorAccountId", "name currency integrationKeys")
      .lean();

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error("Error getting account details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting account details",
      error: error.message,
    });
  }
};

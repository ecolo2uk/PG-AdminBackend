// controllers/settlementCalculatorController.js
import SettlementCalculation from "../models/SettlementCalculation.js";
import Connector from "../models/Connector.js";
import ConnectorAccount from "../models/ConnectorAccount.js";

// Get connectors for calculator (only active ones)
export const getCalculatorConnectors = async (req, res) => {
  try {
    console.log("🔍 Fetching connectors...");

    const connectors = await Connector.find({
      status: "Active",
    }).select("name connectorType status isPayoutSupport");

    console.log(`✅ Found ${connectors.length} connectors`);

    res.status(200).json({
      success: true,
      data: connectors,
    });
  } catch (error) {
    console.error("❌ Error fetching connectors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching connectors",
      error: error.message,
    });
  }
};

// Get connector accounts by connector ID
export const getCalculatorConnectorAccounts = async (req, res) => {
  try {
    const { connectorId } = req.params;
    console.log("🔍 Fetching connector accounts for:", connectorId);

    if (!connectorId) {
      return res.status(400).json({
        success: false,
        message: "Connector ID is required",
      });
    }

    const connectorAccounts = await ConnectorAccount.find({
      connectorId,
      status: "Active",
    }).select("name currency status limits integrationKeys");

    console.log(
      `✅ Found ${connectorAccounts.length} accounts for connector ${connectorId}`
    );

    res.status(200).json({
      success: true,
      data: connectorAccounts,
    });
  } catch (error) {
    console.error("❌ Error fetching connector accounts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching connector accounts",
      error: error.message,
    });
  }
};

// Calculate Settlement
export const calculateSettlement = async (req, res) => {
  try {
    const { connectorId, connectorAccountId, startDate, endDate } = req.body;

    console.log("🧮 Calculating settlement with:", {
      connectorId,
      connectorAccountId,
      startDate,
      endDate,
    });

    // Validate required fields
    if (!connectorId || !connectorAccountId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: connectorId, connectorAccountId, startDate, endDate",
      });
    }

    // Validate connector
    const connector = await Connector.findById(connectorId);
    if (!connector) {
      return res.status(404).json({
        success: false,
        message: "Connector not found",
      });
    }

    // Validate connector account
    const connectorAccount = await ConnectorAccount.findById(
      connectorAccountId
    );
    if (!connectorAccount) {
      return res.status(404).json({
        success: false,
        message: "Connector account not found",
      });
    }

    // Calculate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Demo calculation (replace with actual transaction data if available)
    const totalTransactions = Math.floor(Math.random() * 100) + 10;
    const successTransactions = Math.floor(totalTransactions * 0.85);
    const failedTransactions = totalTransactions - successTransactions;
    const calculatedAmount = successTransactions * (Math.random() * 1000 + 100);

    const gatewayFeePercentage =
      connectorAccount.limits?.gatewayFeePercentage || 2;
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
        calculationPeriod: `${startDate} to ${endDate}`,
        connectorName: connector.name,
        accountName: connectorAccount.name,
        currency: connectorAccount.currency,
      },
    });

    await calculation.save();

    console.log("✅ Settlement calculated successfully:", calculation._id);

    res.status(200).json({
      success: true,
      message: "Settlement calculated successfully",
      data: {
        calculation,
        connector: {
          name: connector.name,
          type: connector.connectorType,
        },
        connectorAccount: {
          name: connectorAccount.name,
          currency: connectorAccount.currency,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error calculating settlement:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating settlement",
      error: error.message,
    });
  }
};

// Get Calculation History
export const getCalculationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    console.log(req.query, "Q2");
    // const query = {};
    // if (search) {
    //   query.$or = [
    //     { "connectorId.name": { $regex: search, $options: "i" } },
    //     { "connectorAccountId.name": { $regex: search, $options: "i" } },
    //   ];
    // }
    // console.log(query);

    const calculations = await SettlementCalculation.find()
      .populate("connectorId", "name connectorType")
      .populate("connectorAccountId", "name currency")
      .sort({ createdAt: -1 });
    // .limit(limit * 1)
    // .skip((page - 1) * limit);
    const filtered = search
      ? calculations.filter(
          (c) =>
            c.connectorId.name.toLowerCase().includes(search.toLowerCase()) ||
            c.connectorAccountId.name
              .toLowerCase()
              .includes(search.toLowerCase())
        )
      : calculations;
    // console.log(`✅ Found ${calculations.length} calculations`);
    // console.log(filtered);
    // const total = await SettlementCalculation.countDocuments(query);

    res.status(200).json({
      success: true,
      data: filtered,
      // pagination: {
      //   currentPage: parseInt(page),
      //   totalPages: Math.ceil(total / limit),
      //   totalItems: total,
      //   itemsPerPage: parseInt(limit),
      // },
    });
  } catch (error) {
    console.error("Error fetching calculation history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching calculation history",
      error: error.message,
    });
  }
};

// Get Calculation by ID
export const getCalculationById = async (req, res) => {
  try {
    const { id } = req.params;

    const calculation = await SettlementCalculation.findById(id)
      .populate("connectorId")
      .populate("connectorAccountId");

    if (!calculation) {
      return res.status(404).json({
        success: false,
        message: "Calculation not found",
      });
    }

    res.status(200).json({
      success: true,
      data: calculation,
    });
  } catch (error) {
    console.error("Error fetching calculation:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching calculation",
      error: error.message,
    });
  }
};

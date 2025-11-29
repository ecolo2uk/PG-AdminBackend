// controllers/autoSettlementController.js
import AutoSettlement from '../models/AutoSettlement.js';
import Connector from '../models/Connector.js';
import ConnectorAccount from '../models/ConnectorAccount.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import Merchant from '../models/Merchant.js';
import User from '../models/User.js';
import cron from 'node-cron';

// Create Auto Settlement
// controllers/autoSettlementController.js - createAutoSettlement function
export const createAutoSettlement = async (req, res) => {
  try {
    console.log('🔧 CREATE AUTO SETTLEMENT REQUEST BODY:', req.body);
    
    const {
      connectorId,
      connectorAccountId,
      startTime,
      endTime,
      day,
      cronRunTime,
      isActive = true,
      settlementType = 'DAILY',
      minimumAmount = 100
    } = req.body;

    // Validate required fields
    if (!connectorId || !connectorAccountId || !startTime || !endTime || !cronRunTime) {
      console.log('❌ MISSING REQUIRED FIELDS');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate connector exists
    console.log('🔍 CHECKING CONNECTOR:', connectorId);
    const connector = await Connector.findById(connectorId);
    if (!connector) {
      console.log('❌ CONNECTOR NOT FOUND');
      return res.status(404).json({
        success: false,
        message: 'Connector not found'
      });
    }

    // Validate connector account exists
    console.log('🔍 CHECKING CONNECTOR ACCOUNT:', connectorAccountId);
    const connectorAccount = await ConnectorAccount.findById(connectorAccountId);
    if (!connectorAccount) {
      console.log('❌ CONNECTOR ACCOUNT NOT FOUND');
      return res.status(404).json({
        success: false,
        message: 'Connector account not found'
      });
    }

    // Validate connector supports payout
    if (!connector.isPayoutSupport) {
      console.log('❌ CONNECTOR DOES NOT SUPPORT PAYOUT');
      return res.status(400).json({
        success: false,
        message: 'Selected connector does not support payouts'
      });
    }

    console.log('✅ ALL VALIDATIONS PASSED, CREATING AUTO SETTLEMENT...');

    const autoSettlement = new AutoSettlement({
      name: `AutoSettlement_${Date.now()}`,
      connectorId,
      connectorAccountId,
      connectorName: connector.name,
      startTime,
      endTime,
      day: parseInt(day) || 0,
      cronRunTime,
      isActive,
      settlementType,
      minimumAmount,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
 createdBy: req.user?.id || req.user?._id 
    });

    await autoSettlement.save();
    
    console.log('✅ AUTO SETTLEMENT CREATED:', autoSettlement._id);

    res.status(201).json({
      success: true,
      message: 'Auto settlement created successfully',
      data: autoSettlement
    });

  } catch (error) {
    console.error('❌ ERROR CREATING AUTO SETTLEMENT:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating auto settlement',
      error: error.message
    });
  }
};

// Get all Auto Settlements
export const getAutoSettlements = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { connectorName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const autoSettlements = await AutoSettlement.find(query)
      .populate('connectorId', 'name className connectorType status isPayoutSupport')
      .populate('connectorAccountId', 'name currency status limits')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AutoSettlement.countDocuments(query);

    res.status(200).json({
      success: true,
      data: autoSettlements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching auto settlements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auto settlements',
      error: error.message
    });
  }
};

// Get Auto Settlement by ID
export const getAutoSettlementById = async (req, res) => {
  try {
    const { id } = req.params;

    const autoSettlement = await AutoSettlement.findById(id)
      .populate('connectorId')
      .populate('connectorAccountId')
      .populate('createdBy', 'name email');

    if (!autoSettlement) {
      return res.status(404).json({
        success: false,
        message: 'Auto settlement not found'
      });
    }

    res.status(200).json({
      success: true,
      data: autoSettlement
    });
  } catch (error) {
    console.error('Error fetching auto settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auto settlement',
      error: error.message
    });
  }
};

// Update Auto Settlement
export const updateAutoSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const autoSettlement = await AutoSettlement.findById(id);
    if (!autoSettlement) {
      return res.status(404).json({
        success: false,
        message: 'Auto settlement not found'
      });
    }

    // If connector is being updated, validate it
    if (updateData.connectorId) {
      const connector = await Connector.findById(updateData.connectorId);
      if (!connector) {
        return res.status(404).json({
          success: false,
          message: 'Connector not found'
        });
      }
      if (!connector.isPayoutSupport) {
        return res.status(400).json({
          success: false,
          message: 'Selected connector does not support payouts'
        });
      }
      updateData.connectorName = connector.name;
    }

    // Update the settlement
    Object.assign(autoSettlement, updateData);
    await autoSettlement.save();

    // Reschedule if status or cron time changed
    if (updateData.isActive !== undefined || updateData.cronRunTime) {
      if (autoSettlement.isActive) {
        scheduleAutoSettlement(autoSettlement);
      } else {
        // Remove from scheduled jobs if deactivated
        const jobId = autoSettlement._id.toString();
        if (scheduledJobs.has(jobId)) {
          scheduledJobs.get(jobId).stop();
          scheduledJobs.delete(jobId);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Auto settlement updated successfully',
      data: autoSettlement
    });
  } catch (error) {
    console.error('Error updating auto settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating auto settlement',
      error: error.message
    });
  }
};

// Delete Auto Settlement
export const deleteAutoSettlement = async (req, res) => {
  try {
    const { id } = req.params;

    const autoSettlement = await AutoSettlement.findById(id);
    if (!autoSettlement) {
      return res.status(404).json({
        success: false,
        message: 'Auto settlement not found'
      });
    }

    // Remove from scheduled jobs
    const jobId = autoSettlement._id.toString();
    if (scheduledJobs.has(jobId)) {
      scheduledJobs.get(jobId).stop();
      scheduledJobs.delete(jobId);
    }

    await AutoSettlement.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Auto settlement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting auto settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting auto settlement',
      error: error.message
    });
  }
};

// Toggle Auto Settlement Status
export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const autoSettlement = await AutoSettlement.findById(id);
    if (!autoSettlement) {
      return res.status(404).json({
        success: false,
        message: 'Auto settlement not found'
      });
    }

    autoSettlement.isActive = !autoSettlement.isActive;
    autoSettlement.status = autoSettlement.isActive ? 'ACTIVE' : 'INACTIVE';
    
    await autoSettlement.save();

    if (autoSettlement.isActive) {
      scheduleAutoSettlement(autoSettlement);
    } else {
      // Remove from scheduled jobs
      const jobId = autoSettlement._id.toString();
      if (scheduledJobs.has(jobId)) {
        scheduledJobs.get(jobId).stop();
        scheduledJobs.delete(jobId);
      }
    }

    res.status(200).json({
      success: true,
      message: `Auto settlement ${autoSettlement.isActive ? 'activated' : 'deactivated'}`,
      data: autoSettlement
    });
  } catch (error) {
    console.error('Error toggling auto settlement status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling auto settlement status',
      error: error.message
    });
  }
};

// Manual Trigger for Auto Settlement
export const triggerSettlement = async (req, res) => {
  try {
    const { id } = req.params;

    const autoSettlement = await AutoSettlement.findById(id)
      .populate('connectorId')
      .populate('connectorAccountId');

    if (!autoSettlement) {
      return res.status(404).json({
        success: false,
        message: 'Auto settlement not found'
      });
    }

    // Process settlement immediately
    await processAutoSettlement(autoSettlement);

    res.status(200).json({
      success: true,
      message: 'Auto settlement triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering settlement',
      error: error.message
    });
  }
};

// Get Connectors for Auto Settlement (only payout supported)
export const getPayoutConnectors = async (req, res) => {
  try {
    const connectors = await Connector.find({ 
      isPayoutSupport: true,
      status: 'Active'
    }).select('name className connectorType isPayoutSupport');

    res.status(200).json({
      success: true,
      data: connectors
    });
  } catch (error) {
    console.error('Error fetching payout connectors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connectors',
      error: error.message
    });
  }
};

// Get Connector Accounts by Connector ID
export const getConnectorAccounts = async (req, res) => {
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

// Core Auto Settlement Processing Logic
const processAutoSettlement = async (autoSettlement) => {
  try {
    console.log(`🔄 Processing auto settlement: ${autoSettlement.name}`);
    
    // Update last run time
    autoSettlement.lastRun = new Date();
    autoSettlement.lastRunStatus = 'PROCESSING';
    await autoSettlement.save();

    // Find merchants with unsettled balance above minimum amount
    const merchants = await Merchant.find({
      unsettledBalance: { $gte: autoSettlement.minimumAmount }
    }).populate('userId');

    let totalSettled = 0;
    let successfulSettlements = 0;
    let failedSettlements = 0;

    const settlementResults = [];

    for (const merchant of merchants) {
      if (merchant.unsettledBalance >= autoSettlement.minimumAmount) {
        try {
          // Create payout transaction
          const payoutTransaction = new PayoutTransaction({
            payoutId: `P${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
            merchantId: merchant.userId._id,
            merchantName: merchant.merchantName,
            merchantEmail: merchant.userId.email,
            mid: merchant.mid,
            amount: merchant.unsettledBalance,
            settlementAmount: merchant.unsettledBalance,
            transactionType: 'Debit',
            status: 'Success',
            paymentMode: 'NEFT',
            connector: autoSettlement.connectorName,
            connectorId: autoSettlement.connectorId,
            connectorAccountId: autoSettlement.connectorAccountId,
            remark: `Auto Settlement - ${autoSettlement.name}`,
            processedBy: 'System',
            initiatedAt: new Date(),
            processedAt: new Date(),
            completedAt: new Date(),
            bankDetails: merchant.bankDetails || {
              bankName: 'N/A',
              accountNumber: 'N/A',
              ifscCode: 'N/A',
              accountHolderName: merchant.merchantName,
              accountType: 'Saving'
            }
          });

          await payoutTransaction.save();

          // Update merchant balance
          const previousUnsettled = merchant.unsettledBalance;
          merchant.availableBalance -= previousUnsettled;
          merchant.totalDebits += previousUnsettled;
          merchant.unsettledBalance = 0;
          merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;

          await merchant.save();

          // Update user balance
          await User.findByIdAndUpdate(merchant.userId._id, {
            $inc: { 
              balance: -previousUnsettled,
              unsettleBalance: -previousUnsettled
            }
          });

          totalSettled += previousUnsettled;
          successfulSettlements++;

          settlementResults.push({
            merchant: merchant.merchantName,
            amount: previousUnsettled,
            status: 'SUCCESS'
          });

          console.log(`✅ Settled ${previousUnsettled} for merchant: ${merchant.merchantName}`);

        } catch (merchantError) {
          console.error(`❌ Error settling merchant ${merchant.merchantName}:`, merchantError);
          failedSettlements++;
          
          settlementResults.push({
            merchant: merchant.merchantName,
            amount: merchant.unsettledBalance,
            status: 'FAILED',
            error: merchantError.message
          });
        }
      }
    }

    // Update settlement status
    let finalStatus = 'SUCCESS';
    let message = `Settled ${successfulSettlements} merchants, ₹${totalSettled}`;

    if (successfulSettlements === 0 && failedSettlements > 0) {
      finalStatus = 'FAILED';
      message = `All settlements failed (${failedSettlements} merchants)`;
    } else if (failedSettlements > 0) {
      finalStatus = 'PARTIAL';
      message = `Partially settled: ${successfulSettlements} success, ${failedSettlements} failed, ₹${totalSettled}`;
    } else if (successfulSettlements === 0) {
      message = 'No merchants eligible for settlement';
    }

    autoSettlement.lastRunStatus = finalStatus;
    autoSettlement.lastRunMessage = message;
    await autoSettlement.save();

    console.log(`🎉 Auto settlement completed: ${message}`);

    return {
      success: true,
      totalSettled,
      successfulSettlements,
      failedSettlements,
      results: settlementResults
    };

  } catch (error) {
    console.error('❌ Error in auto settlement process:', error);
    
    autoSettlement.lastRunStatus = 'FAILED';
    autoSettlement.lastRunMessage = error.message;
    await autoSettlement.save();

    return {
      success: false,
      error: error.message
    };
  }
};

// Cron Scheduling
const scheduledJobs = new Map();

const scheduleAutoSettlement = (autoSettlement) => {
  try {
    // Remove existing job if present
    const jobId = autoSettlement._id.toString();
    if (scheduledJobs.has(jobId)) {
      const existingJob = scheduledJobs.get(jobId);
      existingJob.stop();
      scheduledJobs.delete(jobId);
    }

    if (!autoSettlement.isActive) {
      return;
    }

    // Convert cronRunTime to cron expression (runs daily at specified time)
    const [hours, minutes] = autoSettlement.cronRunTime.split(':');
    const cronExpression = `${minutes} ${hours} * * *`;

    const job = cron.schedule(cronExpression, () => {
      processAutoSettlement(autoSettlement);
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    scheduledJobs.set(jobId, job);

    // Calculate next run time
    const now = new Date();
    const [runHours, runMinutes] = autoSettlement.cronRunTime.split(':');
    let nextRun = new Date();
    nextRun.setHours(parseInt(runHours), parseInt(runMinutes), 0, 0);
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    autoSettlement.nextRun = nextRun;
    autoSettlement.save();

    console.log(`⏰ Scheduled auto settlement: ${autoSettlement.name} at ${autoSettlement.cronRunTime}`);

  } catch (error) {
    console.error('❌ Error scheduling auto settlement:', error);
  }
};

// Initialize all active auto settlements on server start
export const initializeAutoSettlements = async () => {
  try {
    const activeSettlements = await AutoSettlement.find({ isActive: true })
      .populate('connectorId')
      .populate('connectorAccountId');
    
    for (const settlement of activeSettlements) {
      scheduleAutoSettlement(settlement);
    }
    
    console.log(`✅ Initialized ${activeSettlements.length} auto settlements`);
  } catch (error) {
    console.error('❌ Error initializing auto settlements:', error);
  }
};
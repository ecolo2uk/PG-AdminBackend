// controllers/settlementController.js
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import Settlement from '../models/Settlement.js';
import PayoutTransaction from '../models/PayoutTransaction.js';

// Get all merchants with unsettled balance for settlement
export const getSettlementMerchants = async (req, res) => {
  try {
    const merchants = await User.find({
      role: 'merchant',
      $or: [
        { unsettleBalance: { $gt: 0 } },
        { unsettleBalance: { $exists: false } }
      ]
    })
    .select('firstname lastname email mid unsettleBalance bankDetails status')
    .sort({ unsettleBalance: -1 });

    const formattedMerchants = await Promise.all(
      merchants.map(async (merchant) => {
        // Get merchant details from Merchant collection
        const merchantDetail = await Merchant.findOne({ userId: merchant._id });
        
        return {
          id: merchant._id,
          merchantName: merchantDetail?.merchantName || `${merchant.firstname} ${merchant.lastname}`,
          merchantEmail: merchant.email,
          unsettleBalance: merchant.unsettleBalance || 0,
          mid: merchant.mid,
          bankDetails: merchant.bankDetails,
          status: merchant.status
        };
      })
    );

    res.json({
      success: true,
      merchants: formattedMerchants
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Process settlement for selected merchants
export const processSettlement = async (req, res) => {
  try {
    const { settlementAmount, selectedMerchants } = req.body;
    
    if (!selectedMerchants || selectedMerchants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No merchants selected for settlement'
      });
    }

    // Validate settlement amounts
    for (const merchant of selectedMerchants) {
      const user = await User.findById(merchant.merchantId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: `Merchant not found: ${merchant.merchantName}`
        });
      }
      
      if (merchant.settlementAmount > (user.unsettleBalance || 0)) {
        return res.status(400).json({
          success: false,
          message: `Settlement amount exceeds unsettled balance for ${merchant.merchantName}`
        });
      }
    }

    // Create settlement batch
    const settlement = new Settlement({
      totalAmount: settlementAmount,
      totalMerchants: selectedMerchants.length,
      selectedMerchants: selectedMerchants,
      status: 'PROCESSING',
      processedBy: req.user?.name || 'Admin'
    });

    await settlement.save();

    // Process payout transactions for each merchant
    const payoutTransactions = [];
    const failedSettlements = [];

    for (const merchantData of selectedMerchants) {
      try {
        const merchant = await User.findById(merchantData.merchantId);
        const merchantDetail = await Merchant.findOne({ userId: merchantData.merchantId });

        if (merchant && merchant.unsettleBalance >= merchantData.settlementAmount) {
          // Create payout transaction
          const payout = new PayoutTransaction({
            merchantId: merchant._id,
            merchantName: merchantData.merchantName,
            merchantEmail: merchantData.merchantEmail,
            mid: merchant.mid,
            amount: merchantData.settlementAmount,
            settlementAmount: merchantData.settlementAmount,
            settlementId: settlement._id,
            settlementBatch: settlement.batchId,
            status: 'PROCESSING',
            bankDetails: merchant.bankDetails,
            transactionType: 'Debit',
            remark: `Settlement batch: ${settlement.batchId}`
          });

          await payout.save();

          // Update merchant unsettled balance
          merchant.unsettleBalance -= merchantData.settlementAmount;
          await merchant.save();

          // Update merchant detail
          if (merchantDetail) {
            merchantDetail.unsettledBalance -= merchantData.settlementAmount;
            await merchantDetail.save();
          }

          settlement.payoutTransactions.push(payout._id);
          payoutTransactions.push(payout);

          // Simulate processing delay and update status
          setTimeout(async () => {
            try {
              payout.status = 'SUCCESS';
              payout.processedAt = new Date();
              payout.utr = `UTR${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
              await payout.save();
              
              console.log(`✅ Settlement completed for ${merchantData.merchantName}`);
            } catch (error) {
              console.error('Error updating payout status:', error);
            }
          }, 2000);

        } else {
          failedSettlements.push({
            merchant: merchantData.merchantName,
            reason: 'Insufficient unsettled balance'
          });
        }
      } catch (error) {
        failedSettlements.push({
          merchant: merchantData.merchantName,
          reason: error.message
        });
      }
    }

    // Update settlement status
    if (failedSettlements.length === 0) {
      settlement.status = 'COMPLETED';
      settlement.completedAt = new Date();
    } else if (failedSettlements.length === selectedMerchants.length) {
      settlement.status = 'FAILED';
      settlement.failureReason = 'All settlements failed';
    } else {
      settlement.status = 'PARTIAL';
      settlement.failureReason = `${failedSettlements.length} settlements failed`;
    }

    await settlement.save();

    res.json({
      success: true,
      message: 'Settlement processed successfully',
      settlementId: settlement.settlementId,
      batchId: settlement.batchId,
      totalProcessed: payoutTransactions.length,
      failedSettlements: failedSettlements,
      settlementDetails: {
        totalAmount: settlement.totalAmount,
        totalMerchants: settlement.totalMerchants,
        status: settlement.status
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get settlement details for a specific merchant
export const getMerchantSettlementDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const settlements = await PayoutTransaction.find({ 
      merchantId: merchantId,
      status: 'SUCCESS'
    })
    .populate('settlementId')
    .sort({ createdAt: -1 })
    .limit(10);

    const merchant = await User.findById(merchantId).select('firstname lastname email unsettleBalance');
    const merchantDetail = await Merchant.findOne({ userId: merchantId });

    const settlementDetails = settlements.map(settlement => ({
      amount: settlement.amount,
      dateTime: settlement.createdAt,
      status: settlement.status,
      utr: settlement.utr,
      batchId: settlement.settlementBatch,
      settlementId: settlement.settlementId?.settlementId
    }));

    res.json({
      success: true,
      merchant: {
        name: merchantDetail?.merchantName || `${merchant?.firstname} ${merchant?.lastname}`,
        email: merchant?.email,
        unsettleBalance: merchant?.unsettleBalance || 0
      },
      settlements: settlementDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all settlements history
export const getAllSettlements = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const settlements = await Settlement.find()
      .populate('selectedMerchants.merchantId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Settlement.countDocuments();

    res.json({
      success: true,
      settlements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get settlement by ID
export const getSettlementById = async (req, res) => {
  try {
    const { settlementId } = req.params;

    const settlement = await Settlement.findById(settlementId)
      .populate('payoutTransactions')
      .populate('selectedMerchants.merchantId');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    res.json({
      success: true,
      settlement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
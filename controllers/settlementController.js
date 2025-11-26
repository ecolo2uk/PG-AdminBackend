// controllers/settlementController.js
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import Settlement from '../models/Settlement.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import mongoose from 'mongoose';

// Get merchants for settlement
export const getSettlementMerchants = async (req, res) => {
  try {
    console.log('🔄 Fetching merchants for settlement...');
    
    const merchants = await User.find({
      role: 'merchant',
      $or: [
        { unsettleBalance: { $gt: 0 } },
        { unsettleBalance: { $exists: true } }
      ]
    })
    .select('firstname lastname email mid unsettleBalance bankDetails status createdAt')
    .sort({ unsettleBalance: -1, createdAt: -1 });

    console.log(`✅ Found ${merchants.length} merchants`);

    const formattedMerchants = await Promise.all(
      merchants.map(async (merchant) => {
        try {
          // Get merchant details from Merchant collection
          const merchantDetail = await Merchant.findOne({ userId: merchant._id });
          
          return {
            id: merchant._id.toString(),
            merchantName: merchantDetail?.merchantName || `${merchant.firstname} ${merchant.lastname}`,
            merchantEmail: merchant.email,
            unsettleBalance: merchant.unsettleBalance || 0,
            mid: merchant.mid || 'N/A',
            bankDetails: merchant.bankDetails || {},
            status: merchant.status || 'Active',
            createdAt: merchant.createdAt
          };
        } catch (error) {
          console.error(`❌ Error processing merchant ${merchant._id}:`, error);
          return null;
        }
      })
    );

    // Filter out null values and sort by unsettleBalance (highest first)
    const validMerchants = formattedMerchants.filter(m => m !== null)
      .sort((a, b) => b.unsettleBalance - a.unsettleBalance);

    console.log(`📊 Returning ${validMerchants.length} valid merchants`);

    res.json({
      success: true,
      merchants: validMerchants
    });
  } catch (error) {
    console.error('❌ Error in getSettlementMerchants:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Process settlement
export const processSettlement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { settlementAmount, selectedMerchants } = req.body;
    
    console.log('🔄 Processing settlement with data:', {
      settlementAmount,
      selectedMerchantsCount: selectedMerchants?.length
    });

    if (!selectedMerchants || selectedMerchants.length === 0) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'No merchants selected for settlement'
      });
    }

    // Validate input data
    if (!settlementAmount || settlementAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'Invalid settlement amount'
      });
    }

    // Validate each merchant
    for (const merchantData of selectedMerchants) {
      if (!merchantData.merchantId || !merchantData.settlementAmount) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(400).json({
          success: false,
          message: 'Invalid merchant data'
        });
      }

      const merchant = await User.findById(merchantData.merchantId).session(session);
      if (!merchant) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(400).json({
          success: false,
          message: `Merchant not found: ${merchantData.merchantName}`
        });
      }
      
      if (merchantData.settlementAmount > (merchant.unsettleBalance || 0)) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(400).json({
          success: false,
          message: `Settlement amount (₹${merchantData.settlementAmount}) exceeds unsettled balance (₹${merchant.unsettleBalance}) for ${merchantData.merchantName}`
        });
      }
    }

    // Create settlement batch
    const settlement = new Settlement({
      totalAmount: settlementAmount,
      totalMerchants: selectedMerchants.length,
      selectedMerchants: selectedMerchants,
      status: 'PROCESSING',
      processedBy: req.user?.name || 'Admin',
      settlementDate: new Date()
    });

    await settlement.save({ session });

    // Process payout transactions for each merchant
    const payoutTransactions = [];
    const failedSettlements = [];

    for (const merchantData of selectedMerchants) {
      try {
        const merchant = await User.findById(merchantData.merchantId).session(session);
        const merchantDetail = await Merchant.findOne({ userId: merchantData.merchantId }).session(session);

        if (merchant && merchant.unsettleBalance >= merchantData.settlementAmount) {
          // Create payout transaction
          const payout = new PayoutTransaction({
            merchantId: merchant._id,
            merchantName: merchantData.merchantName,
            merchantEmail: merchantData.merchantEmail,
            mid: merchant.mid || 'N/A',
            amount: merchantData.settlementAmount,
            settlementAmount: merchantData.settlementAmount,
            settlementId: settlement._id,
            settlementBatch: settlement.batchId,
            status: 'PROCESSING',
            bankDetails: merchant.bankDetails || {},
            transactionType: 'Debit',
            remark: `Settlement batch: ${settlement.batchId}`,
            paymentMode: 'NEFT'
          });

          await payout.save({ session });

          // Update merchant unsettled balance
          merchant.unsettleBalance -= merchantData.settlementAmount;
          await merchant.save({ session });

          // Update merchant detail if exists
          if (merchantDetail) {
            merchantDetail.unsettledBalance = Math.max(0, (merchantDetail.unsettledBalance || 0) - merchantData.settlementAmount);
            await merchantDetail.save({ session });
          }

          settlement.payoutTransactions.push(payout._id);
          payoutTransactions.push(payout);

          // Update payout status to SUCCESS after a short delay (simulating processing)
          setTimeout(async () => {
            try {
              payout.status = 'SUCCESS';
              payout.processedAt = new Date();
              payout.utr = `UTR${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
              await payout.save();
              
              console.log(`✅ Settlement completed for ${merchantData.merchantName} - UTR: ${payout.utr}`);
            } catch (error) {
              console.error('❌ Error updating payout status:', error);
            }
          }, 2000);

        } else {
          failedSettlements.push({
            merchant: merchantData.merchantName,
            reason: 'Insufficient unsettled balance'
          });
        }
      } catch (error) {
        console.error(`❌ Error processing settlement for ${merchantData.merchantName}:`, error);
        failedSettlements.push({
          merchant: merchantData.merchantName,
          reason: error.message
        });
      }
    }

    // Update settlement status based on results
    if (failedSettlements.length === 0 && payoutTransactions.length > 0) {
      settlement.status = 'COMPLETED';
      settlement.completedAt = new Date();
    } else if (failedSettlements.length === selectedMerchants.length) {
      settlement.status = 'FAILED';
      settlement.failureReason = 'All settlements failed';
    } else if (payoutTransactions.length > 0) {
      settlement.status = 'PARTIAL';
      settlement.failureReason = `${failedSettlements.length} settlements failed`;
    } else {
      settlement.status = 'FAILED';
      settlement.failureReason = 'No settlements processed';
    }

    await settlement.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Settlement ${settlement.batchId} processed: ${payoutTransactions.length} successful, ${failedSettlements.length} failed`);

    res.json({
      success: true,
      message: 'Settlement processed successfully!',
      settlementId: settlement.settlementId,
      batchId: settlement.batchId,
      totalProcessed: payoutTransactions.length,
      failedCount: failedSettlements.length,
      failedSettlements: failedSettlements,
      settlementDetails: {
        totalAmount: settlement.totalAmount,
        totalMerchants: settlement.totalMerchants,
        status: settlement.status
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Error in processSettlement:', error);
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

    console.log(`🔄 Fetching settlement details for merchant: ${merchantId}`);

    // Validate merchantId
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    const settlements = await PayoutTransaction.find({ 
      merchantId: merchantId
    })
    .populate('settlementId', 'settlementId batchId settlementDate status')
    .sort({ createdAt: -1 })
    .limit(20);

    const merchant = await User.findById(merchantId).select('firstname lastname email unsettleBalance');
    const merchantDetail = await Merchant.findOne({ userId: merchantId });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const settlementDetails = settlements.map(settlement => ({
      id: settlement._id,
      amount: settlement.amount,
      dateTime: settlement.createdAt,
      status: settlement.status,
      utr: settlement.utr,
      batchId: settlement.settlementBatch,
      settlementId: settlement.settlementId?.settlementId,
      remark: settlement.remark
    }));

    console.log(`✅ Found ${settlementDetails.length} settlements for ${merchant.firstname}`);

    res.json({
      success: true,
      merchant: {
        name: merchantDetail?.merchantName || `${merchant.firstname} ${merchant.lastname}`,
        email: merchant.email,
        unsettleBalance: merchant.unsettleBalance || 0
      },
      settlements: settlementDetails
    });
  } catch (error) {
    console.error('❌ Error in getMerchantSettlementDetails:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all settlements history
export const getAllSettlements = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const settlements = await Settlement.find(query)
      .populate('selectedMerchants.merchantId', 'firstname lastname email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Settlement.countDocuments(query);

    res.json({
      success: true,
      settlements,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Error in getAllSettlements:', error);
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
      .populate('selectedMerchants.merchantId', 'firstname lastname email mid');

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
    console.error('❌ Error in getSettlementById:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
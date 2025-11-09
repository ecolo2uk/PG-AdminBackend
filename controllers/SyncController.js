// controllers/transactionSyncController.js
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Auto-sync for new transactions
export const autoSyncTransaction = async (merchantUserId, transaction, type, oldStatus = null) => {
  try {
    console.log(`🔄 Auto-syncing ${type} transaction for merchant: ${merchantUserId}`);
    
    const merchant = await Merchant.findOne({ userId: merchantUserId });
    if (!merchant) {
      console.log('❌ Merchant not found for auto-sync');
      return;
    }

    // Your existing auto-sync logic here...
    // ... (keep your existing autoSyncTransaction code)

  } catch (error) {
    console.error('❌ Error in auto-sync:', error);
  }
};

// 🔥 NEW: Manual Sync for ALL Existing Transactions
export const syncAllExistingTransactions = async (req, res) => {
  try {
    console.log('🔄 Starting manual sync for ALL existing transactions...');

    // Get all merchants
    const merchants = await Merchant.find({});
    console.log(`📊 Found ${merchants.length} merchants`);

    let totalSynced = 0;

    for (const merchant of merchants) {
      try {
        console.log(`\n🔄 Syncing transactions for merchant: ${merchant.merchantName}`);
        
        // Get all transactions for this merchant
        const paymentTransactions = await Transaction.find({ 
          merchantId: merchant.userId 
        });
        
        const payoutTransactions = await PayoutTransaction.find({ 
          merchantId: merchant.userId 
        });

        console.log(`   📥 Found ${paymentTransactions.length} payment transactions`);
        console.log(`   📥 Found ${payoutTransactions.length} payout transactions`);

        // Reset merchant arrays
        merchant.paymentTransactions = [];
        merchant.payoutTransactions = [];
        merchant.recentTransactions = [];
        merchant.availableBalance = 0;
        merchant.totalCredits = 0;
        merchant.totalDebits = 0;
        merchant.netEarnings = 0;
        merchant.totalTransactions = 0;
        merchant.successfulTransactions = 0;
        merchant.failedTransactions = 0;

        // Sync payment transactions
        for (const transaction of paymentTransactions) {
          // Add to paymentTransactions array
          merchant.paymentTransactions.push(transaction._id);

          // Add to recentTransactions
          const newTransaction = {
            transactionId: transaction.transactionId,
            type: 'payment',
            transactionType: 'Credit',
            amount: transaction.amount,
            status: transaction.status,
            reference: transaction.merchantOrderId,
            method: transaction.paymentMethod,
            remark: 'Payment Received',
            date: transaction.createdAt,
            customer: transaction.customerName || 'N/A'
          };

          merchant.recentTransactions.unshift(newTransaction);

          // Update balance if successful
          if (transaction.status === 'SUCCESS' || transaction.status === 'Success') {
            merchant.availableBalance += transaction.amount;
            merchant.totalCredits += transaction.amount;
            merchant.successfulTransactions += 1;
          } else if (transaction.status === 'FAILED' || transaction.status === 'Failed') {
            merchant.failedTransactions += 1;
          }

          merchant.totalTransactions += 1;
          totalSynced++;
        }

        // Sync payout transactions
        for (const payout of payoutTransactions) {
          // Add to payoutTransactions array
          merchant.payoutTransactions.push(payout._id);

          // Add to recentTransactions
          const newPayout = {
            transactionId: payout.transactionId || payout.utr,
            type: 'payout',
            transactionType: payout.transactionType,
            amount: payout.amount,
            status: payout.status,
            reference: payout.utr,
            method: payout.paymentMode,
            remark: payout.remark || 'Payout Processed',
            date: payout.createdAt,
            customer: 'N/A'
          };

          merchant.recentTransactions.unshift(newPayout);

          // Update balance if successful
          if (payout.status === 'Success') {
            if (payout.transactionType === 'Debit') {
              merchant.availableBalance -= payout.amount;
              merchant.totalDebits += payout.amount;
            } else if (payout.transactionType === 'Credit') {
              merchant.availableBalance += payout.amount;
              merchant.totalCredits += payout.amount;
            }
          }

          totalSynced++;
        }

        // Keep only last 20 recent transactions
        if (merchant.recentTransactions.length > 20) {
          merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
        }

        // Calculate net earnings
        merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;

        await merchant.save();
        console.log(`✅ Synced merchant: ${merchant.merchantName}`);
        console.log(`   💰 Balance: ${merchant.availableBalance}`);
        console.log(`   📈 Credits: ${merchant.totalCredits}, Debits: ${merchant.totalDebits}`);
        console.log(`   🔢 Transactions: ${merchant.totalTransactions}`);

      } catch (merchantError) {
        console.error(`❌ Error syncing merchant ${merchant.merchantName}:`, merchantError);
      }
    }

    console.log(`\n🎉 MANUAL SYNC COMPLETED!`);
    console.log(`✅ Total transactions synced: ${totalSynced}`);
    console.log(`✅ Total merchants processed: ${merchants.length}`);

    res.status(200).json({
      success: true,
      message: `Manual sync completed successfully!`,
      data: {
        totalTransactionsSynced: totalSynced,
        totalMerchantsProcessed: merchants.length,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error in manual sync:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during manual sync',
      error: error.message
    });
  }
};

// Sync for specific merchant
export const syncMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log(`🔄 Manual syncing transactions for merchant: ${merchantId}`);

    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    const merchant = await Merchant.findOne({ userId: merchantId });
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    let syncedCount = 0;

    // Sync payment transactions
    const paymentTransactions = await Transaction.find({ merchantId: merchantId });
    for (const transaction of paymentTransactions) {
      try {
        // Reset and add to arrays
        if (!merchant.paymentTransactions.includes(transaction._id)) {
          merchant.paymentTransactions.push(transaction._id);
        }

        // Add to recentTransactions
        const newTransaction = {
          transactionId: transaction.transactionId,
          type: 'payment',
          transactionType: 'Credit',
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.merchantOrderId,
          method: transaction.paymentMethod,
          remark: 'Payment Received',
          date: transaction.createdAt,
          customer: transaction.customerName || 'N/A'
        };

        // Check if already exists in recentTransactions
        const exists = merchant.recentTransactions.find(
          rt => rt.transactionId === transaction.transactionId
        );
        
        if (!exists) {
          merchant.recentTransactions.unshift(newTransaction);
        }

        // Update balance if successful
        if (transaction.status === 'SUCCESS' || transaction.status === 'Success') {
          merchant.availableBalance += transaction.amount;
          merchant.totalCredits += transaction.amount;
        }

        syncedCount++;
      } catch (syncError) {
        console.error(`❌ Error syncing transaction ${transaction._id}:`, syncError);
      }
    }

    // Sync payout transactions
    const payoutTransactions = await PayoutTransaction.find({ merchantId: merchantId });
    for (const payout of payoutTransactions) {
      try {
        if (!merchant.payoutTransactions.includes(payout._id)) {
          merchant.payoutTransactions.push(payout._id);
        }

        const newPayout = {
          transactionId: payout.transactionId || payout.utr,
          type: 'payout',
          transactionType: payout.transactionType,
          amount: payout.amount,
          status: payout.status,
          reference: payout.utr,
          method: payout.paymentMode,
          remark: payout.remark || 'Payout Processed',
          date: payout.createdAt,
          customer: 'N/A'
        };

        const exists = merchant.recentTransactions.find(
          rt => rt.transactionId === (payout.transactionId || payout.utr)
        );
        
        if (!exists) {
          merchant.recentTransactions.unshift(newPayout);
        }

        // Update balance if successful
        if (payout.status === 'Success') {
          if (payout.transactionType === 'Debit') {
            merchant.availableBalance -= payout.amount;
            merchant.totalDebits += payout.amount;
          } else if (payout.transactionType === 'Credit') {
            merchant.availableBalance += payout.amount;
            merchant.totalCredits += payout.amount;
          }
        }

        syncedCount++;
      } catch (syncError) {
        console.error(`❌ Error syncing payout ${payout._id}:`, syncError);
      }
    }

    // Keep only last 20 recent transactions
    if (merchant.recentTransactions.length > 20) {
      merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
    }

    // Update counts and earnings
    merchant.totalTransactions = merchant.paymentTransactions.length;
    merchant.successfulTransactions = merchant.paymentTransactions.length; // Simplified
    merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;

    await merchant.save();

    console.log(`✅ Manually synced ${syncedCount} transactions for merchant: ${merchant.merchantName}`);

    res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedCount} transactions`,
      data: {
        merchantName: merchant.merchantName,
        syncedCount: syncedCount,
        balance: merchant.availableBalance,
        credits: merchant.totalCredits,
        debits: merchant.totalDebits,
        netEarnings: merchant.netEarnings
      }
    });

  } catch (error) {
    console.error('❌ Error in manual merchant sync:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while syncing merchant transactions',
      error: error.message
    });
  }
};
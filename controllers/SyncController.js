// controllers/syncController.js
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Sync all transactions for a merchant
export const syncMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('🔄 Syncing transactions for merchant:', merchantId);

    // Validate merchantId
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    // Find unsynced transactions and sync them
    const unsyncedTransactions = await Transaction.find({
      merchantId: merchantId,
      synced: { $ne: true } // Add a synced field to track sync status
    });

    let syncedCount = 0;

    // Sync each transaction
    for (const transaction of unsyncedTransactions) {
      try {
        const merchant = await Merchant.findOne({ userId: merchantId });
        
        if (merchant) {
          // Add to paymentTransactions array if not already present
          if (!merchant.paymentTransactions.includes(transaction._id)) {
            merchant.paymentTransactions.push(transaction._id);
          }

          // Update recentTransactions array
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
          
          // Keep only last 20 transactions
          if (merchant.recentTransactions.length > 20) {
            merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
          }

          // Update balance if transaction is successful
          if (transaction.status === 'SUCCESS' || transaction.status === 'Success') {
            merchant.availableBalance += transaction.amount;
            merchant.totalCredits += transaction.amount;
            merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;
            
            // Also update user balance
            await User.findByIdAndUpdate(merchantId, {
              $inc: { balance: transaction.amount }
            });
          }

          // Update transaction counts
          merchant.totalTransactions = merchant.paymentTransactions.length;
          merchant.successfulTransactions = merchant.paymentTransactions.filter(
            txnId => txnId.status === 'SUCCESS' || txnId.status === 'Success'
          ).length;

          await merchant.save();

          // Mark transaction as synced
          transaction.synced = true;
          await transaction.save();

          syncedCount++;
        }
      } catch (syncError) {
        console.error(`❌ Error syncing transaction ${transaction._id}:`, syncError);
      }
    }

    console.log(`✅ Synced ${syncedCount} transactions for merchant: ${merchantId}`);

    res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedCount} transactions`,
      syncedCount: syncedCount
    });

  } catch (error) {
    console.error('❌ Error syncing merchant transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while syncing transactions',
      error: error.message
    });
  }
};
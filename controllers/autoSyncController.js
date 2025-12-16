// controllers/autoSyncController.js
import Merchant from "../models/Merchant.js";
import Transaction from "../models/Transaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import User from "../models/User.js";

// Sync all existing transactions for all merchants
export const syncAllExistingTransactions = async (req, res) => {
  try {
    // console.log("🔄 Starting sync of all existing transactions...");

    const merchants = await Merchant.find({});
    let totalSynced = 0;
    let results = [];

    for (const merchant of merchants) {
      try {
        // console.log(`🔄 Syncing transactions for merchant: ${merchant.merchantName}`);

        // Use the model method to sync transactions
        const syncResult = await merchant.syncTransactions();

        if (syncResult.success) {
          const paymentCount = merchant.paymentTransactions?.length || 0;
          const payoutCount = merchant.payoutTransactions?.length || 0;
          totalSynced += paymentCount + payoutCount;

          results.push({
            merchantId: merchant._id,
            merchantName: merchant.merchantName,
            payments: paymentCount,
            payouts: payoutCount,
            status: "success",
          });

          // console.log(
          //   `✅ Synced ${paymentCount} payments + ${payoutCount} payouts for ${merchant.merchantName}`
          // );
        } else {
          results.push({
            merchantId: merchant._id,
            merchantName: merchant.merchantName,
            status: "failed",
            error: syncResult.message,
          });
        }
      } catch (merchantError) {
        console.error(
          `❌ Error syncing merchant ${merchant.merchantName}:`,
          merchantError
        );
        results.push({
          merchantId: merchant._id,
          merchantName: merchant.merchantName,
          status: "failed",
          error: merchantError.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Sync completed. Processed ${merchants.length} merchants, ${totalSynced} total transactions`,
      data: {
        totalMerchants: merchants.length,
        totalTransactions: totalSynced,
        results: results,
      },
    });
  } catch (error) {
    console.error("❌ Error syncing all transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error syncing transactions",
      error: error.message,
    });
  }
};

// Sync transactions for a single merchant
export const syncMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // console.log(
    //   `🔄 Syncing transactions for merchant: ${merchant.merchantName}`
    // );

    // Use the model method to sync transactions
    const syncResult = await merchant.syncTransactions();

    if (syncResult.success) {
      res.status(200).json({
        success: true,
        message: `Successfully synced ${
          merchant.paymentTransactions?.length || 0
        } payments and ${merchant.payoutTransactions?.length || 0} payouts`,
        data: {
          merchantId: merchant._id,
          merchantName: merchant.merchantName,
          paymentCount: merchant.paymentTransactions?.length || 0,
          payoutCount: merchant.payoutTransactions?.length || 0,
          totalTransactions: merchant.totalTransactions,
          availableBalance: merchant.availableBalance,
          totalCredits: merchant.totalCredits,
          totalDebits: merchant.totalDebits,
          netEarnings: merchant.netEarnings,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: syncResult.message,
      });
    }
  } catch (error) {
    console.error("❌ Error syncing merchant transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error syncing merchant transactions",
      error: error.message,
    });
  }
};

// Add transaction to merchant (for auto-sync when new transaction is created)
export const addTransactionToMerchant = async (
  merchantUserId,
  transactionData,
  type
) => {
  try {
    const merchant = await Merchant.findOne({ userId: merchantUserId });
    if (!merchant) {
      // console.log("❌ Merchant not found for auto-sync");
      return { success: false, message: "Merchant not found" };
    }

    // Use the model method to add transaction
    const result = await merchant.addTransaction(transactionData, type);

    if (result.success) {
      // console.log(
      //   `✅ Auto-added ${type} transaction for merchant: ${merchant.merchantName}`
      // );
    }

    return result;
  } catch (error) {
    console.error("❌ Error in auto-sync:", error);
    return { success: false, message: error.message };
  }
};

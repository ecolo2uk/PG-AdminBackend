// controllers/transactionSyncController.js
import Merchant from "../models/Merchant.js";
import Transaction from "../models/Transaction.js";
import PayoutTransaction from "../models/PayoutTransaction.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// FIXED VERSION - transactionSyncController.js
export const autoSyncTransaction = async (
  merchantUserId,
  transaction,
  type,
  oldStatus = null
) => {
  try {
    // console.log(`🔄 Auto-syncing ${type} transaction: ${transaction.transactionId}`);
    // console.log(`   Status: ${transaction.status}, Amount: ${transaction.amount}`);

    const merchant = await Merchant.findOne({ userId: merchantUserId });
    if (!merchant) {
      console.log("❌ Merchant not found for auto-sync");
      return;
    }

    // 1. Add to transaction references
    if (type === "payment") {
      if (!merchant.paymentTransactions.includes(transaction._id)) {
        merchant.paymentTransactions.push(transaction._id);
        merchant.totalTransactions = (merchant.totalTransactions || 0) + 1;
      }
    } else if (type === "payout") {
      if (!merchant.payoutTransactions.includes(transaction._id)) {
        merchant.payoutTransactions.push(transaction._id);
      }
    }

    // 2. Add to recent transactions
    const existingRecentIndex = merchant.recentTransactions.findIndex(
      (rt) => rt.transactionId === transaction.transactionId
    );

    const newTransaction = {
      transactionId: transaction.transactionId,
      type: type,
      transactionType:
        type === "payment" ? "Credit" : transaction.transactionType,
      amount: transaction.amount,
      status: transaction.status,
      reference:
        type === "payment"
          ? transaction.merchantOrderId || transaction.txnRefId
          : transaction.utr,
      method:
        type === "payment"
          ? transaction.paymentMethod
          : transaction.paymentMode,
      remark:
        transaction.remark ||
        (type === "payment" ? "Payment Received" : "Payout Processed"),
      date: transaction.createdAt,
      customer: transaction.customerName || "N/A",
    };

    if (existingRecentIndex !== -1) {
      merchant.recentTransactions[existingRecentIndex] = newTransaction;
    } else {
      merchant.recentTransactions.unshift(newTransaction);
      if (merchant.recentTransactions.length > 20) {
        merchant.recentTransactions = merchant.recentTransactions.slice(0, 20);
      }
    }

    // 3. 🔥 CRITICAL FIX: Balance Update Logic
    const transactionAmount = transaction.amount;

    // For SUCCESSFUL PAYMENTS
    if (type === "payment") {
      // Check for SUCCESS status (all possible variations)
      const isSuccessful = [
        "SUCCESS",
        "Success",
        "SUCCESSFUL",
        "Successful",
        "COMPLETED",
        "Completed",
        "SETTLED",
        "Settled",
      ].includes(transaction.status);

      const wasSuccessful = oldStatus
        ? [
            "SUCCESS",
            "Success",
            "SUCCESSFUL",
            "Successful",
            "COMPLETED",
            "Completed",
            "SETTLED",
            "Settled",
          ].includes(oldStatus)
        : false;

      // console.log(
      //   `   💰 Payment Status Check: ${transaction.status} -> Successful: ${isSuccessful}`
      // );

      // If transaction became successful
      if (isSuccessful && !wasSuccessful) {
        merchant.availableBalance += transactionAmount;
        merchant.totalCredits += transactionAmount;

        // Also update user balance
        await User.findByIdAndUpdate(merchantUserId, {
          $inc: { balance: transactionAmount },
        });

        merchant.successfulTransactions =
          (merchant.successfulTransactions || 0) + 1;
        // console.log(`   ✅ ADDED BALANCE: +${transactionAmount}`);
      }

      // If transaction was successful but now failed/refunded
      else if (wasSuccessful && !isSuccessful) {
        merchant.availableBalance -= transactionAmount;
        merchant.totalCredits -= transactionAmount;

        await User.findByIdAndUpdate(merchantUserId, {
          $inc: { balance: -transactionAmount },
        });

        merchant.successfulTransactions = Math.max(
          0,
          (merchant.successfulTransactions || 0) - 1
        );
        // console.log(`   ❌ REMOVED BALANCE: -${transactionAmount}`);
      }

      // Count failed transactions
      if (
        ["FAILED", "Failed", "REJECTED", "Rejected"].includes(
          transaction.status
        )
      ) {
        merchant.failedTransactions = (merchant.failedTransactions || 0) + 1;
      }
    }

    // For PAYOUT TRANSACTIONS
    else if (type === "payout") {
      const isSuccessful = transaction.status === "Success";
      const wasSuccessful = oldStatus === "Success";

      if (isSuccessful && !wasSuccessful) {
        if (transaction.transactionType === "Debit") {
          merchant.availableBalance -= transactionAmount;
          merchant.totalDebits += transactionAmount;
          await User.findByIdAndUpdate(merchantUserId, {
            $inc: { balance: -transactionAmount },
          });
          // console.log(`   💸 DEBIT PAYOUT: -${transactionAmount}`);
        } else if (transaction.transactionType === "Credit") {
          merchant.availableBalance += transactionAmount;
          merchant.totalCredits += transactionAmount;
          await User.findByIdAndUpdate(merchantUserId, {
            $inc: { balance: transactionAmount },
          });
          // console.log(`   💰 CREDIT PAYOUT: +${transactionAmount}`);
        }
      }
    }

    // 4. Update net earnings
    merchant.netEarnings =
      (merchant.totalCredits || 0) - (merchant.totalDebits || 0);

    await merchant.save();

    // console.log(`✅ Auto-sync completed for: ${merchant.merchantName}`);
    // console.log(`   📊 New Balance: ${merchant.availableBalance}`);
    // console.log(
    //   `   📈 Credits: ${merchant.totalCredits}, Debits: ${merchant.totalDebits}`
    // );
  } catch (error) {
    console.error(
      `❌ Error in auto-sync for transaction ${transaction.transactionId}:`,
      error
    );
  }
};

// 🔥 NEW: Manual Sync for ALL Existing Transactions
export const syncAllExistingTransactions = async (req, res) => {
  try {
    // console.log("🔄 Starting manual sync for ALL existing transactions...");

    // Get all merchants
    const merchants = await Merchant.find({});
    // console.log(`📊 Found ${merchants.length} merchants`);

    let totalSynced = 0;

    for (const merchant of merchants) {
      try {
        // console.log(
        //   `\n🔄 Syncing transactions for merchant: ${merchant.merchantName}`
        // );

        // Get all transactions for this merchant
        const paymentTransactions = await Transaction.find({
          merchantId: merchant.userId,
        });

        const payoutTransactions = await PayoutTransaction.find({
          merchantId: merchant.userId,
        });

        // console.log(
        //   `   📥 Found ${paymentTransactions.length} payment transactions`
        // );
        // console.log(
        //   `   📥 Found ${payoutTransactions.length} payout transactions`
        // );

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
            type: "payment",
            transactionType: "Credit",
            amount: transaction.amount,
            status: transaction.status,
            reference: transaction.merchantOrderId,
            method: transaction.paymentMethod,
            remark: "Payment Received",
            date: transaction.createdAt,
            customer: transaction.customerName || "N/A",
          };

          merchant.recentTransactions.unshift(newTransaction);

          // Update balance if successful
          if (
            transaction.status === "SUCCESS" ||
            transaction.status === "Success"
          ) {
            merchant.availableBalance += transaction.amount;
            merchant.totalCredits += transaction.amount;
            merchant.successfulTransactions += 1;
          } else if (
            transaction.status === "FAILED" ||
            transaction.status === "Failed"
          ) {
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
            type: "payout",
            transactionType: payout.transactionType,
            amount: payout.amount,
            status: payout.status,
            reference: payout.utr,
            method: payout.paymentMode,
            remark: payout.remark || "Payout Processed",
            date: payout.createdAt,
            customer: "N/A",
          };

          merchant.recentTransactions.unshift(newPayout);

          // Update balance if successful
          if (payout.status === "Success") {
            if (payout.transactionType === "Debit") {
              merchant.availableBalance -= payout.amount;
              merchant.totalDebits += payout.amount;
            } else if (payout.transactionType === "Credit") {
              merchant.availableBalance += payout.amount;
              merchant.totalCredits += payout.amount;
            }
          }

          totalSynced++;
        }

        // Keep only last 20 recent transactions
        if (merchant.recentTransactions.length > 20) {
          merchant.recentTransactions = merchant.recentTransactions.slice(
            0,
            20
          );
        }

        // Calculate net earnings
        merchant.netEarnings = merchant.totalCredits - merchant.totalDebits;

        await merchant.save();
        // console.log(`✅ Synced merchant: ${merchant.merchantName}`);
        // console.log(`   💰 Balance: ${merchant.availableBalance}`);
        // console.log(
        //   `   📈 Credits: ${merchant.totalCredits}, Debits: ${merchant.totalDebits}`
        // );
        // console.log(`   🔢 Transactions: ${merchant.totalTransactions}`);
      } catch (merchantError) {
        console.error(
          `❌ Error syncing merchant ${merchant.merchantName}:`,
          merchantError
        );
      }
    }

    // console.log(`\n🎉 MANUAL SYNC COMPLETED!`);
    // console.log(`✅ Total transactions synced: ${totalSynced}`);
    // console.log(`✅ Total merchants processed: ${merchants.length}`);

    res.status(200).json({
      success: true,
      message: `Manual sync completed successfully!`,
      data: {
        totalTransactionsSynced: totalSynced,
        totalMerchantsProcessed: merchants.length,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("❌ Error in manual sync:", error);
    res.status(500).json({
      success: false,
      message: "Server error during manual sync",
      error: error.message,
    });
  }
};

// Sync for specific merchant
export const syncMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // console.log(`🔄 Manual syncing transactions for merchant: ${merchantId}`);

    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID",
      });
    }

    const merchant = await Merchant.findOne({ userId: merchantId });
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    let syncedCount = 0;

    // Sync payment transactions
    const paymentTransactions = await Transaction.find({
      merchantId: merchantId,
    });
    for (const transaction of paymentTransactions) {
      try {
        // Reset and add to arrays
        if (!merchant.paymentTransactions.includes(transaction._id)) {
          merchant.paymentTransactions.push(transaction._id);
        }

        // Add to recentTransactions
        const newTransaction = {
          transactionId: transaction.transactionId,
          type: "payment",
          transactionType: "Credit",
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.merchantOrderId,
          method: transaction.paymentMethod,
          remark: "Payment Received",
          date: transaction.createdAt,
          customer: transaction.customerName || "N/A",
        };

        // Check if already exists in recentTransactions
        const exists = merchant.recentTransactions.find(
          (rt) => rt.transactionId === transaction.transactionId
        );

        if (!exists) {
          merchant.recentTransactions.unshift(newTransaction);
        }

        // Update balance if successful
        if (
          transaction.status === "SUCCESS" ||
          transaction.status === "Success"
        ) {
          merchant.availableBalance += transaction.amount;
          merchant.totalCredits += transaction.amount;
        }

        syncedCount++;
      } catch (syncError) {
        console.error(
          `❌ Error syncing transaction ${transaction._id}:`,
          syncError
        );
      }
    }

    // Sync payout transactions
    const payoutTransactions = await PayoutTransaction.find({
      merchantId: merchantId,
    });
    for (const payout of payoutTransactions) {
      try {
        if (!merchant.payoutTransactions.includes(payout._id)) {
          merchant.payoutTransactions.push(payout._id);
        }

        const newPayout = {
          transactionId: payout.transactionId || payout.utr,
          type: "payout",
          transactionType: payout.transactionType,
          amount: payout.amount,
          status: payout.status,
          reference: payout.utr,
          method: payout.paymentMode,
          remark: payout.remark || "Payout Processed",
          date: payout.createdAt,
          customer: "N/A",
        };

        const exists = merchant.recentTransactions.find(
          (rt) => rt.transactionId === (payout.transactionId || payout.utr)
        );

        if (!exists) {
          merchant.recentTransactions.unshift(newPayout);
        }

        // Update balance if successful
        if (payout.status === "Success") {
          if (payout.transactionType === "Debit") {
            merchant.availableBalance -= payout.amount;
            merchant.totalDebits += payout.amount;
          } else if (payout.transactionType === "Credit") {
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

    // console.log(
    //   `✅ Manually synced ${syncedCount} transactions for merchant: ${merchant.merchantName}`
    // );

    res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedCount} transactions`,
      data: {
        merchantName: merchant.merchantName,
        syncedCount: syncedCount,
        balance: merchant.availableBalance,
        credits: merchant.totalCredits,
        debits: merchant.totalDebits,
        netEarnings: merchant.netEarnings,
      },
    });
  } catch (error) {
    console.error("❌ Error in manual merchant sync:", error);
    res.status(500).json({
      success: false,
      message: "Server error while syncing merchant transactions",
      error: error.message,
    });
  }
};

// Temporary debugging route - Add this to check your transactions
export const debugTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .select("transactionId merchantId amount status merchantName createdAt")
      .limit(20)
      .sort({ createdAt: -1 });

    // console.log("🔍 RECENT TRANSACTIONS STATUS:");
    transactions.forEach((txn) => {
      // console.log(
      //   `📄 ${txn.transactionId}: ${txn.amount} | Status: ${txn.status} | Merchant: ${txn.merchantName}`
      // );
    });

    res.status(200).json({
      success: true,
      data: transactions,
      message: `Found ${transactions.length} transactions`,
    });
  } catch (error) {
    console.error("Error debugging transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this function to fix existing transactions
export const fixTransactionBalances = async (req, res) => {
  try {
    // console.log("🔄 Fixing transaction balances for ALL merchants...");

    const merchants = await Merchant.find({});
    let fixedCount = 0;

    for (const merchant of merchants) {
      try {
        // console.log(`\n🔧 Fixing balances for: ${merchant.merchantName}`);

        // Reset balances
        let newBalance = 0;
        let totalCredits = 0;
        let totalDebits = 0;
        let successfulCount = 0;
        let failedCount = 0;

        // Calculate from payment transactions
        const paymentTransactions = await Transaction.find({
          merchantId: merchant.userId,
        });

        for (const txn of paymentTransactions) {
          // Check if transaction is successful
          const isSuccessful = [
            "SUCCESS",
            "Success",
            "SUCCESSFUL",
            "Successful",
            "COMPLETED",
            "Completed",
            "SETTLED",
            "Settled",
          ].includes(txn.status);

          if (isSuccessful) {
            newBalance += txn.amount;
            totalCredits += txn.amount;
            successfulCount++;
            // console.log(
            //   `   ✅ ${txn.transactionId}: +${txn.amount} (${txn.status})`
            // );
          } else if (["FAILED", "Failed"].includes(txn.status)) {
            failedCount++;
          }
        }

        // Calculate from payout transactions
        const payoutTransactions = await PayoutTransaction.find({
          merchantId: merchant.userId,
        });

        for (const payout of payoutTransactions) {
          if (payout.status === "Success") {
            if (payout.transactionType === "Debit") {
              newBalance -= payout.amount;
              totalDebits += payout.amount;
              // console.log(
              //   `   💸 ${payout.transactionId}: -${payout.amount} (Payout)`
              // );
            } else if (payout.transactionType === "Credit") {
              newBalance += payout.amount;
              totalCredits += payout.amount;
              // console.log(
              //   `   💰 ${payout.transactionId}: +${payout.amount} (Credit)`
              // );
            }
          }
        }

        // Update merchant
        merchant.availableBalance = newBalance;
        merchant.totalCredits = totalCredits;
        merchant.totalDebits = totalDebits;
        merchant.netEarnings = totalCredits - totalDebits;
        merchant.successfulTransactions = successfulCount;
        merchant.failedTransactions = failedCount;
        merchant.totalTransactions = paymentTransactions.length;

        await merchant.save();

        // Also update user balance
        await User.findByIdAndUpdate(merchant.userId, {
          balance: newBalance,
        });

        // console.log(`   📊 Final Balance: ${newBalance}`);
        // console.log(`   📈 Credits: ${totalCredits}, Debits: ${totalDebits}`);
        fixedCount++;
      } catch (error) {
        console.error(
          `❌ Error fixing merchant ${merchant.merchantName}:`,
          error
        );
      }
    }

    // console.log(`\n🎉 BALANCE FIXING COMPLETED!`);
    // console.log(`✅ Fixed ${fixedCount} merchants`);

    res.status(200).json({
      success: true,
      message: `Balance fixing completed for ${fixedCount} merchants`,
      data: { fixedCount },
    });
  } catch (error) {
    console.error("❌ Error in balance fixing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

import mongoose from "mongoose";
const merchantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    merchantName: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    contact: {
      type: String,
      required: true,
    },
    mid: {
      type: String,
      required: true,
      unique: true,
    },

    // Financial Information
    availableBalance: {
      type: Number,
      default: 0,
    },
    blockedBalance: {
      type: Number,
      default: 0,
    },
    unsettledBalance: {
      type: Number,
      default: 0,
    },
    totalCredits: {
      type: Number,
      default: 0,
    },
    totalDebits: {
      type: Number,
      default: 0,
    },
    netEarnings: {
      type: Number,
      default: 0,
    },
    totalLastNetPayIn: {
      type: Number,
      default: 0,
    },
    totalLastNetPayOut: {
      type: Number,
      default: 0,
    },

    // Bank Details
    bankDetails: {
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      accountType: {
        type: String,
        enum: ["Saving", "Current"],
      },
    },

    // Status
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },

    // Statistics
    totalTransactions: {
      type: Number,
      default: 0,
    },
    successfulTransactions: {
      type: Number,
      default: 0,
    },
    // pendingTransactions: {
    //   type: Number,
    //   default: 0,
    // },
    failedTransactions: {
      type: Number,
      default: 0,
    },

    // ✅ UPDATED: Transaction References for Auto-Sync
    payinTransactions: {
      type: Number,
      default: 0,
    },
    payoutTransactions: {
      type: Number,
      default: 0,
    },

    lastPayinTransactions: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    lastPayoutTransactions: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayoutTransaction",
    },

    lastLoginTime: {
      type: Date,
    },
    lastLogoutTime: {
      type: Date,
    },
    // Transactions Array for Recent Display
    // recentTransactions: {
    //   type: Number,
    //   default: 0,
    // },
    // // Daily/Weekly transaction summary
    // transactionSummary: {
    //   today: {
    //     credits: { type: Number, default: 0 },
    //     debits: { type: Number, default: 0 },
    //     count: { type: Number, default: 0 },
    //   },
    //   last7Days: {
    //     credits: { type: Number, default: 0 },
    //     debits: { type: Number, default: 0 },
    //     count: { type: Number, default: 0 },
    //   },
    //   last30Days: {
    //     credits: { type: Number, default: 0 },
    //     debits: { type: Number, default: 0 },
    //     count: { type: Number, default: 0 },
    //   },
    // },
  },
  {
    timestamps: true,
  }
);

// Update updatedAt on save
merchantSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

merchantSchema.pre("save", function (next) {
  // Auto-calculate net earnings
  this.netEarnings = (this.totalCredits || 0) - (this.totalDebits || 0);
  next();
});

merchantSchema.virtual("totalTransactionCount").get(function () {
  return (
    (this.payinTransactions?.length || 0) +
    (this.payoutTransactions?.length || 0)
  );
});

// merchantSchema.methods.syncTransactions = async function () {
//   try {
//     const Transaction = mongoose.model("Transaction");
//     const PayoutTransaction = mongoose.model("PayoutTransaction");

//     // Get all transactions for this merchant
//     const paymentTransactions = await Transaction.find({
//       merchantId: this.userId,
//     });
//     const payoutTransactions = await PayoutTransaction.find({
//       merchantId: this.userId,
//     });

//     // Update references
//     this.paymentTransactions = paymentTransactions.map((txn) => txn._id);
//     this.payoutTransactions = payoutTransactions.map((txn) => txn._id);

//     // Update recent transactions
//     const allTransactions = [
//       ...paymentTransactions.map((txn) => ({
//         transactionId: txn.transactionId,
//         type: "payment",
//         transactionType: "Credit",
//         amount: txn.amount,
//         status: txn.status,
//         reference: txn.merchantOrderId,
//         method: txn.paymentMethod,
//         remark: "Payment Received",
//         date: txn.createdAt,
//         customer: txn.customerName || "N/A",
//       })),
//       ...payoutTransactions.map((txn) => ({
//         transactionId: txn.transactionId || txn.utr,
//         type: "payout",
//         transactionType: txn.transactionType,
//         amount: txn.amount,
//         status: txn.status,
//         reference: txn.utr,
//         method: txn.paymentMode,
//         remark: txn.remark || "Payout Processed",
//         date: txn.createdAt,
//         customer: "N/A",
//       })),
//     ].sort((a, b) => new Date(b.date) - new Date(a.date));

//     this.recentTransactions = allTransactions.slice(0, 20);

//     // Update statistics
//     const successfulPayments = paymentTransactions.filter(
//       (txn) => txn.status === "SUCCESS" || txn.status === "Success"
//     );

//     this.totalTransactions = paymentTransactions.length;
//     this.successfulTransactions = successfulPayments.length;
//     this.failedTransactions =
//       paymentTransactions.length - successfulPayments.length;

//     await this.save();
//     return { success: true, message: "Transactions synced successfully" };
//   } catch (error) {
//     console.error("Error syncing transactions:", error);
//     return { success: false, message: error.message };
//   }
// };

// merchantSchema.methods.addTransaction = async function (transactionData, type) {
//   try {
//     const Transaction = mongoose.model("Transaction");
//     const PayoutTransaction = mongoose.model("PayoutTransaction");

//     if (type === "payment") {
//       const transaction = await Transaction.findById(transactionData._id);
//       if (transaction && !this.paymentTransactions.includes(transaction._id)) {
//         this.paymentTransactions.push(transaction._id);
//         if (
//           transaction.status === "SUCCESS" ||
//           transaction.status === "Success"
//         ) {
//           this.availableBalance += transaction.amount;
//           this.totalCredits += transaction.amount;
//         }
//       }
//     } else if (type === "payout") {
//       const payout = await PayoutTransaction.findById(transactionData._id);
//       if (payout && !this.payoutTransactions.includes(payout._id)) {
//         this.payoutTransactions.push(payout._id);

//         // Update balance if successful debit
//         if (payout.status === "Success" && payout.transactionType === "Debit") {
//           this.availableBalance -= payout.amount;
//           this.totalDebits += payout.amount;
//         }
//       }
//     }
//     const newTransaction = {
//       transactionId: transactionData.transactionId,
//       type: type,
//       transactionType:
//         type === "payment" ? "Credit" : transactionData.transactionType,
//       amount: transactionData.amount,
//       status: transactionData.status,
//       reference:
//         type === "payment"
//           ? transactionData.merchantOrderId
//           : transactionData.utr,
//       method:
//         type === "payment"
//           ? transactionData.paymentMethod
//           : transactionData.paymentMode,
//       remark:
//         transactionData.remark ||
//         (type === "payment" ? "Payment Received" : "Payout Processed"),
//       date: transactionData.createdAt || new Date(),
//       customer: transactionData.customerName || "N/A",
//     };

//     this.recentTransactions.unshift(newTransaction);
//     if (this.recentTransactions.length > 20) {
//       this.recentTransactions = this.recentTransactions.slice(0, 20);
//     }
//     await this.save();
//     return { success: true, message: "Transaction added successfully" };
//   } catch (error) {
//     console.error("Error adding transaction:", error);
//     return { success: false, message: error.message };
//   }
// };

const Merchant = mongoose.model("Merchant", merchantSchema);
export default Merchant;

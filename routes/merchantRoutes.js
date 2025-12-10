import express from "express";
import {
  getAllMerchants,
  getMerchantUsers,
  createMerchantUser,
  updateMerchantUser,
  deleteMerchantUser,
  getMerchantById,
  getMerchantDetails,
  updateMerchantBalance,
  getMerchantBalanceHistory,
  getMerchantWithTransactions,
  getMerchantTransactionStats,
  getMerchantDashboard,
  syncMerchantTransactions,
  getMerchantConnectors,
  debugRoutes,
  setMerchantTransactionLimit,
  changeMerchantPassword,
} from "../controllers/merchantController.js";

const router = express.Router();

// Merchant routes
router.get("/", getAllMerchants);
router.get("/users", getMerchantUsers);
router.post("/users", createMerchantUser);
router.put("/users/:id", updateMerchantUser);
router.put("/users/setLimit/:id", setMerchantTransactionLimit);
router.put("/users/changePassword/:id", changeMerchantPassword);
router.delete("/users/:id", deleteMerchantUser);
router.get("/users/:id", getMerchantById);

router.get("/:merchantId/connector-accounts", getMerchantConnectors);
router.get("/debug/:merchantId", debugRoutes);
router.get("/:merchantId", getMerchantDetails);
router.put("/:merchantId/balance", updateMerchantBalance);
router.get("/:merchantId/balance-history", getMerchantBalanceHistory);
router.get("/:merchantId/transactions", getMerchantWithTransactions);
router.get("/:merchantId/transaction-stats", getMerchantTransactionStats);
router.get("/:merchantId/dashboard", getMerchantDashboard);
router.post("/:merchantId/sync-transactions", syncMerchantTransactions);

export default router;

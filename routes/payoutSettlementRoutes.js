// routes/payoutSettlements.js - FIXED VERSION
import express from 'express';
import { 
    getMerchantsForSettlement, 
    createPayoutSettlement, 
    getSettlementHistory, 
    exportSettlementHistory 
} from '../controllers/payoutSettlementController.js';

const router = express.Router();

// Apply auth middleware to all routes
// import authMiddleware from '../middleware/authMiddleware.js';
// router.use(authMiddleware);

// Merchant Settlement Routes
router.get('/merchants', getMerchantsForSettlement);
router.post('/', createPayoutSettlement);
router.get('/history', getSettlementHistory); // ✅ Only one definition
router.get('/export', exportSettlementHistory);

export default router;
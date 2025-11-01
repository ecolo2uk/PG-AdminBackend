import express from 'express';
import { getMerchantsForSettlement, createPayoutSettlement } from '../controllers/payoutSettlementController.js';
// import { protect } from '../middleware/authMiddleware.js'; // If you have authentication

const router = express.Router();

router.get('/merchants', getMerchantsForSettlement);
router.post('/', createPayoutSettlement);

export default router;
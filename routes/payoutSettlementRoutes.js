
import express from 'express';
import { 
    getMerchantsForSettlement, 
    createPayoutSettlement, 
    getSettlementHistory, 
    exportSettlementHistory 
} from '../controllers/payoutSettlementController.js';

const router = express.Router();


router.get('/merchants', getMerchantsForSettlement);
router.post('/', createPayoutSettlement);
router.get('/history', getSettlementHistory); 
router.get('/export', exportSettlementHistory);

export default router;
import express from 'express';
import { 
    getMerchantsForSettlement, 
    createPayoutSettlement, 
    getSettlementHistory, 
    exportSettlementHistory 
} from '../controllers/payoutSettlementController.js';

const router = express.Router();

// Apply auth middleware to all routes (uncomment when ready)
// import authMiddleware from '../middleware/authMiddleware.js';
// router.use(authMiddleware);

// Merchant Settlement Routes
router.get('/merchants', getMerchantsForSettlement);
router.post('/', createPayoutSettlement);
router.get('/history', getSettlementHistory);
router.get('/export', exportSettlementHistory);
router.get('/history',  async (req, res) => {
    try {
        const { page = 1, limit = 10, merchantId, startDate, endDate } = req.query;
        
        // Your data fetching logic here
        const settlements = await SettlementHistory.find({ /* your query */ })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await SettlementHistory.countDocuments();
        
        res.json({
            success: true,
            data: settlements,
            pagination: {
                totalPages: Math.ceil(total / limit),
                totalResults: total,
                currentPage: page
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
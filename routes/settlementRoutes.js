import express from 'express';
import {
  getSettlementMerchants,
  processSettlement,
  getMerchantSettlementDetails,
  getAllSettlements,
  getSettlementById
} from '../controllers/settlementController.js';

const router = express.Router();

router.get('/merchants', getSettlementMerchants);
router.post('/process', processSettlement);
router.get('/merchant/:merchantId', getMerchantSettlementDetails);
router.get('/all', getAllSettlements);
router.get('/:settlementId', getSettlementById);

export default router;
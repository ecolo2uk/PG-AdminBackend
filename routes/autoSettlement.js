
import express from 'express';
import {
  createAutoSettlement,
  getAutoSettlements,
  getAutoSettlementById,
  updateAutoSettlement,
  deleteAutoSettlement,
  toggleStatus,
  triggerSettlement,
  getPayoutConnectors,
  getConnectorAccounts
} from '../controllers/autoSettlementController.js';

const router = express.Router();

router.post('/create',  createAutoSettlement);
router.get('/list',  getAutoSettlements);
router.get('/:id',  getAutoSettlementById);
router.put('/update/:id',  updateAutoSettlement);
router.delete('/delete/:id',  deleteAutoSettlement);
router.patch('/toggle-status/:id',  toggleStatus);
router.post('/trigger/:id',  triggerSettlement);

router.get('/connectors/payout-supported',  getPayoutConnectors);
router.get('/connector-accounts/:connectorId',  getConnectorAccounts);

export default router;
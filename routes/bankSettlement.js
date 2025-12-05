import express from 'express';
import {
  createBankSettlement,
  getBankSettlementHistory,
  getBankSettlementById,
  updateBankSettlement,
  deleteBankSettlement,
  getBankSettlementConnectors,
  getBankSettlementConnectorAccounts
} from '../controllers/bankSettlementController.js';

const router = express.Router();

router.post('/create', createBankSettlement);
router.get('/history', getBankSettlementHistory);
router.get('/:id', getBankSettlementById);
router.put('/:id', updateBankSettlement);
router.delete('/:id', deleteBankSettlement);
router.get('/connectors/list', getBankSettlementConnectors);
router.get('/connector-accounts/:connectorId', getBankSettlementConnectorAccounts);

export default router;
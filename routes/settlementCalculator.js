import express from 'express';
import {
  calculateSettlement,
  getCalculationHistory,
  getCalculationById,
  getCalculatorConnectors,
  getCalculatorConnectorAccounts
} from '../controllers/settlementCalculatorController.js';

const router = express.Router();

router.post('/calculate', calculateSettlement);
router.get('/history', getCalculationHistory);
router.get('/history/:id', getCalculationById);
router.get('/connectors', getCalculatorConnectors);
router.get('/connector-accounts/:connectorId', getCalculatorConnectorAccounts);

export default router;
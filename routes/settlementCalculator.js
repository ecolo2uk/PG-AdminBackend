// routes/settlementCalculator.js
import express from 'express';
import {
  calculateSettlement,
  getCalculationHistory,
  getCalculationById,
  getCalculatorConnectors,
  getCalculatorConnectorAccounts
} from '../controllers/settlementCalculatorController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(authenticate);

router.post('/calculate', calculateSettlement);
router.get('/history', getCalculationHistory);
router.get('/history/:id', getCalculationById);
router.get('/connectors', getCalculatorConnectors);
router.get('/connector-accounts/:connectorId', getCalculatorConnectorAccounts);

export default router;
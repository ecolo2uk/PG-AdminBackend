// backend/routes/connectorAccountRoutes.js
import express from 'express';
import {
    getConnectorAccountsByConnectorId,
    getConnectorAccountById,
    createConnectorAccount,
    updateConnectorAccount,
    deleteConnectorAccount,
    updateConnectorAccountStatus,
    updateConnectorAccountLimits
} from '../controllers/connectorAccountController.js'; // <--- ADDED .js HERE!

const router = express.Router();

// Routes for accounts under a specific connector
router.get('/connector/:connectorId', getConnectorAccountsByConnectorId);
router.post('/connector/:connectorId', createConnectorAccount); // Create account for a specific connector

// Routes for individual connector accounts
router.get('/:id', getConnectorAccountById);
router.put('/:id', updateConnectorAccount);
router.delete('/:id', deleteConnectorAccount);
router.patch('/:id/status', updateConnectorAccountStatus); // Update account status
router.patch('/:id/limits', updateConnectorAccountLimits); // Update account limits

export default router;
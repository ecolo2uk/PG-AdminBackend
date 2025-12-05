import express from 'express';
import {
    getConnectorAccountsByConnectorId,
    getConnectorAccountById,
    createConnectorAccount,
    updateConnectorAccount,
    deleteConnectorAccount,
    updateConnectorAccountStatus,
    updateConnectorAccountLimits
} from '../controllers/connectorAccountController.js'; 

const router = express.Router();

router.get('/connector/:connectorId', getConnectorAccountsByConnectorId);
router.post('/connector/:connectorId', createConnectorAccount); 

router.get('/:id', getConnectorAccountById);
router.put('/:id', updateConnectorAccount);
router.delete('/:id', deleteConnectorAccount);
router.patch('/:id/status', updateConnectorAccountStatus); 
router.patch('/:id/limits', updateConnectorAccountLimits); 
export default router;
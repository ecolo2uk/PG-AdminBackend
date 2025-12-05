import express from 'express';
import {
    getAllConnectors,
    getConnectorById,
    createConnector,
    updateConnector,
    deleteConnector,
    updateConnectorStatus
} from '../controllers/connectorController.js'; 

const router = express.Router();

router.get('/', getAllConnectors);
router.get('/:id', getConnectorById);
router.post('/', createConnector);
router.put('/:id', updateConnector);
router.delete('/:id', deleteConnector);
router.patch('/:id/status', updateConnectorStatus); 

export default router;
// backend/routes/connectorRoutes.js
import express from 'express';
import {
    getAllConnectors,
    getConnectorById,
    createConnector,
    updateConnector,
    deleteConnector,
    updateConnectorStatus
} from '../controllers/connectorController.js'; // <--- ADDED .js HERE!

const router = express.Router();

router.get('/', getAllConnectors);
router.get('/:id', getConnectorById);
router.post('/', createConnector);
router.put('/:id', updateConnector);
router.delete('/:id', deleteConnector);
router.patch('/:id/status', updateConnectorStatus); // For updating just the status

export default router;
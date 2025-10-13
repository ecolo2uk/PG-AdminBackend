import express from 'express';
import {
    createRequiredField,
    getAllRequiredFields,
    getRequiredFieldById,
    updateRequiredField,
    deleteRequiredField
} from '../controllers/requiredFieldController.js';

const router = express.Router();

router.post('/', createRequiredField);
router.get('/', getAllRequiredFields);
router.get('/:id', getRequiredFieldById);
router.put('/:id', updateRequiredField);
router.delete('/:id', deleteRequiredField);

export default router;
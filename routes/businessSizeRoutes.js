import express from 'express';
import {
  createBusinessSize,
  getAllBusinessSizes,
  getBusinessSizeById,
  updateBusinessSize,
  deleteBusinessSize,
} from '../controllers/businessSizeController.js';

const router = express.Router();

router.post('/', createBusinessSize);

router.get('/', getAllBusinessSizes);

router.get('/:id', getBusinessSizeById);
router.get('/:id', getBusinessSizeById);

router.put('/:id', updateBusinessSize);

router.delete('/:id', deleteBusinessSize);

export default router;
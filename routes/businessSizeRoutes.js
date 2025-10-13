// routes/businessSizeRoutes.js
import express from 'express';
import {
  createBusinessSize,
  getAllBusinessSizes,
  getBusinessSizeById,
  updateBusinessSize,
  deleteBusinessSize,
} from '../controllers/businessSizeController.js';

const router = express.Router();

// POST /api/business-sizes
router.post('/', createBusinessSize);

// GET /api/business-sizes
router.get('/', getAllBusinessSizes);

// GET /api/business-sizes/:id
router.get('/:id', getBusinessSizeById);

// PUT /api/business-sizes/:id
router.put('/:id', updateBusinessSize);

// DELETE /api/business-sizes/:id
router.delete('/:id', deleteBusinessSize);

export default router;
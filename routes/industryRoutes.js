import express from 'express';
import {
  getIndustries,
  getIndustryById,
  createIndustry,
  updateIndustry,
  deleteIndustry,
} from '../controllers/industryController.js';

const router = express.Router();

// Define industry routes
router.get('/', getIndustries);
router.get('/:id', getIndustryById);
router.post('/', createIndustry);
router.put('/:id', updateIndustry);
router.delete('/:id', deleteIndustry);

export default router;
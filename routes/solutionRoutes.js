// backend/routes/solutionRoutes.js
import express from 'express';
import {
  getSolutions,
  getSolutionById,
  createSolution,
  updateSolution,
  deleteSolution,
} from '../controllers/solutionController.js';

const router = express.Router();

router.route('/')
  .get(getSolutions)
  .post(createSolution);

router.route('/:id')
  .get(getSolutionById)
  .put(updateSolution)
  .delete(deleteSolution);

export default router;
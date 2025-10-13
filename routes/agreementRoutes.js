import express from 'express';
import {
  getAgreements,
  getAgreementById,
  createAgreement,
  updateAgreement,
  deleteAgreement,
} from '../controllers/agreementController.js';

const router = express.Router();

router.get('/', getAgreements);
router.get('/:id', getAgreementById);
router.post('/', createAgreement);
router.put('/:id', updateAgreement);
router.delete('/:id', deleteAgreement);

export default router;
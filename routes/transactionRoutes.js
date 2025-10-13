import express from 'express';
import {
  getAllTransactions,
  getTransactionById,
  getAllTransactionsSimple
} from '../controllers/transactionController.js';

const router = express.Router();

router.get('/', getAllTransactions);
router.get('/simple', getAllTransactionsSimple); // Simple version without pagination
router.get('/:id', getTransactionById);

// Comment out or remove these if you don't need them yet
// router.post('/', createTransaction);
// router.put('/:id', updateTransaction);
// router.delete('/:id', deleteTransaction);

export default router;
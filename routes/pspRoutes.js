import express from 'express';
const router = express.Router();

import {
  getPSPUsers,
  createPSPUser,
  updatePSPUser,
  deletePSPUser
} from '../controllers/pspController.js'; 


router.get('/users', getPSPUsers);


router.post('/users', createPSPUser);


router.put('/users/:id', updatePSPUser);

router.delete('/users/:id', deletePSPUser);

export default router;
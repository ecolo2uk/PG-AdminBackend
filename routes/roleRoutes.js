// roleRoutes.js
import express from 'express';
const router = express.Router();
import * as roleController from '../controllers/roleController.js';

router.post('/', roleController.createRole); // Used for creating the role
router.get('/', roleController.getRoles);
router.get('/:id', roleController.getRoleById);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

export default router;
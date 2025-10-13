// server\routes\adminauthRoutes.js
import express from 'express';
import { loginAdmin } from '../controllers/adminauthController.js';// Removed registerMerchant

const router = express.Router();

// Corrected route - remove the extra /login from the path
router.post("/login", loginAdmin); // This creates /api/admin/auth/login

export default router;
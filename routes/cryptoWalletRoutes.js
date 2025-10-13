import express from "express";
import {
  getWallets,
  getWalletById,
  createWallet,
  updateWallet,
  deleteWallet,
} from "../controllers/cryptoWalletController.js";

const router = express.Router();

router.route("/")
  .get(getWallets)
  .post(createWallet);

router.route("/:id")
  .get(getWalletById)
  .put(updateWallet)
  .delete(deleteWallet);

export default router;
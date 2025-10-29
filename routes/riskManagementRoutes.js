import express from "express";
import {
  createRisk,
  getAllRisks,
  getRiskById,
  updateRisk,
  deleteRisk,
  deleteAllRisks,
  bulkUploadRisks,
  downloadSampleFile
} from "../controllers/riskManagementController.js";
import { uploadCSV } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/create", createRisk);
router.get("/", getAllRisks);
router.get("/:id", getRiskById);
router.put("/:id", updateRisk);
router.delete("/:id", deleteRisk);
router.delete("/", deleteAllRisks);
router.post("/bulk-upload", bulkUploadRisks);
router.get("/download/sample", downloadSampleFile);

router.post("/bulk-upload", uploadCSV, bulkUploadRisks);

export default router;
import express from 'express';
import {
  getPlugins,
  getPluginById,
  createPlugin,
  updatePlugin,
  deletePlugin,
} from '../controllers/pluginController.js';

const router = express.Router();

router.route('/')
  .get(getPlugins)
  .post(createPlugin);

router.route('/:id')
  .get(getPluginById)
  .put(updatePlugin)
  .delete(deletePlugin);

export default router;
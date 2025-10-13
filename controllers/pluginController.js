import Plugin from '../models/pluginModel.js';

// @desc    Get all plugins
// @route   GET /api/plugins
// @access  Private (You'll want to add authentication/authorization middleware)
const getPlugins = async (req, res) => {
  try {
    const plugins = await Plugin.find({});
    res.status(200).json(plugins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single plugin by ID
// @route   GET /api/plugins/:id
// @access  Private
const getPluginById = async (req, res) => {
  try {
    const plugin = await Plugin.findById(req.params.id);
    if (plugin) {
      res.status(200).json(plugin);
    } else {
      res.status(404).json({ message: 'Plugin not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new plugin
// @route   POST /api/plugins
// @access  Private
const createPlugin = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  // Basic validation
  if (!name) {
    return res.status(400).json({ message: 'Plugin name is required' });
  }

  try {
    const pluginExists = await Plugin.findOne({ name });
    if (pluginExists) {
      return res.status(400).json({ message: 'Plugin with this name already exists' });
    }

    const plugin = await Plugin.create({
      name,
      iconClass,
      iconImage,
    });

    res.status(201).json(plugin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an existing plugin
// @route   PUT /api/plugins/:id
// @access  Private
const updatePlugin = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  try {
    const plugin = await Plugin.findById(req.params.id);

    if (plugin) {
      plugin.name = name || plugin.name;
      plugin.iconClass = iconClass !== undefined ? iconClass : plugin.iconClass; // Allow clearing
      plugin.iconImage = iconImage !== undefined ? iconImage : plugin.iconImage; // Allow clearing

      const updatedPlugin = await plugin.save();
      res.status(200).json(updatedPlugin);
    } else {
      res.status(404).json({ message: 'Plugin not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a plugin
// @route   DELETE /api/plugins/:id
// @access  Private
const deletePlugin = async (req, res) => {
  try {
    const plugin = await Plugin.findById(req.params.id);

    if (plugin) {
      await Plugin.deleteOne({ _id: req.params.id }); // Using deleteOne for Mongoose 6+
      res.status(200).json({ message: 'Plugin removed' });
    } else {
      res.status(404).json({ message: 'Plugin not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getPlugins,
  getPluginById,
  createPlugin,
  updatePlugin,
  deletePlugin,
};
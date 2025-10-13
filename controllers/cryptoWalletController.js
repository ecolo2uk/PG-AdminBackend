import CryptoWallet from "../models/cryptoWalletModel.js";

export const getWallets = async (req, res) => {
  try {
    const wallets = await CryptoWallet.find({});
    res.status(200).json(wallets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletById = async (req, res) => {
  try {
    const wallet = await CryptoWallet.findById(req.params.id);
    if (wallet) {
      res.status(200).json(wallet);
    } else {
      res.status(404).json({ message: "Crypto wallet not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createWallet = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const newWallet = new CryptoWallet({
      name,
      iconClass,
      iconImage,
    });

    const createdWallet = await newWallet.save();
    res.status(201).json(createdWallet);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Crypto wallet with this name already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateWallet = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  try {
    const wallet = await CryptoWallet.findById(req.params.id);

    if (wallet) {
      wallet.name = name || wallet.name;
      wallet.iconClass = iconClass !== undefined ? iconClass : wallet.iconClass;
      wallet.iconImage = iconImage !== undefined ? iconImage : wallet.iconImage;

      const updatedWallet = await wallet.save();
      res.status(200).json(updatedWallet);
    } else {
      res.status(404).json({ message: "Crypto wallet not found" });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Crypto wallet with this name already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteWallet = async (req, res) => {
  try {
    const wallet = await CryptoWallet.findById(req.params.id);

    if (wallet) {
      await CryptoWallet.deleteOne({ _id: req.params.id });
      res.status(200).json({ message: "Crypto wallet removed" });
    } else {
      res.status(404).json({ message: "Crypto wallet not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
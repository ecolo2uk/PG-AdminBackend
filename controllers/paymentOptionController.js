import PaymentOption from "../models/PaymentOption.js";

// Get all payment options
export const getAllPaymentOptions = async (req, res) => {
  try {
    const paymentOptions = await PaymentOption.find({ status: "Active" });
    // console.log(paymentOptions);
    res.status(200).json(paymentOptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single payment option by ID
export const getPaymentOptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentOption = await PaymentOption.findById(id);
    if (!paymentOption) {
      return res.status(404).json({ message: "Payment option not found" });
    }
    res.status(200).json(paymentOption);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new payment option
export const createPaymentOption = async (req, res) => {
  try {
    const { name, iconClass, iconImage } = req.body;

    const newPaymentOption = new PaymentOption({
      name,
      iconClass,
      iconImage,
    });

    const savedPaymentOption = await newPaymentOption.save();
    res.status(201).json(savedPaymentOption);
  } catch (error) {
    // Handle unique name constraint error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      return res
        .status(400)
        .json({ message: "Payment option with this name already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update a payment option by ID
export const updatePaymentOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, iconClass, iconImage } = req.body;

    const updatedPaymentOption = await PaymentOption.findByIdAndUpdate(
      id,
      { name, iconClass, iconImage },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedPaymentOption) {
      return res.status(404).json({ message: "Payment option not found" });
    }
    res.status(200).json(updatedPaymentOption);
  } catch (error) {
    // Handle unique name constraint error during update
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      return res
        .status(400)
        .json({ message: "Payment option with this name already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete a payment option by ID
export const deletePaymentOption = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPaymentOption = await PaymentOption.findById(id);

    if (!deletedPaymentOption) {
      return res.status(404).json({ message: "Payment option not found" });
    }
    const updatePaymentOption = await PaymentOption.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "Inactive",
        },
      },
      {
        new: true,
      }
    );
    res.status(200).json({ message: "Payment option deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

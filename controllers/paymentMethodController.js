import PaymentMethod from "../models/PaymentMethod.js";

// Get all payment methods
export const getAllPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ status: "Active" });
    res.status(200).json(paymentMethods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single payment method by ID
export const getPaymentMethodById = async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    res.status(200).json(paymentMethod);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new payment method
export const createPaymentMethod = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;
  const newPaymentMethod = new PaymentMethod({ name, iconClass, iconImage });

  try {
    await newPaymentMethod.save();
    res.status(201).json(newPaymentMethod);
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ message: "Payment method with this name already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

// Update a payment method
export const updatePaymentMethod = async (req, res) => {
  const { id } = req.params;
  const { name, iconClass, iconImage } = req.body;

  try {
    const updatedPaymentMethod = await PaymentMethod.findByIdAndUpdate(
      id,
      { name, iconClass, iconImage },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedPaymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    res.status(200).json(updatedPaymentMethod);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Payment method with this name already exists" });
    }
    res.status(400).json({ message: error.message });
  }
};

// Delete a payment method
export const deletePaymentMethod = async (req, res) => {
  try {
    const deletedPaymentMethod = await PaymentMethod.findById(req.params.id);
    if (!deletedPaymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    const updatePaymentMethod = await PaymentMethod.findByIdAndUpdate(
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
    res.status(200).json({ message: "Payment method deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

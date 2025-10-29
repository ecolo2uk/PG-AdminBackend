import RiskManagement from "../models/RiskManagement.js";

// Create single risk
export const createRisk = async (req, res) => {
  try {
    const { riskType, riskValue, email, upi, userId } = req.body;

    const riskData = {
      riskType,
      riskValue,
      ...(email && { email }),
      ...(upi && { upi }),
      ...(userId && { userId })
    };

    const risk = new RiskManagement(riskData);
    await risk.save();

    res.status(201).json({
      success: true,
      message: "Risk created successfully",
      data: risk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating risk",
      error: error.message
    });
  }
};

// Get all risks
export const getAllRisks = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const risks = await RiskManagement.find()
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RiskManagement.countDocuments();

    res.status(200).json({
      success: true,
      data: risks || [],
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error("Error fetching risks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching risks",
      error: error.message,
      data: []
    });
  }
};

// Get risk by ID
export const getRiskById = async (req, res) => {
  try {
    const risk = await RiskManagement.findById(req.params.id);
    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "Risk not found"
      });
    }

    res.status(200).json({
      success: true,
      data: risk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching risk",
      error: error.message
    });
  }
};

// Update risk
export const updateRisk = async (req, res) => {
  try {
    const risk = await RiskManagement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "Risk not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Risk updated successfully",
      data: risk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating risk",
      error: error.message
    });
  }
};

// Delete risk
export const deleteRisk = async (req, res) => {
  try {
    const risk = await RiskManagement.findByIdAndDelete(req.params.id);

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "Risk not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Risk deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting risk",
      error: error.message
    });
  }
};

// Delete all risks
export const deleteAllRisks = async (req, res) => {
  try {
    await RiskManagement.deleteMany({});
    
    res.status(200).json({
      success: true,
      message: "All risks deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting all risks",
      error: error.message
    });
  }
};

// Bulk upload risks from CSV
export const bulkUploadRisks = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const csvData = req.file.buffer.toString();
    const lines = csvData.split('\n');
    const results = [];
    const errors = [];

    // Skip empty files
    if (lines.length <= 1) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty"
      });
    }

    // Get headers
    const headers = lines[0].split(',').map(header => header.trim());
    
    // Validate headers
    const requiredHeaders = ['Risk Type', 'Risk Value'];
    const missingHeaders = requiredHeaders.filter(header => 
      !headers.includes(header)
    );

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required headers: ${missingHeaders.join(', ')}`
      });
    }

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(value => value.trim());
      const rowData = {};

      // Map values to headers
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });

      // Validate required fields
      if (!rowData['Risk Type'] || !rowData['Risk Value']) {
        errors.push({
          row: i,
          error: "Missing required fields: Risk Type and Risk Value are required"
        });
        continue;
      }

      // Prepare risk data
      const riskData = {
        riskType: rowData['Risk Type'],
        riskValue: rowData['Risk Value']
      };

      // Add optional fields if present
      if (rowData['Email']) riskData.email = rowData['Email'];
      if (rowData['UPI']) riskData.upi = rowData['UPI'];
      if (rowData['USER_ID']) riskData.userId = rowData['USER_ID'];

      results.push(riskData);
    }

    // Insert valid records
    if (results.length > 0) {
      await RiskManagement.insertMany(results, { ordered: false });
    }

    res.status(200).json({
      success: true,
      message: `Bulk upload completed. ${results.length} records imported successfully. ${errors.length} records failed.`,
      imported: results.length,
      failed: errors.length,
      errors: errors
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing bulk upload",
      error: error.message
    });
  }
};

// Download sample CSV file
export const downloadSampleFile = async (req, res) => {
  try {
    const sampleData = `Risk Type,Risk Value,Email,UPI,USER_ID
Email,test@gmail.com,,,
UPI,anandpatel@oksbi,,,
USER_ID,USER123,,,
Transaction,High Risk Transaction,,,
IP,192.168.1.1,,,
Country,US,,,`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=risk_management_sample.csv");
    res.send(sampleData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error downloading sample file",
      error: error.message
    });
  }
};
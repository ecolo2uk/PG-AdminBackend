import axios from "axios";

export const extractIntegrationKeys = (connectorAccount) => {
  console.log("🔍 Extracting integration keys from:", {
    hasIntegrationKeys: !!connectorAccount?.integrationKeys,
    hasConnectorAccountId:
      !!connectorAccount?.connectorAccount?.integrationKeys,
    connectorAccount: connectorAccount?.connectorAccount?._id,
  });

  let integrationKeys = {};

  // ✅ Check multiple possible locations for integration keys
  if (
    connectorAccount?.integrationKeys &&
    Object.keys(connectorAccount.integrationKeys).length > 0
  ) {
    // console.log("🎯 Found keys in connectorAccount.integrationKeys");
    integrationKeys = connectorAccount.integrationKeys;
  } else if (
    connectorAccount?.connectorAccount?.integrationKeys &&
    Object.keys(connectorAccount.connectorAccount.integrationKeys).length > 0
  ) {
    // console.log(
    //   "🎯 Found keys in connectorAccount.connectorAccount.integrationKeys"
    // );
    integrationKeys = connectorAccount.connectorAccount.integrationKeys;
  } else {
    console.log("⚠️ No integration keys found in standard locations");
  }

  // ✅ Convert if it's a Map or special object
  if (integrationKeys instanceof Map) {
    integrationKeys = Object.fromEntries(integrationKeys);
    // console.log("🔍 Converted Map to Object");
  } else if (typeof integrationKeys === "string") {
    try {
      integrationKeys = JSON.parse(integrationKeys);
      // console.log("🔍 Parsed JSON string to Object");
    } catch (e) {
      console.error("❌ Failed to parse integrationKeys string:", e);
    }
  }

  // console.log("🎯 Extracted Keys:", Object.keys(integrationKeys));
  return integrationKeys;
};

export const encryptData = async (reqBody, connectorAccount) => {
  try {
    const keys = connectorAccount.extractedKeys || {};

    const encrypt_key = keys["encryption_key"];

    if (!encrypt_key) {
      throw new Error("Encryption key not found.");
    }
    // console.log("🔐 Req data:", reqBody);

    const response = await axios.post(
      "https://pg-rest-api.jodetx.com/v1/api/aes/generateEnc",
      reqBody,
      {
        headers: {
          "Content-Type": "application/json",
          apiKey: encrypt_key,
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    console.error(
      "❌ Encryption API Error:",
      err.response?.data || err.message
    );

    throw err || "Encryption error";
  }
};

export const decryptData = async (encData, connectorAccount) => {
  try {
    const keys = connectorAccount.extractedKeys || {};

    const encrypt_key = keys["encryption_key"];

    if (!encrypt_key) {
      throw new Error("Decryption key not found.");
    }

    // console.log("🔐 Enc data:", encData);

    if (!encData || typeof encData !== "string") {
      throw new Error("decData must be a string");
    }

    const payload = {
      encryptedData: encData,
    };

    // console.log("🔐 Decrypt payload:", payload);

    const response = await axios.post(
      "https://pg-rest-api.jodetx.com/v1/api/aes/decryptData",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apiKey: encrypt_key,
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    console.error(
      "❌ Decryption API Error:",
      err.response?.data || err.message
    );
    throw err || "Decryption error";
  }
};

export const payoutTransactionStatus = async (
  encryptedData,
  connectorAccount
) => {
  try {
    const keys = connectorAccount.extractedKeys || {};

    const header_key = keys["header_key"];

    if (!header_key) {
      throw new Error("Header key not found");
    }

    if (!encryptedData) {
      throw new Error("encryptedData is required");
    }
    // console.log("Data:", encryptedData);
    const requestParams = encryptedData;

    const response = await axios.post(
      "https://pg-rest-api.jodetx.com/v1/api/payout/transaction-status",
      {
        request: requestParams,
      },
      {
        headers: {
          token: header_key,
          "Content-Type": "application/json",
        },
      }
    );

    // console.log("Payout Status:", response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    console.error("❌ Payout Status Error:", err.message);
    // return {
    //   success: false,
    //   error: err.message,
    // };
    throw err || "Payout Status Update Error";
  }
};

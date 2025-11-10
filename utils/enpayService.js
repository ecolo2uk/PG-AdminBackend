// utils/enpayService.js
import axios from 'axios';

export const initiateCollectRequest = async (paymentData) => {
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Key': '0851439b-03df-4983-88d6-32399b1e4514',
        'X-Merchant-Secret': 'bae97f533a594af9bf3dded47f09c34e15e053d1'
      },
      data: {
        "amount": paymentData.amount,
        "merchantHashId": paymentData.merchantHashId,
        "merchantOrderId": paymentData.merchantOrderId,
        "merchantTrnId": paymentData.merchantTrnId,
        "merchantVpa": paymentData.merchantVpa,
        "returnURL": paymentData.returnURL,
        "successURL": paymentData.successURL,
        "txnNote": paymentData.txnNote
      },
      timeout: 30000 // 30 seconds timeout
    });

    return response.data;
  } catch (error) {
    console.error('Enpay API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Enpay API call failed');
  }
};

// Add transaction status check function
export const checkTransactionStatus = async (merchantHashId, txnRefId) => {
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/transactionStatus',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Key': '0851439b-03df-4983-88d6-32399b1e4514',
        'X-Merchant-Secret': 'bae97f533a594af9bf3dded47f09c34e15e053d1'
      },
      data: {
        "merchantHashId": merchantHashId,
        "txnRefId": txnRefId
      },
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    console.error('Enpay Status Check Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Enpay status check failed');
  }
};
// utils/enpayService.js
import request from 'request';

export const initiateCollectRequest = async (paymentData) => {
  return new Promise((resolve, reject) => {
    const options = {
      'method': 'POST',
      'url': 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      'headers': {
        'Content-Type': 'application/json',
        'X-Merchant-Key': '0851439b-03df-4983-88d6-32399b1e4514',
        'X-Merchant-Secret': 'bae97f533a594af9bf3dded47f09c34e15e053d1'
      },
      body: JSON.stringify({
        "amount": paymentData.amount,
        "merchantHashId": paymentData.merchantHashId,
        "merchantOrderId": paymentData.merchantOrderId,
        "merchantTrnId": paymentData.merchantTrnId,
        "merchantVpa": paymentData.merchantVpa,
        "returnURL": paymentData.returnURL,
        "successURL": paymentData.successURL,
        "txnNote": paymentData.txnNote
      })
    };

    request(options, function (error, response) {
      if (error) {
        reject(new Error(error));
        return;
      }
      
      try {
        const responseBody = JSON.parse(response.body);
        resolve(responseBody);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
};
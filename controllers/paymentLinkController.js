import Transaction from '../models/Transaction.js';
import axios from 'axios';

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const generatePaymentLink = async (req, res) => {
  try {
    console.log('🔵 generatePaymentLink called with body:', req.body);

    const { merchantId, amount, currency = 'INR', paymentMethod, paymentOption } = req.body;

    // Validation
    if (!merchantId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Merchant ID and Amount are required'
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    if (amountNum < 500) {
      return res.status(400).json({
        success: false,
        message: 'Minimum amount should be at least 500 INR for Enpay'
      });
    }

    if (amountNum > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum amount cannot exceed 10,000 INR for Enpay'
      });
    }

    // Static merchant data
    const staticMerchants = [
      {
        _id: "MERCHANT001",
        firstname: "John",
        lastname: "Doe",
        mid: "MID123456",
        hashId: "MERCDSH51Y7CD4YJLFIZR8NF",
        vpa: "enpay1.skypal@fino"
      },
      {
        _id: "MERCHANT002",
        firstname: "Jane",
        lastname: "Smith",
        mid: "MID789012",
        hashId: "MERCDSH52Y8CD5YJLFIZR9NG",
        vpa: "enpay3.skypal@fino"
      }
    ];

    const merchant = staticMerchants.find(m => m._id === merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const merchantOrderId = `ORDER${timestamp}${randomSuffix}`;
    const merchantTrnId = `TRN${timestamp}${randomSuffix}`;
    const txnRefId = `TXN${timestamp}${randomSuffix}`;
    const formattedAmount = amountNum.toFixed(2);

    // Create transaction record with correct field names
    const transaction = new Transaction({
      transactionId: merchantTrnId,
      merchantOrderId: merchantOrderId,
      merchantHashId: merchant.hashId,
      merchantId: merchant._id, // String ID
      merchantName: `${merchant.firstname} ${merchant.lastname}`,
      amount: amountNum,
      currency: currency,
      status: 'Pending', // Note: Capital 'P' to match your document
      upiId: merchant.vpa,
      merchantVpa: merchant.vpa,
      txnRefId: txnRefId,
      txnNote: `Payment for Order ${merchantOrderId}`,
      paymentMethod: paymentMethod || 'UPI',
      paymentOption: paymentOption || '',
      source: 'enpay',
      isMock: false
    });

    await transaction.save();
    console.log('✅ Transaction saved as PENDING:', transaction.transactionId);

    // Enpay API request data
    const requestData = {
      "amount": formattedAmount,
      "merchantHashId": merchant.hashId,
      "merchantOrderId": merchantOrderId,
      "merchantTrnId": merchantTrnId,
      "merchantVpa": merchant.vpa,
      "returnURL": `${FRONTEND_BASE_URL}/payment-return?transactionId=${merchantTrnId}`,
      "successURL": `${FRONTEND_BASE_URL}/payment-success?transactionId=${merchantTrnId}`,
      "txnNote": `Payment for Order ${merchantOrderId}`
    };

    console.log('📤 Sending to Enpay API:', JSON.stringify(requestData, null, 2));

    // Enpay API options
    const options = {
      method: 'POST',
      url: 'https://api.enpay.in/enpay-product-service/api/v1/merchant-gateway/initiateCollectRequest',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Key': process.env.ENPAY_MERCHANT_KEY || '0851439b-03df-4983-88d6-32399b1e4514',
        'X-Merchant-Secret': process.env.ENPAY_MERCHANT_SECRET || 'bae97f533a594af9bf3dded47f09c34e15e053d1'
      },
      data: requestData,
      timeout: 30000
    };

    console.log('🔑 Using Merchant Key:', process.env.ENPAY_MERCHANT_KEY || '0851439b-03df-4983-88d6-32399b1e4514');

    try {
      const response = await axios(options);
      console.log('✅ Enpay API Response:', response.data);

      const enpayResponse = response.data;

      // Check for successful response
      if (enpayResponse.code === 200 || enpayResponse.status === 'SUCCESS' || enpayResponse.status === 'success') {
        
        // Extract the payment link from different possible response formats
        let paymentLink = '';
        
        if (enpayResponse.details && enpayResponse.details.includes('https://enpay.in')) {
          paymentLink = enpayResponse.details;
        } else if (enpayResponse.data && enpayResponse.data.paymentLink) {
          paymentLink = enpayResponse.data.paymentLink;
        } else if (enpayResponse.paymentLink) {
          paymentLink = enpayResponse.paymentLink;
        } else if (enpayResponse.data && enpayResponse.data.token) {
          paymentLink = `https://enpay.in/enpay/ui/pg?token=${enpayResponse.data.token}`;
        } else {
          throw new Error('No valid payment link found in response');
        }

        // Update transaction with Enpay transaction ID and payment URL
        await Transaction.findOneAndUpdate(
          { transactionId: merchantTrnId },
          {
            enpayTxnId: enpayResponse.data?.txnId || enpayResponse.txnId || merchantTrnId,
            paymentUrl: paymentLink,
            qrCode: paymentLink, // Set both paymentUrl and qrCode for consistency
            isMock: false
          }
        );

        console.log('🔗 Generated Real Payment Link:', paymentLink);

        return res.json({
          success: true,
          paymentLink: paymentLink,
          transactionRefId: merchantTrnId,
          merchantOrderId: merchantOrderId,
          isMock: false,
          message: 'Real payment link generated successfully'
        });

      } else {
        throw new Error(enpayResponse.message || 'Enpay API returned non-success status');
      }

    } catch (apiError) {
      console.error('❌ Enpay API error:', apiError.response?.data || apiError.message);
      
      // Create mock payment link
      const mockPaymentLink = `${FRONTEND_BASE_URL}/mock-payment?transactionId=${merchantTrnId}&amount=${amountNum}`;

      // Update transaction with mock data
      await Transaction.findOneAndUpdate(
        { transactionId: merchantTrnId },
        {
          isMock: true,
          enpayTxnId: `MOCK_TXN_${Date.now()}`,
          paymentUrl: mockPaymentLink,
          qrCode: mockPaymentLink
        }
      );

      console.log('🔄 Using mock payment as fallback');

      return res.json({
        success: true,
        paymentLink: mockPaymentLink,
        transactionRefId: merchantTrnId,
        merchantOrderId: merchantOrderId,
        isMock: true,
        message: 'Mock payment link generated (Enpay API unavailable)'
      });
    }

  } catch (error) {
    console.error('🔥 generatePaymentLink ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment link generation',
      error: error.message
    });
  }
};

// Update the success and return handlers to use the correct field names
export const handleSuccess = async (req, res) => {
  try {
    const { transactionId } = req.query;
    console.log('✅ Success callback called for transaction:', transactionId);

    if (transactionId) {
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId }, // Use transactionId field
        { status: 'SUCCESS' } // Use status field
      );
      console.log(`Transaction ${transactionId} updated to SUCCESS.`);
    }

    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=success&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Success callback error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-success?status=error`);
  }
};

export const handleReturn = async (req, res) => {
  try {
    const { transactionId, status } = req.query;
    console.log('↩️ Return callback called for transaction:', transactionId, 'with status:', status);

    if (transactionId) {
      let newStatus = 'FAILED';
      switch (status?.toLowerCase()) {
        case 'success':
          newStatus = 'SUCCESS';
          break;
        case 'failed':
          newStatus = 'FAILED';
          break;
        case 'cancelled':
          newStatus = 'CANCELLED';
          break;
        default:
          newStatus = 'FAILED';
      }

      await Transaction.findOneAndUpdate(
        { transactionId: transactionId }, // Use transactionId field
        { status: newStatus } // Use status field
      );
      console.log(`Transaction ${transactionId} updated to ${newStatus}.`);
    }

    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=${status || 'failed'}&transactionRefId=${transactionId || ''}`);
  } catch (error) {
    console.error('Return callback error:', error);
    res.redirect(`${FRONTEND_BASE_URL}/payment-return?status=error`);
  }
};

export const getMerchants = async (req, res) => {
  try {
    const staticMerchants = [
      {
        _id: "MERCHANT001",
        firstname: "John",
        lastname: "Doe",
        mid: "MID123456"
      },
      {
        _id: "MERCHANT002",
        firstname: "Jane",
        lastname: "Smith",
        mid: "MID789012"
      }
    ];

    res.json({
      success: true,
      merchants: staticMerchants
    });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching merchants',
      error: error.message
    });
  }
};
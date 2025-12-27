const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

console.log('\n=====================================');
console.log('🚀 DUITKU SANDBOX PAYMENT TEST');
console.log('=====================================');
console.log('Merchant Code:', process.env.DUITKU_MERCHANT_CODE);
console.log('Sandbox URL:', process.env.DUITKU_SANDBOX_URL);
console.log('=====================================\n');

// ============================================
// ENDPOINT 1: CREATE INVOICE (MEMBUAT TRANSAKSI)
// ============================================
app.post('/api/create-invoice', async (req, res) => {
  try {
    const {
      merchantOrderId,
      paymentAmount,
      paymentMethod = 'VC',
      customerEmail,
      customerName,
      customerPhone,
      productDetails
    } = req.body;

    console.log('\n📝 REQUEST: CREATE INVOICE');
    console.log('----------------------------');
    console.log('Order ID:', merchantOrderId);
    console.log('Amount:', paymentAmount);
    console.log('Method:', paymentMethod);
    console.log('Customer:', customerName, '(' + customerEmail + ')');

    // Validasi
    if (!merchantOrderId || !paymentAmount || !customerEmail) {
      return res.status(400).json({
        error: 'merchantOrderId, paymentAmount, dan customerEmail wajib diisi'
      });
    }

    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;

    // Hitung Signature: MD5(merchantCode + merchantOrderId + paymentAmount + apiKey)
    const signatureString = merchantCode + merchantOrderId + paymentAmount + apiKey;
    const signature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex');

    console.log('Signature String:', signatureString);
    console.log('Signature:', signature);

    // Siapkan Payload
    const payload = {
      merchantCode: merchantCode,
      paymentAmount: paymentAmount,
      paymentMethod: paymentMethod,
      merchantOrderId: merchantOrderId,
      productDetails: productDetails || 'Test Product',
      additionalParam: '',
      merchantUserInfo: '',
      customerVaName: customerName || 'Customer',
      email: customerEmail,
      phoneNumber: customerPhone || '081234567890',
      itemDetails: [
        {
          name: 'Test Item',
          price: paymentAmount,
          quantity: 1
        }
      ],
      customerDetail: {
        firstName: customerName || 'Test',
        lastName: 'Customer',
        email: customerEmail,
        phoneNumber: customerPhone || '081234567890',
        billingAddress: {
          firstName: customerName || 'Test',
          lastName: 'Customer',
          address: 'Jl. Test',
          city: 'Jakarta',
          postalCode: '12345',
          countryCode: 'ID'
        }
      },
      callbackUrl: process.env.CALLBACK_URL,
      returnUrl: process.env.RETURN_URL,
      signature: signature,
      expiryPeriod: 10
    };

    console.log('\n📤 PAYLOAD DIKIRIM KE DUITKU:');
    console.log(JSON.stringify(payload, null, 2));

    // Kirim ke Duitku API
    const response = await axios.post(
      `${process.env.DUITKU_SANDBOX_URL}/v2/inquiry`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('\n✅ RESPONSE DARI DUITKU:');
    console.log(JSON.stringify(response.data, null, 2));

    res.json({
      success: true,
      message: 'Invoice created successfully',
      data: response.data,
      paymentUrl: response.data.paymentUrl,
      reference: response.data.reference,
      callbackUrl: process.env.CALLBACK_URL
    });

  } catch (error) {
    console.error('\n❌ ERROR CREATE INVOICE:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// ============================================
// ENDPOINT 2: CALLBACK ENDPOINT (TERIMA NOTIFIKASI)
// ============================================
app.post('/callback', (req, res) => {
  try {
    console.log('\n✅ CALLBACK DITERIMA DARI DUITKU');
    console.log('=====================================');
    console.log('Waktu:', new Date().toISOString());
    console.log('Data yang diterima:');
    console.log(JSON.stringify(req.body, null, 2));

    const {
      merchantCode,
      amount,
      merchantOrderId,
      resultCode,
      reference,
      signature,
      paymentCode
    } = req.body;

    // Validasi parameter
    if (!merchantCode || !amount || !merchantOrderId || !signature) {
      console.error('❌ Parameter callback tidak lengkap');
      return res.status(400).json({
        status: 'error',
        message: 'Parameter tidak lengkap'
      });
    }

    // Verifikasi Signature: MD5(merchantCode + amount + merchantOrderId + apiKey)
    const apiKey = process.env.DUITKU_API_KEY;
    const signatureString = merchantCode + amount + merchantOrderId + apiKey;
    const calculatedSignature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex');

    console.log('\n📊 VERIFIKASI SIGNATURE:');
    console.log('Signature String:', signatureString);
    console.log('Signature dari Duitku:', signature);
    console.log('Signature yang dihitung:', calculatedSignature);
    console.log('Match:', signature === calculatedSignature ? '✅ VALID' : '❌ INVALID');

    if (signature !== calculatedSignature) {
      console.error('❌ SIGNATURE TIDAK VALID!');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid signature'
      });
    }

    // Proses berdasarkan resultCode
    console.log('\n💰 PROSES PEMBAYARAN:');
    let status = 'UNKNOWN';

    if (resultCode === '00') {
      status = 'PAID';
      console.log('✅ PEMBAYARAN BERHASIL (resultCode: 00)');
      console.log('Order ID:', merchantOrderId);
      console.log('Amount:', amount);
      console.log('Reference:', reference);
      console.log('Payment Code:', paymentCode);
      
      // TODO: Update database, kirim email, aktivasi layanan, dll
      
    } else if (resultCode === '01') {
      status = 'FAILED';
      console.log('❌ PEMBAYARAN GAGAL (resultCode: 01)');
      
    } else {
      status = 'PENDING';
      console.log('⏳ STATUS LAIN (resultCode:', resultCode + ')');
    }

    // Respons ke Duitku (WAJIB diberikan)
    console.log('\n📤 MENGIRIM RESPONS KE DUITKU...');
    res.status(200).json({
      status: 'success',
      message: 'Callback received and processed'
    });

    console.log('✅ RESPONS TERKIRIM');
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ ERROR MEMPROSES CALLBACK:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ============================================
// ENDPOINT 3: CHECK TRANSACTION STATUS
// ============================================
app.post('/api/check-transaction', async (req, res) => {
  try {
    const { merchantOrderId } = req.body;

    if (!merchantOrderId) {
      return res.status(400).json({ error: 'merchantOrderId wajib diisi' });
    }

    console.log('\n🔍 REQUEST: CHECK TRANSACTION STATUS');
    console.log('----------------------------');
    console.log('Order ID:', merchantOrderId);

    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;

    // Hitung signature
    const signatureString = merchantCode + merchantOrderId + apiKey;
    const signature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex');

    const payload = {
      merchantCode: merchantCode,
      merchantOrderId: merchantOrderId,
      signature: signature
    };

    console.log('Signature:', signature);
    console.log('Sending to Duitku...');

    const response = await axios.post(
      `${process.env.DUITKU_SANDBOX_URL}/transactionStatus`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('\n✅ RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('❌ ERROR CHECK TRANSACTION:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINT 4: HOME (INFO SERVER)
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Duitku Payment Sandbox Test Server',
    endpoints: {
      'POST /api/create-invoice': 'Membuat invoice/transaksi',
      'POST /callback': 'Menerima callback dari Duitku',
      'POST /api/check-transaction': 'Check status transaksi'
    },
    note: 'Gunakan Postman atau cURL untuk test'
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📍 Endpoint tersedia:`);
  console.log(`   POST http://localhost:${PORT}/api/create-invoice`);
  console.log(`   POST http://localhost:${PORT}/callback`);
  console.log(`   POST http://localhost:${PORT}/api/check-transaction`);
  console.log(`   GET  http://localhost:${PORT}/\n`);
});

module.exports = app;

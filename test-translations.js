// Test script to debug translation issues
// Run this with: node test-translations.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Adjust to your backend URL

async function testTranslations() {
  console.log('=== Testing Translation System ===\n');

  try {
    // 1. Check current translations in database
    console.log('1. Checking current translations...');
    const checkResponse = await axios.get(`${BASE_URL}/translations/check`);
    console.log('Total translations in DB:', checkResponse.data.total);
    console.log('Sample translations:', checkResponse.data.translations.slice(0, 3));
    console.log('');

    // 2. Test debug endpoint with English
    console.log('2. Testing debug endpoint with English...');
    const debugEnResponse = await axios.get(`${BASE_URL}/cart/debug-translations?lang=en&item=كتب&category=paper`);
    console.log('English debug response:', JSON.stringify(debugEnResponse.data, null, 2));
    console.log('');

    // 3. Test debug endpoint with Arabic
    console.log('3. Testing debug endpoint with Arabic...');
    const debugArResponse = await axios.get(`${BASE_URL}/cart/debug-translations?lang=ar&item=books&category=paper`);
    console.log('Arabic debug response:', JSON.stringify(debugArResponse.data, null, 2));
    console.log('');

    // 4. Test cart endpoint with English
    console.log('4. Testing cart endpoint with English...');
    try {
      const cartEnResponse = await axios.get(`${BASE_URL}/cart?lang=en`, {
        withCredentials: true
      });
      console.log('Cart English response:', JSON.stringify(cartEnResponse.data, null, 2));
    } catch (error) {
      console.log('Cart English error:', error.response?.data || error.message);
    }
    console.log('');

    // 5. Test cart endpoint with Arabic
    console.log('5. Testing cart endpoint with Arabic...');
    try {
      const cartArResponse = await axios.get(`${BASE_URL}/cart?lang=ar`, {
        withCredentials: true
      });
      console.log('Cart Arabic response:', JSON.stringify(cartArResponse.data, null, 2));
    } catch (error) {
      console.log('Cart Arabic error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTranslations();

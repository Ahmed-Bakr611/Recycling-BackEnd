// Test script to verify notification system
// Run this with: node test-notifications.js

const mongoose = require('mongoose');
const { createAndEmitNotification } = require('./src/services/notificationService');

async function testNotificationSystem() {
  try {
    // Connect to MongoDB (update with your connection string)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recycling');
    console.log('✅ Connected to MongoDB');

    // Test creating a notification
    const testNotification = await createAndEmitNotification({
      userId: '60d5ecb74b24a1234567890a', // Replace with a real user ID from your DB
      title: 'Test Notification',
      body: 'This is a test notification to verify the system is working!',
      type: 'system',
      data: { test: true }
    });

    if (testNotification) {
      console.log('✅ Notification created successfully:', testNotification._id);
      console.log('📋 Notification details:', {
        title: testNotification.title,
        body: testNotification.body,
        type: testNotification.type,
        userId: testNotification.userId,
        createdAt: testNotification.createdAt
      });
    } else {
      console.log('❌ Failed to create notification');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testNotificationSystem();

const mongoose = require('mongoose');
const { ChatModel } = require('./dist/models/chat');

async function testValidation() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/mfulearnai');
    console.log('Connected to MongoDB');

    // Test 1: Empty string content
    try {
      const testMessage = {
        role: 'assistant',
        content: '',
        id: 'test1'
      };
      
      const chat = new ChatModel({
        userId: 'test-user',
        name: 'Test Chat',
        messages: [testMessage]
      });
      
      await chat.save();
      console.log('✅ Test 1 passed: Empty string content allowed');
    } catch (error) {
      console.log('❌ Test 1 failed:', error.message);
    }

    // Test 2: Null content
    try {
      const testMessage = {
        role: 'assistant',
        content: null,
        id: 'test2'
      };
      
      const chat = new ChatModel({
        userId: 'test-user',
        name: 'Test Chat',
        messages: [testMessage]
      });
      
      await chat.save();
      console.log('✅ Test 2 passed: Null content allowed');
    } catch (error) {
      console.log('❌ Test 2 failed:', error.message);
    }

    // Test 3: Undefined content
    try {
      const testMessage = {
        role: 'assistant',
        content: undefined,
        id: 'test3'
      };
      
      const chat = new ChatModel({
        userId: 'test-user',
        name: 'Test Chat',
        messages: [testMessage]
      });
      
      await chat.save();
      console.log('✅ Test 3 passed: Undefined content allowed');
    } catch (error) {
      console.log('❌ Test 3 failed:', error.message);
    }

    // Test 4: Valid content
    try {
      const testMessage = {
        role: 'assistant',
        content: 'กำลังคิด...',
        id: 'test4'
      };
      
      const chat = new ChatModel({
        userId: 'test-user',
        name: 'Test Chat',
        messages: [testMessage]
      });
      
      await chat.save();
      console.log('✅ Test 4 passed: Valid content works');
    } catch (error) {
      console.log('❌ Test 4 failed:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testValidation(); 
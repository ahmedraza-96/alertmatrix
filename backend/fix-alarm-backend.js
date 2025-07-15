const http = require('http');
const mongoose = require('mongoose');

// MongoDB connection
const MONGO_URI = 'mongodb+srv://ahmedrazaamjad101:i15mBUjLijMGxiN4@cluster0.czyj5cd.mongodb.net/alertmatrix?retryWrites=true&w=majority&appName=Cluster0';

// Test backend endpoint
function testBackend(path) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8000,
      path: path,
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });
    req.on('error', () => resolve({ status: 'ERROR', body: 'Connection failed' }));
    req.end();
  });
}

// Create sample alarm data
async function createSampleData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Use the existing AlarmEvent model
    const AlarmEvent = require('./models/AlarmEvent');

    // Sample data
    const sampleAlarms = [
      { alarm_id: "ALM_232", partition: 1, armed: true, timestamp: "2025-01-28 18:15:05" },
      { alarm_id: "ALM_233", partition: 2, armed: false, timestamp: "2025-01-28 17:30:10" },
      { alarm_id: "ALM_234", partition: 1, armed: true, timestamp: "2025-01-28 16:45:22" },
      { alarm_id: "4qd13e", partition: 3, armed: true, timestamp: "2025-01-28 15:20:33" }
    ];

    // Check existing data
    const existingCount = await AlarmEvent.countDocuments();
    console.log(`📊 Existing alarm events: ${existingCount}`);

    if (existingCount === 0) {
      await AlarmEvent.insertMany(sampleAlarms);
      console.log('✅ Sample alarm data created');
    } else {
      // Update/add specific alarms
      for (const alarm of sampleAlarms) {
        await AlarmEvent.findOneAndUpdate(
          { alarm_id: alarm.alarm_id },
          alarm,
          { upsert: true, new: true }
        );
      }
      console.log('✅ Sample alarm data updated');
    }

    // Show available alarms
    const allAlarms = await AlarmEvent.find().select('alarm_id');
    console.log('\n🎯 Available Alarm IDs:');
    allAlarms.forEach(alarm => console.log(`   - ${alarm.alarm_id}`));

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Test backend endpoints
async function testEndpoints() {
  console.log('\n🧪 Testing Backend Endpoints...\n');

  const tests = [
    { path: '/', name: 'Server Health' },
    { path: '/api/alarms/health', name: 'Alarm Health Check' },
    { path: '/api/alarms/test', name: 'Alarm Test Endpoint' }
  ];

  for (const test of tests) {
    console.log(`Testing ${test.name}...`);
    const result = await testBackend(test.path);
    
    if (result.status === 200) {
      console.log(`   ✅ ${test.path} → ${result.status}`);
    } else {
      console.log(`   ❌ ${test.path} → ${result.status}`);
    }
  }

  // Test POST endpoints (should return 401 without auth)
  console.log('\nTesting POST endpoints (should return 401)...');
  const postTests = [
    '/api/alarms/validate',
    '/api/alarms/associate'
  ];

  for (const path of postTests) {
    const result = await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 8000,
        path: path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => resolve(res.statusCode));
      req.on('error', () => resolve('ERROR'));
      req.write(JSON.stringify({ alarm_id: 'ALM_232' }));
      req.end();
    });

    if (result === 401) {
      console.log(`   ✅ ${path} → 401 (auth required)`);
    } else if (result === 404) {
      console.log(`   ❌ ${path} → 404 (not found)`);
    } else {
      console.log(`   ⚠️  ${path} → ${result}`);
    }
  }
}

// Main execution
async function main() {
  console.log('🔧 AlertMatrix Backend Fix & Test\n');

  // Step 1: Create sample data
  console.log('📝 Step 1: Creating sample alarm data...');
  await createSampleData();

  // Step 2: Test backend
  console.log('\n📡 Step 2: Testing backend endpoints...');
  await testEndpoints();

  // Step 3: Instructions
  console.log('\n📋 Instructions:');
  console.log('1. ✅ Sample alarm data created/updated');
  console.log('2. 🔄 If you see 404 errors, restart your backend:');
  console.log('   - Stop backend (Ctrl+C)');
  console.log('   - Wait 3 seconds');
  console.log('   - Start: npm start');
  console.log('3. 🧪 Test with these alarm IDs:');
  console.log('   - ALM_232, ALM_233, ALM_234, 4qd13e');
  console.log('4. ❌ Test with invalid ID: INVALID_123');
  console.log('5. 📱 Check your React Native app');

  console.log('\n🎯 Expected Results:');
  console.log('   ✅ Valid alarm ID → Success message');
  console.log('   ❌ Invalid alarm ID → Error message');
  console.log('   🔄 Alarm appears in monitored alarms list');
}

main().catch(console.error); 
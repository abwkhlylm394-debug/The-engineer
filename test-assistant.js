import http from 'node:http';

async function testEndpoint(message, description) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ message });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/assistant',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`\n${description}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${body}`);
        resolve(body);
      });
    });

    req.on('error', (e) => {
      console.error(`\n${description} - ERROR: ${e.message}`);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('Testing /api/assistant endpoint...\n');
  
  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 1000));
  
  try {
    // Test 1: Services question
    await testEndpoint('What services do you offer?', 'Test 1: Services question');
    
    // Test 2: Projects question
    await testEndpoint('Tell me about your projects', 'Test 2: Projects question');
    
    // Test 3: Process question
    await testEndpoint('How do you work?', 'Test 3: Process question');
    
    // Test 4: Contact question
    await testEndpoint('How can I contact you?', 'Test 4: Contact question');
    
    // Test 5: About question
    await testEndpoint('Who is Mohammed?', 'Test 5: About question');
    
    // Test 6: Technology question
    await testEndpoint('What technology stack do you use?', 'Test 6: Technology question');
    
    // Test 7: General greeting
    await testEndpoint('Hello', 'Test 7: General greeting');
    
    console.log('\n✓ All keyword tests completed successfully!');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();

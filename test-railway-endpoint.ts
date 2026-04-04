#!/usr/bin/env tsx

const testPayload = {
  format: 'png',
  globalBranding: {
    accentColor: '#3b82f6',
    handle: '@railway-test',
    effects: []
  },
  carousel: [
    {
      templateId: 'CTA_FINAL',
      data: {
        callToAction: 'Railway Fix Test',
        subtext: 'POST /api/render Works!'
      }
    }
  ]
};

console.log('🧪 Testing POST /api/render on Railway...\n');

fetch('https://instagram-remotion-server-production.railway.app/api/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPayload),
})
  .then(res => {
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log('✅ SUCCESS! Endpoint is now accessible on Railway\n');
      return res.json();
    } else {
      console.log('❌ FAILED! Got error status');
      return res.text();
    }
  })
  .then(data => {
    console.log('Response:');
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
      if (data.images && Array.isArray(data.images)) {
        console.log(`\n📸 Generated images: ${data.images.length}`);
        data.images.forEach((img: string) => console.log(`  - ${img}`));
      }
    }
  })
  .catch(err => {
    console.error('❌ Request error:', err);
    process.exit(1);
  });

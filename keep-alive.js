// Keep Render service awake by pinging every 14 minutes
const https = require('https');

const BACKEND_URL = 'https://desifood-chatbot-1.onrender.com';

function ping() {
  https.get(BACKEND_URL, (res) => {
    console.log(`Ping successful: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('Ping failed:', err.message);
  });
}

// Ping every 14 minutes (840000 ms)
setInterval(ping, 840000);

console.log('Keep-alive service started. Pinging every 14 minutes...');
ping(); // Initial ping

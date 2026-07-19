import http from 'http';
import fs from 'fs';

const samplePath = '/Users/prathameshanabhavane/Documents/Pratham/gtm-container-analyzer/public/sample-gtm-container.json';
console.log(`Reading sample container from ${samplePath} ...`);
const containerJson = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

const payload = JSON.stringify({
  message: "Audit my container and tell me the main naming and performance issues.",
  containerJson: containerJson,
  provider: "gemini"
});

console.log('Sending streaming AI request to local endpoint http://localhost:3001/api/chat ...\n');

const req = http.request('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Origin': 'http://localhost:5173'
  }
}, (res) => {
  console.log(`Response Status: ${res.statusCode}`);
  
  let buffer = '';
  res.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('data:')) {
        const rawData = line.substring(5).trim();
        try {
          const parsed = JSON.parse(rawData);
          if (parsed.type === 'text') {
            process.stdout.write(parsed.content);
          } else if (parsed.type === 'done') {
            console.log('\n\n✅ Stream complete.');
          }
        } catch (e) {
          // Ignore partial JSON lines
        }
      }
    }
    buffer = lines[lines.length - 1];
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(payload);
req.end();

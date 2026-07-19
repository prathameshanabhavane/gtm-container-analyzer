import http from 'http';
import fs from 'fs';
import path from 'path';

const samplePath = '/Users/prathameshanabhavane/Documents/Pratham/gtm-container-analyzer/public/sample-gtm-container.json';
console.log(`Reading GTM container from ${samplePath} ...`);
const containerJson = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

console.log('Connecting to MCP Server SSE endpoint on http://localhost:3001/sse ...');

const req = http.request('http://localhost:3001/sse', {
  headers: {
    'Origin': 'http://localhost:5173'
  }
}, (res) => {
  let buffer = '';
  let endpointUrl = '';
  let currentEvent = '';
  
  res.on('data', (chunk) => {
    const text = chunk.toString();
    buffer += text;
    
    const lines = buffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('event:')) {
        currentEvent = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        const data = line.replace('data:', '').trim();
        
        if (currentEvent === 'endpoint') {
          endpointUrl = data;
          console.log(`📡 SSE handshake successful! Session message endpoint: ${endpointUrl}`);
          // Send tools/call request for analyze_container
          sendAnalyzeContainerRequest(endpointUrl);
        } else if (currentEvent === 'message') {
          console.log(`\n📥 Received tool response from SSE stream:`);
          try {
            const json = JSON.parse(data);
            if (json.result && json.result.content) {
              const textResult = json.result.content[0].text;
              console.log(JSON.stringify(JSON.parse(textResult), null, 2));
            } else {
              console.log(JSON.stringify(json, null, 2));
            }
          } catch (err) {
            console.log(data);
          }
          // Exit program since we received the response
          process.exit(0);
        }
      } else if (line === '') {
        currentEvent = '';
      }
    }
    buffer = lines[lines.length - 1];
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();

function sendAnalyzeContainerRequest(relativeUrl) {
  const postData = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'analyze_container',
      arguments: {
        containerJson: containerJson
      }
    }
  });
  
  console.log(`✉️ Sending JSON-RPC tools/call (analyze_container) request ...`);
  
  const postReq = http.request(`http://localhost:3001${relativeUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Origin': 'http://localhost:5173'
    }
  }, (res) => {
    res.on('data', () => {});
  });
  
  postReq.on('error', (e) => {
    console.error(`Post request error: ${e.message}`);
    process.exit(1);
  });
  
  postReq.write(postData);
  postReq.end();
}

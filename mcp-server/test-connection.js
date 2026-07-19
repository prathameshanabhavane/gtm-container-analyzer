import http from 'http';

console.log('Connecting to MCP Server SSE endpoint on http://localhost:3001/sse ...');

const req = http.request('http://localhost:3001/sse', {
  headers: {
    'Origin': 'http://localhost:5173'
  }
}, (res) => {
  console.log(`SSE Connection status: ${res.statusCode}`);
  
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
          // Send tools/list request
          sendListToolsRequest(endpointUrl);
        } else if (currentEvent === 'message') {
          console.log(`📥 Received message from SSE stream:`);
          try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
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

function sendListToolsRequest(relativeUrl) {
  const postData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  });
  
  console.log(`✉️ Sending JSON-RPC tools/list request to http://localhost:3001${relativeUrl} ...`);
  
  const postReq = http.request(`http://localhost:3001${relativeUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Origin': 'http://localhost:5173'
    }
  }, (res) => {
    // Read response (expected 200/202 status)
    res.on('data', () => {});
  });
  
  postReq.on('error', (e) => {
    console.error(`Post request error: ${e.message}`);
    process.exit(1);
  });
  
  postReq.write(postData);
  postReq.end();
}

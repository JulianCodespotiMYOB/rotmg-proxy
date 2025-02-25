// fetch-server-list.ts
import * as https from 'https';

const options = {
  hostname: 'www.realmofthemadgod.com',
  port: 443,
  path: '/account/servers',
  method: 'GET',
  headers: {
    'User-Agent': 'RotMGClient/Unknown', // mimic client if needed
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Server List Response:');
    console.log(data);
    // Here you can parse the response if it's in JSON or another format
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();

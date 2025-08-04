const https = require('https');
const fs = require('fs');
const path = require('path');

const imageUrl = 'https://files.waifu.cat/68e29533.gif';
const uploadsDir = path.join(__dirname, 'uploads', 'ads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const filename = 'test.gif';
const filePath = path.join(uploadsDir, filename);

console.log('Starting download test...');
const startTime = Date.now();

const downloadImage = () => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let downloadedBytes = 0;
    
    https.get(imageUrl, (response) => {
      console.log('Response status:', response.statusCode);
      console.log('Content-Length:', response.headers['content-length']);
      
      if (response.statusCode !== 200) {
        reject(new Error('Failed to download'));
        return;
      }
      
      const totalBytes = parseInt(response.headers['content-length'] || '0');
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalBytes > 0 ? (downloadedBytes / totalBytes * 100).toFixed(1) : 'unknown';
        process.stdout.write(`\rDownloaded: ${downloadedBytes} bytes (${progress}%)`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        console.log(`\n✅ Download completed in ${duration.toFixed(2)} seconds`);
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

downloadImage()
  .then(() => {
    console.log('✅ Test completed!');
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
  }); 
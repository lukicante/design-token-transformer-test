const fs = require('fs');
const pako = require('pako');

// Example compressed data received as base64
const compressedData = process.env.DECOMPRESSED_DATA_BASE64; // Assuming data is base64 encoded

console.log(compressedData);

// Decode base64 (if it's encoded as base64)
const decodedData = atob(compressedData);

// Decompress
const uint8array = new Uint8Array(decodedData.length);
for (let i = 0; i < decodedData.length; i++) {
    uint8array[i] = decodedData.charCodeAt(i);
}
const decompressedData = pako.inflate(uint8array, { to: 'string' });

// Ensure decompressedData is populated
if (decompressedData) {
    // Save decompressed data to a JSON file
    fs.writeFileSync('tokens/decompressed.json', decompressedData);
} else {
    console.error('Decompressed data is undefined or empty.');
}

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const tarball = process.argv[2];
const outputDir = process.argv[3];

function parseTar(buffer, outDir) {
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.slice(offset, offset + 512);
    const name = header.slice(0, 100).toString('utf8').replace(/\0/g, '').trim();
    const sizeStr = header.slice(124, 136).toString('utf8').replace(/\0/g, '').trim();
    const typeflag = header.slice(156, 157).toString('utf8');
    
    if (!name) { offset += 512; continue; }
    
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const contentStart = offset + 512;
    const content = buffer.slice(contentStart, contentStart + size);
    
    const cleanName = name.replace(/^package\//, '');
    const fullPath = path.join(outDir, cleanName);
    
    if (typeflag === '5' || cleanName.endsWith('/')) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    
    offset = contentStart + Math.ceil(size / 512) * 512;
    if (offset % 512 !== 0) offset += 512 - (offset % 512);
  }
}

const compressed = fs.readFileSync(tarball);
const decompressed = zlib.gunzipSync(compressed);
fs.mkdirSync(outputDir, { recursive: true });
parseTar(decompressed, outputDir);
console.log('Extraction complete');

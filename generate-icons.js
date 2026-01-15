const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const scale = size / 512;

  // Background
  ctx.fillStyle = '#E31837';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 100 * scale);
  ctx.fill();

  // Train body
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(120 * scale, 120 * scale, 272 * scale, 180 * scale, 30 * scale);
  ctx.fill();

  // Windows
  ctx.fillStyle = '#E31837';
  ctx.beginPath();
  ctx.roundRect(150 * scale, 150 * scale, 70 * scale, 50 * scale, 8 * scale);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(292 * scale, 150 * scale, 70 * scale, 50 * scale, 8 * scale);
  ctx.fill();

  // Wheels
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(180 * scale, 320 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(332 * scale, 320 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Rail
  ctx.beginPath();
  ctx.roundRect(80 * scale, 340 * scale, 352 * scale, 12 * scale, 6 * scale);
  ctx.fill();

  // Text "CT"
  ctx.fillStyle = '#E31837';
  ctx.font = `bold ${56 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CT', 256 * scale, 250 * scale);

  return canvas.toBuffer('image/png');
}

// Generate icons
fs.writeFileSync('icon-192.png', generateIcon(192));
fs.writeFileSync('icon-512.png', generateIcon(512));

console.log('Generated icon-192.png and icon-512.png');

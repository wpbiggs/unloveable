const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const filesToSync = [
  'spec.md',
  'implementation-plan.md',
  'prompt.md',
  'run-loop.sh',
  'loop.json',
  'validate-loop.ts'
];

const rootDir = path.resolve(__dirname, '..');
const templateDir = path.resolve(rootDir, 'templates/unloveable');

let failed = false;

console.log('Verifying template sync...');

filesToSync.forEach(file => {
  const rootPath = path.join(rootDir, file);
  const templatePath = path.join(templateDir, file);

  if (!fs.existsSync(rootPath)) {
    console.error(`❌ Root file missing: ${file}`);
    failed = true;
    return;
  }

  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template file missing: ${file}`);
    failed = true;
    return;
  }

  const rootContent = fs.readFileSync(rootPath);
  const templateContent = fs.readFileSync(templatePath);

  const rootHash = crypto.createHash('sha256').update(rootContent).digest('hex');
  const templateHash = crypto.createHash('sha256').update(templateContent).digest('hex');

  if (rootHash !== templateHash) {
    console.error(`❌ Hash mismatch for ${file}`);
    failed = true;
  } else {
    console.log(`✅ ${file} matches`);
  }
});

if (fs.existsSync(path.join(templateDir, 'validate-loop.js'))) {
    console.error(`❌ Found deprecated validate-loop.js in template dir`);
    failed = true;
}

if (failed) {
  console.error('Verification failed.');
  process.exit(1);
} else {
  console.log('Verification passed.');
}

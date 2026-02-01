const fs = require('fs');
const path = require('path');

const contextFile = path.resolve(__dirname, '../repo-context.txt');

if (!fs.existsSync(contextFile)) {
    console.error(`Error: Context file not found at ${contextFile}`);
    process.exit(1);
}

const content = fs.readFileSync(contextFile, 'utf8');
const lines = content.split('\n').filter(line => line.trim() !== '');

let allFilesExist = true;
lines.forEach(file => {
    const filePath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Missing required file in repo context: ${file}`);
        allFilesExist = false;
    }
});

if (allFilesExist) {
    console.log("All files in repo context bundle are present.");
} else {
    process.exit(1);
}

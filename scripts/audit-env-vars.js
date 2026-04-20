const fs = require('fs');
const path = require('path');

console.log('Environment Variables Audit\n');

// Search for process.env usage in the codebase
const searchDir = '.';
const envVars = new Set();

function searchFiles(dir, filePattern = /\.(ts|js|tsx|jsx)$/) {
 const files = fs.readdirSync(dir, { withFileTypes: true });

 files.forEach(file => {
 const fullPath = path.join(dir, file.name);

 if (file.isDirectory()) {
 if (!file.name.startsWith('.') && file.name !== 'node_modules' && file.name !== 'backups') {
 searchFiles(fullPath, filePattern);
 }
 } else if (filePattern.test(file.name)) {
 const content = fs.readFileSync(fullPath, 'utf8');
 const matches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);

 for (const match of matches) {
 envVars.add(match[1]);
 }
 }
 });
}

searchFiles(searchDir);

console.log('Environment Variables Found:\n');
const sortedVars = Array.from(envVars).sort();

sortedVars.forEach(varName => {
 console.log(` ${varName}`);
});

console.log(`\nTotal: ${sortedVars.length} environment variables\n`);

// Check if .env file exists
const envPath = '.env';
const envLocalPath = '.env.local';

if (fs.existsSync(envPath)) {
 console.log('.env file exists');
} else {
 console.log(' .env file does NOT exist');
}

if (fs.existsSync(envLocalPath)) {
 console.log('.env.local file exists');
} else {
 console.log(' .env.local file does NOT exist');
}

console.log('\nRecommendation: Create .env.local for local development and .env.example as a template.');

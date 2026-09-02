const fs = require('fs');
for (const file of process.argv.slice(2)) {
  const value = fs.readFileSync(file, 'utf8');
  const repaired = Buffer.from(value, 'latin1').toString('utf8');
  fs.writeFileSync(file, repaired, 'utf8');
}

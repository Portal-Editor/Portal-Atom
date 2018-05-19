const unzip = require('unzip')
const fs = require('fs')

fs.createReadStream('test.zip').pipe(unzip.Extract({ path: './test' }));

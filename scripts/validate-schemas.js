const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv();

// Load all schemas
const schemas = {};
const schemaDir = path.join(__dirname, '../protocols/uim-handshake/v1.0/schema');

fs.readdirSync(schemaDir).forEach(file => {
    if (file.endsWith('.json')) {
        const schemaPath = path.join(schemaDir, file);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        schemas[path.basename(file, '.schema.json')] = schema;
        ajv.addSchema(schema, file);
    }
});

console.log('✅ UIM Schemas validated successfully:');
Object.keys(schemas).forEach(name => {
    console.log(`   - ${name}`);
});

// Export for use in other scripts
module.exports = { ajv, schemas };

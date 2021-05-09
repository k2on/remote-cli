import { compile, JSONSchema } from 'json-schema-to-typescript';
import { readFileSync, writeFileSync } from 'fs';
import * as ora from 'ora';

const getSchema = (): JSONSchema =>
    JSON.parse(readFileSync('schema.json', 'utf-8'));

const generateSchema = async () => {
    const orb = ora('Generating Schema').start();
    const schema = getSchema();
    writeFileSync(
        'src/generatedSchema.ts',
        `import { JSONSchema } from 'json-schema-to-typescript';\nexport const schema: JSONSchema = ${JSON.stringify(
            schema,
        )}`,
    );
    const schemaInterface = await compile(schema, 'CLI');
    writeFileSync('src/generatedSchemaInterface.ts', schemaInterface);
    orb.succeed('Generated Schema');
};

generateSchema();

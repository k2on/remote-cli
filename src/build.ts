import { Context } from './type';
import { join } from 'path';
import { CLI_FILE_NAME, OUT_DIRECTORY } from './constants';
import { schema } from './generatedSchema';
import { CLI } from './generatedSchemaInterface';
import { getFile } from './util';
import { buildBash } from './bash';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { createReadabilityScript } from './readability';
import { createIndexFile } from './createIndex';

const getCLI = (directory: string): CLI => {
    return getFile<CLI>(join(directory, CLI_FILE_NAME), schema);
};

const createOutDirectory = () => {
    if (!existsSync(OUT_DIRECTORY)) mkdirSync(OUT_DIRECTORY);
};

export const build = async (directory: string): Promise<void> => {
    const cli = getCLI(directory);
    const ctx: Context = {
        directory,
        cli,
    };
    const bashFileContent = await buildBash(ctx);
    createOutDirectory();
    writeFileSync(
        join(OUT_DIRECTORY, 'readability.js'),
        createReadabilityScript(ctx.cli.title),
    );
    writeFileSync(
        join(OUT_DIRECTORY, 'index.html'),
        createIndexFile(ctx.cli, bashFileContent),
    );
    writeFileSync(join(OUT_DIRECTORY, 'CNAME'), cli.uri);
};

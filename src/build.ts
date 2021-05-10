import { Context } from './type';
import { join } from 'path';
import {
    CLI_FILE_NAME,
    OUT_DIRECTORY,
    WINDOWS_OUT_DIRECTORY,
} from './constants';
import { schema } from './generatedSchema';
import { CLI } from './generatedSchemaInterface';
import { getFile } from './util';
import { buildBash } from './bash';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { createReadabilityScript } from './readability';
import { createIndexFile } from './createIndex';
import { buildAccessor, buildCMD } from './cmd';

const getCLI = (directory: string): CLI => {
    return getFile<CLI>(join(directory, CLI_FILE_NAME), schema);
};

const createOutDirectory = () => {
    if (!existsSync(OUT_DIRECTORY)) mkdirSync(OUT_DIRECTORY);
};

const createWindowsDirectory = () => {
    if (!existsSync(WINDOWS_OUT_DIRECTORY)) mkdirSync(WINDOWS_OUT_DIRECTORY);
};

export const build = async (directory: string): Promise<void> => {
    const cli = getCLI(directory);
    const ctx: Context = {
        directory,
        cli,
    };
    const bashFileContent = await buildBash(ctx);
    const cmdFileContent = await buildCMD(ctx);
    const cmdAccessor = buildAccessor(ctx);
    createOutDirectory();
    writeFileSync(
        join(OUT_DIRECTORY, 'readability_bash.js'),
        createReadabilityScript(ctx.cli.title, 'bash', '##'),
    );
    writeFileSync(
        join(OUT_DIRECTORY, 'readability_cmd.js'),
        createReadabilityScript(ctx.cli.title, 'batch', 'REM'),
    );
    writeFileSync(
        join(OUT_DIRECTORY, 'index.html'),
        createIndexFile(
            ctx.cli,
            bashFileContent,
            `curl ${cli.uri} | bash`,
            'bash',
            '#!/usr/bin/env bash',
            '#',
            '##',
        ),
    );
    createWindowsDirectory();
    writeFileSync(
        join(WINDOWS_OUT_DIRECTORY, 'index.html'),
        createIndexFile(
            ctx.cli,
            cmdAccessor,
            `powershell (Invoke-WebRequest ${cli.uri}).content | cmd`,
            'cmd',
            '@echo off',
            ':',
            'REM',
        ),
    );
    writeFileSync(
        join(OUT_DIRECTORY, 'cmd.html'),
        createIndexFile(
            ctx.cli,
            cmdFileContent,
            `powershell (Invoke-WebRequest ${cli.uri}).content | cmd`,
            'cmd',
            '@echo off',
            ':',
            'REM',
        ),
    );
    writeFileSync(join(OUT_DIRECTORY, 'CNAME'), cli.uri);
};

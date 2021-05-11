import { JSONSchema } from 'json-schema-to-typescript';
import Ajv from 'ajv';
import { existsSync, readFileSync } from 'fs';
import { FileNotFound, InvalidJSONSchema, InvalidJSONSyntax } from './errors';
import { Splash } from './type';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const asciimo = require('asciimo');

const ajv = new Ajv({
    allowUnionTypes: true,
});

export const copyObject = <T>(obj: Record<string, T>): Record<string, T> =>
    Object.assign({}, obj);

export const getSyntaxErrorDetails = (
    message: string,
    content: string,
): [string, number, number] => {
    const AT_POSITION = ' at position ';
    if (!message.includes(AT_POSITION)) return [message, 0, 0];
    const reason = message.split(' in JSON ')[0];
    const positionTarget = parseInt(message.split(AT_POSITION)[1]);
    const lines = content.split('\n');
    let [line, column, position] = [0, 0, 1];
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        line++;
        const lineContent = lines[lineNumber];
        const characters = lineContent.split('');
        for (
            let columnNumber = 0;
            columnNumber < characters.length;
            columnNumber++
        ) {
            position++;
            column++;
            if (position == positionTarget) {
                return [reason, line, column];
            }
        }
        column = 0;
    }
    throw Error('doesnt work');
};

const parseJSON = (path: string, data: string): Record<string, unknown> => {
    try {
        return JSON.parse(data);
    } catch (e) {
        if (e instanceof SyntaxError) {
            const [reason, line, column] = getSyntaxErrorDetails(
                e.message,
                data,
            );
            throw new InvalidJSONSyntax(path, reason, line, column);
        } else {
            console.error('UNKNOWN ERROR: PLEASE REPORT');
            console.error(e);
            throw e;
        }
    }
};

export const getFile = <T = string>(path: string, schema?: JSONSchema): T => {
    // Verify the file's existance.
    if (!existsSync(path)) throw new FileNotFound(path);
    const data = readFileSync(path, 'utf-8');
    if (schema == undefined) return (data as unknown) as T;
    // Parse the JSON data.
    const json = parseJSON(path, data);
    const validate = ajv.compile(schema);
    if (!validate(json)) throw new InvalidJSONSchema(path, validate.errors);
    return json as T;
};

export const sanitizeString = (
    str: string,
    escapeCharacter: string,
    escapeCharacters: string[],
): string => {
    for (const character of escapeCharacters) {
        let replacingCharacter = character;
        if (character == '\\') replacingCharacter = '\\\\';
        if (character == '|') replacingCharacter = '\\|';
        str = str.replace(
            new RegExp(replacingCharacter, 'g'),
            escapeCharacter + character,
        );
    }
    return str;
};

export const figlet = (text: string, font: string): Promise<string> => {
    return new Promise<string>((resolve, _) => {
        asciimo.Figlet.write(text, font, (art: string) => {
            resolve(art);
        });
    });
};

export const buildSplash = async (
    sanitizeStringFunction: (s: string) => string,
    splash?: Splash,
): Promise<string> => {
    if (splash == undefined) return '';
    if (typeof splash == 'string') return sanitizeStringFunction(splash);
    const fig = await figlet(splash.text, splash.font);
    const coloredFig = splash.color
        ? `\${${splash.color.toUpperCase()}}${fig}$RESET`
        : fig;
    return sanitizeStringFunction(coloredFig);
};

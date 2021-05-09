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

export const parseString = (str: string): string =>
    str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/`/g, '\\`')
        .replace(/"/g, '\\"');

// asciimo.Figlet.write(splash.text, splash.font, (art: string) => {
//     result.b =
//         splash.color != undefined
//             ? `$${splash.color.toUpperCase()}${art}$RESET`
//             : art;
//     console.log(result);
// });
// while (result.b == '') {
//     console.log(result);
// }
// console.log(result);

export const figlet = (text: string, font: string): Promise<string> => {
    return new Promise<string>((resolve, _) => {
        asciimo.Figlet.write(text, font, (art: string) => {
            resolve(art);
        });
    });
};
export const buildSplash = async (
    splash: string | Splash | undefined,
): Promise<string> => {
    if (splash == undefined) return '';
    if (typeof splash == 'string') return parseString(splash);
    const fig = parseString(await figlet(splash.text, splash.font));
    return splash.color ? `\${${splash.color.toUpperCase()}}${fig}$RESET` : fig;
};

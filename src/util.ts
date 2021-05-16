import { JSONSchema } from 'json-schema-to-typescript';
import Ajv from 'ajv';
import { existsSync, readFileSync } from 'fs';
import { FileNotFound, InvalidJSONSchema, InvalidJSONSyntax } from './errors';
import { Splash } from './type';
import { Command } from './generatedSchemaInterface';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const asciimo = require('asciimo');

const ajv = new Ajv({
    allowUnionTypes: true,
});

export const capitalize = (str: string): string =>
    str[0].toUpperCase() + str.substring(1);

export const tab = (str: string, tabs = 1): string =>
    str
        .split('\n')
        .map((line) => Array(tabs + 1).join('    ') + line)
        .join('\n');

export const copyObject = <T>(obj: Record<string, T>): Record<string, T> =>
    Object.assign({}, obj);

export const mergeObjects = <T>(
    obj1: Record<string, T>,
    obj2: Record<string, T>,
): Record<string, T> => Object.assign(copyObject(obj1), copyObject(obj2));

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

export const rainbowText = (text: string): string => {
    const colors = [
        'BRIGHT_RED',
        'BRIGHT_YELLOW',
        'BRIGHT_GREEN',
        'BRIGHT_CYAN',
        'BRIGHT_BLUE',
        'BRIGHT_PURPLE',
    ];
    const lines = text.split('\n');
    const lineCount = lines.length;
    const scalar = Math.floor(lineCount / colors.length + 0.5);
    let result = '';
    let colorIndex = 0;
    for (const lineIndex in lines) {
        const line = lines[lineIndex];
        result += `$${colors[colorIndex]} ${line}\n`;
        if (!((parseInt(lineIndex) + 1) % scalar)) {
            if (colorIndex + 1 < colors.length) colorIndex++;
        }
    }
    result += '$RESET';
    return result;
};

export const parseCommands = (
    scriptFiles: string[],
    commandKey: 'bashCommand' | 'batchCommand',
    fileExtension: 'sh' | 'bat',
    commandsRefrence: Record<string, Command>,
    authLevel = 0,
): Record<string, Command> => {
    const parsedCommands: Record<string, Command> = {};
    const commands = copyObject(commandsRefrence);
    for (const [name, cmd] of Object.entries(commands)) {
        const cmdAttrs = Object.keys(cmd);
        // Remove the catch all.
        if (name == '*') continue;

        // If the command is hidden.
        if (cmdAttrs.includes('visibility') && !cmd.visibility) continue;

        // Access command without auth.
        const noAuthAccess = authLevel == 0 && !cmdAttrs.includes('access');
        // Access command with auth.
        const authAccess = authLevel > 0 && cmd.access == authLevel;
        // Display in help
        const displayInHelp = noAuthAccess || authAccess;
        if (!displayInHelp) continue;

        // If there is no batch command.
        if (!cmd.script && !cmd[commandKey]) continue;

        // If there is no script for the shell
        if (
            cmd.script &&
            !scriptFiles.includes(`${cmd.script}.${fileExtension}`)
        )
            continue;

        // Command supported.
        parsedCommands[name] = cmd;
    }

    return parsedCommands;
};

/**
 * Generate the help message for a menu.
 * @param {string} message Message of the menu.
 * @param {Record<string, Command>} commands The menu commands.
 * @returns {string} The help menu text.
 */
export const generateHelpCommand = (
    message: string,
    commands: Record<string, Command>,
): string => {
    let result = `${message}\n\n`;
    const definitions: Record<string, string> = {};
    for (const [commandName, command] of Object.entries(commands)) {
        // Show the command name and its aliases
        let term = [commandName].concat(command.aliases || []).join('|') + ' ';
        // Add all the required and optional arguments.
        for (const [argName, arg] of Object.entries(command.args || {})) {
            term += Object.keys(arg).includes('default')
                ? `[${argName}]`
                : `<${argName}>`;
        }
        definitions[term] = command.description;
    }

    const maxWidth = Math.max(
        ...Object.keys(definitions).map((term) => term.length),
    );
    for (const [term, definition] of Object.entries(definitions)) {
        const padding = Array(maxWidth - term.length + 4).join(' ');
        result += `${term}${padding}\${CYAN}${definition}$RESET\n`;
    }
    return result;
};

export const buildSplash = async (
    sanitizeStringFunction: (s: string) => string,
    splash?: Splash,
): Promise<string> => {
    if (splash == undefined) return '';
    if (typeof splash == 'string') return sanitizeStringFunction(splash);
    const fig = await figlet(splash.text, splash.font);
    let coloredFig = fig;
    if (splash.color == 'RAINBOW') {
        coloredFig = rainbowText(fig);
    } else if (splash.color) {
        coloredFig = `\${${splash.color.toUpperCase()}}${fig}$RESET`;
    }
    return sanitizeStringFunction(coloredFig);
};

import { join } from 'path';
import {
    BATCH_ESCAPE_CHARACTER,
    BATCH_ESCAPE_CHARACTERS,
    BATCH_VARIABLES,
    COLOR_CODES,
} from './constants';
import { Command, Context, Menu } from './type';
import { copyObject, getFile, sanitizeString } from './util';

const variables: Record<string, string> = BATCH_VARIABLES;

const buildFunc = (name: string, description: string, code: string): string =>
    `: ${description}
if NOT "%func%" == "${name}" goto end_func_${name}
:func_${name}
${code}
exit /b
:end_func_${name}
`;

const callFunc = (name: string, ...args: string[]) =>
    `set func=${name}
call :func_${name} ${args.map((arg) => `%${arg}%`).join(' ')}\n`;

const buildVariables = () => {
    for (const [colorName, number] of Object.entries(COLOR_CODES)) {
        variables[colorName] = `[${number}m`;
    }

    let builtVariables = ': Variables\n';
    for (const [name, value] of Object.entries(variables)) {
        builtVariables += `set ${name}=${value}\n`;
    }
    return builtVariables;
};

const buildError = () => buildFunc('error', 'The error function.', 'echo %1');

const includeScripts = (ctx: Context) => {
    let scripts = '';
    for (const menu of Object.values(ctx.cli.menus || {})) {
        for (const [commandName, command] of Object.entries(
            menu.commands || {},
        )) {
            if (command.script == undefined) continue;
            const script = getFile(
                join(ctx.directory, `funcs/${command.script}.sh`),
            );
            scripts += buildFunc(commandName, command.description, script);
        }
    }
    return scripts;
};

const convertVariables = (str: string): string => {
    for (const variableName of Object.keys(variables)) {
        str = str.replace(`$${variableName}`, `%${variableName}%`);
    }
    return str;
};

const sanitizeBatchString = (str: string): string =>
    sanitizeString(
        convertVariables(str),
        BATCH_ESCAPE_CHARACTER,
        BATCH_ESCAPE_CHARACTERS,
    );

const prompt = (prefix: string) => `set input=NO_INPUT
set /p input=${sanitizeBatchString(prefix)}`;

const generateHelpCommand = (
    name: string,
    commandsRefrence: Record<string, Command>,
): string[] => {
    const commands = Object.assign({}, commandsRefrence);
    const lines = [`echo Showing commands for ${name} menu.`, 'echo.'];
    const maxWidth = Math.max(
        ...Object.keys(commands).map((commandName) => commandName.length),
    );
    for (const [commandName, command] of Object.entries(commands)) {
        const padding = Array(maxWidth - commandName.length + 4).join(' ');
        lines.push(
            sanitizeBatchString(
                `echo ${commandName}${padding}$CYAN${command.description}$RESET`,
            ),
        );
    }
    return lines;
};

const buildProcess = (name: string, menu: Menu): string => {
    let code = '';
    const commands = Object.assign(copyObject<Command>(menu.commands || {}), {
        clear: {
            description: 'Clear the screen.',
            command: name,
            aliases: ['cls', 'c'],
        },
        exit: {
            description: 'Exit the CLI.',
            command: ['cls', 'exit 0'],
            aliases: ['ex', 'e'],
        },
        help: {
            description: `Show all the commands for the ${name} menu.`,
            aliases: ['?', 'h'],
        },
    } as Record<string, Command>);
    commands.help.command = generateHelpCommand(name, commands);
    for (const [commandName, cmd] of Object.entries(commands)) {
        const command = [commandName];
        command.push(...(cmd.aliases || []));

        if (cmd.script == undefined && cmd.command == undefined)
            throw new Error(
                'either a script or command must be specified for ' +
                    commandName,
            );
        const commandLines =
            cmd.script != undefined
                ? // script function name
                  [cmd.script!]
                : Array.isArray(cmd.command)
                ? // Multi-line command.
                  cmd.command!
                : // Single-line command.
                  [cmd.command!];
        const logic = commandLines.map((line) => `    ${line}`).join('\n');

        code += `: ${cmd.description}\n`;
        let ifStatement: string;
        if (command.length > 1) {
            code += `set is_command_${commandName}=0\n`;
            for (const alias of command) {
                code += `if "%1" == "${alias}" set is_command_${commandName}=1\n`;
            }
            ifStatement = `"%is_command_${commandName}%" == "1"`;
        } else {
            ifStatement = `"%1" == "${commandName}"`;
        }
        code += `
if ${ifStatement} (
${logic}
)
`;
    }

    return buildFunc(`process_${name}`, `Process a ${name} command.`, code);
};

const buildPrompt = (name: string, menu: Menu): string =>
    buildProcess(name, menu) +
    buildFunc(
        `prompt_${name}`,
        `Create the ${name} prompt.`,
        `${prompt(menu.prefix || '> ')}
if "%input%" == "NO_INPUT" goto end_switch
${callFunc(`process_${name}`, 'input')}
:end_switch
goto func_prompt_${name}`,
    );

const buildMenu = async (name: string, menu: Menu) =>
    buildPrompt(name, menu) +
    buildFunc(
        name,
        `The ${name} menu.`,
        `
cls
:HEADER

:SPLASH

${callFunc(`prompt_${name}`)}
`,
    );

export const buildAccessor = (
    ctx: Context,
): string => `powershell (Invoke-WebRequest ${ctx.cli.uri}/cmd.html).content > %temp%\\shell.bat
start %temp%\\shell.bat
exit`;

export const buildCMD = async (ctx: Context): Promise<string> => {
    let file = '@echo off & setLocal EnableDelayedExpansion\n';

    file += buildVariables();
    file += buildError();

    file += includeScripts(ctx);

    // Build all the menus
    for (const [name, menu] of Object.entries(ctx.cli.menus || {})) {
        file += await buildMenu(name, menu);
    }

    file += callFunc(ctx.cli.mainMenu);

    return file;
};

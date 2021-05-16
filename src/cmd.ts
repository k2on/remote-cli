import { join } from 'path';
import {
    BATCH_ADDITIONAL_VARIABLE_NAMES,
    BATCH_ESCAPE_CHARACTER,
    BATCH_ESCAPE_CHARACTERS,
    BATCH_TIME_VARIABLES,
    BATCH_VARIABLES,
    COLOR_CODES,
    DEFAULT_PROMPT_FORMAT,
} from './constants';
import { Command, Context, Menu } from './type';
import {
    buildSplash,
    capitalize,
    copyObject,
    generateHelpCommand,
    getFile,
    sanitizeString,
} from './util';

const variables: Record<string, string> = BATCH_VARIABLES;

const buildFunc = (name: string, description: string, code: string): string =>
    `: ${description}
:func_${name}
if NOT "%func%" == "${name}" goto end_func_${name}
${code}
exit /b
:end_func_${name}
`;

const callFunc = (name: string, ...args: string[]) => {
    args = args.map((arg) =>
        new RegExp(/^\$[a-zA-Z0-9_]*$/).test(arg)
            ? `%${arg.substring(1)}%`
            : `"${arg}"`,
    );
    return `set func=${name}
    call :func_${name} ${args.join(' ')}\n`;
};

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

const buildError = () =>
    buildFunc('error', 'The error function.', 'echo %RED%Error: %~1 %RESET%');

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
    const variableNames = Object.keys(variables).concat(
        ...BATCH_ADDITIONAL_VARIABLE_NAMES,
    );
    for (const variableName of variableNames) {
        str = str.replace(
            new RegExp(`\\$${variableName}`, 'g'),
            `%${variableName}%`,
        );
        str = str.replace(
            new RegExp(`\\\${${variableName}}`, 'g'),
            `%${variableName}%`,
        );
    }
    return str;
};

const multilineEcho = (str: string): string =>
    str
        .split('\n')
        .map((line) => (line.trim() != '' ? `echo ${line}` : 'echo.'))
        .join('\n');

const sanitizeBatchString = (str: string): string =>
    sanitizeString(
        convertVariables(str),
        BATCH_ESCAPE_CHARACTER,
        BATCH_ESCAPE_CHARACTERS,
    );

const prompt = (prefix: string, variable = 'input') => `set ${variable}=NO_INPUT
set /p ${variable}=${sanitizeBatchString(prefix)}
`;

const parseCommands = (
    commandsRefrence: Record<string, Command>,
): Record<string, Command> => {
    const parsedCommands: Record<string, Command> = {};
    const commands = copyObject(commandsRefrence);
    // Remove the catch all.
    for (const [name, cmd] of Object.entries(commands)) {
        parsedCommands[name] = cmd;
    }

    return parsedCommands;
};

const generateBatchHelpCommand = (
    name: string,
    commands: Record<string, Command>,
): string => {
    return multilineEcho(
        sanitizeBatchString(generateHelpCommand(name, parseCommands(commands))),
    );
};

const buildHeader = (menu: Menu): string => {
    if (!menu.header) return '';
    return sanitizeBatchString(
        `${BATCH_TIME_VARIABLES}\necho $BG_DARK_GREY${menu.header}$RESET\necho.`,
    );
};

const buildArgCheck = (cmd: Command): string => {
    const args = cmd.args || {},
        argNames = Object.keys(args);
    let code = '';
    if (!argNames.length) return code;
    code = ': Argument validation.\n';
    let argCount = 1;
    for (const argName of argNames) {
        const arg = args[argName];
        const internalArgName = argName;

        // The logic if an arg is not defined.
        let noDefinedArgLogic;
        if (Object.keys(arg).includes('default')) {
            noDefinedArgLogic = `set ${internalArgName}=${arg.default}\n`;
        } else {
            const promptMessage = arg.promptMessage || capitalize(argName);
            const promptPrefix = DEFAULT_PROMPT_FORMAT.replace(
                '{PROMPT}',
                promptMessage,
            );
            noDefinedArgLogic = prompt(promptPrefix, internalArgName);
        }
        code += `set ${internalArgName}=%${argCount}
if "%${internalArgName}%" == "" (
    ${noDefinedArgLogic}
)`;
        argCount++;
    }

    return code;
};

const buildProcess = (name: string, menu: Menu): string => {
    let code = 'set valid_command=0\n';
    const commands = Object.assign(copyObject<Command>(menu.commands || {}), {
        clear: {
            description: 'Clear the screen.',
            batchCommand: callFunc(name).split('\n'),
            aliases: ['cls', 'c'],
        },
        exit: {
            description: 'Exit the CLI.',
            batchCommand: ['echo %RED%Exiting...%RESET%', 'set exit=1'],
            aliases: ['ex', 'e'],
        },
        help: {
            description: `Show all the commands for the ${name} menu.`,
            aliases: ['?', 'h'],
        },
    } as Record<string, Command>);
    commands.help.batchCommand = generateBatchHelpCommand(name, commands);
    for (const [commandName, cmd] of Object.entries(commands)) {
        const command = [commandName];
        command.push(...(cmd.aliases || []));

        if (cmd.script == undefined && cmd.batchCommand == undefined)
            throw new Error(
                `Command: '${commandName}' must have a script or batchCommand`,
            );
        const commandLines: string[] = Array.isArray(cmd.batchCommand)
            ? cmd.batchCommand
            : [(cmd.script || cmd.batchCommand)!];
        const logic = commandLines.map((line) => `    ${line}`).join('\n');

        const argCheck = buildArgCheck(cmd);

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
    set valid_command=1
${argCheck}
${logic}
)
`;
    }
    code += `if NOT "%valid_command%" == "1" (
${error('"%1" is not a valid command.')}
)`;

    return buildFunc(`process_${name}`, `Process a ${name} command.`, code);
};

const error = (message: string): string =>
    `set errMsg=${message}\n${callFunc('error', message)}`;

const buildPrompt = (name: string, menu: Menu): string =>
    buildProcess(name, menu) +
    buildFunc(
        `prompt_${name}`,
        `Create the ${name} prompt.`,
        `${prompt(menu.prefix || '> ')}
if "%input%" == "NO_INPUT" goto end_switch
${callFunc(`process_${name}`, '$input')}
:end_switch
if "%exit%" == "0" (
${callFunc(`prompt_${name}`)}
)
exit /b
`,
    );

const buildMenu = async (name: string, menu: Menu) =>
    buildPrompt(name, menu) +
    buildFunc(
        name,
        `The ${name} menu.`,
        `
cls
${buildHeader(menu)}

${multilineEcho(await buildSplash(sanitizeBatchString, menu.splash))}

${callFunc(`prompt_${name}`)}
`,
    );

export const buildAccessor = (
    ctx: Context,
): string => `powershell (Invoke-WebRequest ${ctx.cli.uri}/cmd.bat).content > %temp%\\shell.bat
start %temp%\\shell.bat
exit`;

const buildShortCommand = (name: string): string =>
    `if NOT "%c%" == "" (
set parts=%c%
${callFunc(`process_${name}`, '$parts')}
pause
exit
)
`;

export const buildCMD = async (ctx: Context): Promise<string> => {
    let file = '@echo off & setLocal EnableDelayedExpansion\n';

    file += buildVariables();
    file += buildError();

    file += includeScripts(ctx);

    // Build all the menus
    for (const [name, menu] of Object.entries(ctx.cli.menus || {})) {
        file += await buildMenu(name, menu);
    }

    file += buildShortCommand(ctx.cli.mainMenu);
    file += callFunc(ctx.cli.mainMenu);

    file += `:cleanup
cls
`;

    return file;
};

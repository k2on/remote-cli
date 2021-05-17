import { existsSync } from 'fs';
import { join } from 'path';
import {
    COLOR_CODES,
    BASH_TIME_VARIABLES,
    VARIABLES,
    BASH_VARIABLES,
    BASH_ESCAPE_CHARACTER,
    BASH_ESCAPE_CHARACTERS,
    DEFAULT_PROMPT_FORMAT,
} from './constants';
import { Context, Menu, Command } from './type';
import {
    buildSplash,
    capitalize,
    copyObject,
    mergeObjects,
    generateHelpCommand,
    getFile,
    sanitizeString,
    tab,
    parseCommands,
} from './util';

const scriptFiles: string[] = [];

const buildFunc = (name: string, description: string, code: string): string =>
    `\n# ${description}\n${name} ()\n{\n${code.split('\n').join('\n')}\n}\n\n`;

const sanitizeBashString = (str: string): string =>
    sanitizeString(str, BASH_ESCAPE_CHARACTER, BASH_ESCAPE_CHARACTERS);

const buildVariables = () => {
    const variables: Record<string, string> = mergeObjects(
        VARIABLES,
        BASH_VARIABLES,
    );

    for (const [colorName, number] of Object.entries(COLOR_CODES)) {
        variables[colorName] = `'\\e[${number}m'`;
    }

    let builtVariables = '# Variables\n';
    for (const [name, value] of Object.entries(variables)) {
        builtVariables += `${name}=${value}\n`;
    }
    return builtVariables;
};

const buildError = () =>
    buildFunc(
        'error',
        'The error function.',
        'printf "${RED}ERROR: $1${RESET}"\necho ""',
    );

const success = (message: string): string =>
    `printf "\${GREEN}${message}\${RESET}\n"`;

const buildAuth = (ctx: Context): string => {
    let code = '';
    for (const [authLevel, auth] of Object.entries(ctx.cli.auth || {})) {
        let authCode = '';

        switch (auth.type) {
            case 'hash':
                authCode = `
: check for existance of shasum
if ! command -v shasum &> /dev/null
then
    error "shasum was not found"
    return 1
fi
${prompt('Key: ', 'key', true)}
hashed_key=\`echo -n $key | shasum | awk '{print $1}'\`
echo ""
if [ "$hashed_key" != "${auth.bashHash}" ];
then
error "Invalid Key"
return 1
fi
AUTH_LEVEL=${authLevel}
${success(`Authenticated to level ${authLevel} access.`)}
return 0
`;
                break;
            default:
                throw Error(`Auth type '${auth.type}' is invalid.`);
        }

        code += buildFunc(
            `auth_${authLevel}`,
            `Authenticate to level ${authLevel}`,
            authCode,
        );
    }
    return code;
};

const includeScripts = (ctx: Context) => {
    let scripts = '';
    for (const menu of Object.values(ctx.cli.menus || {})) {
        for (const [commandName, command] of Object.entries(
            menu.commands || {},
        )) {
            if (command.script == undefined) continue;
            const scriptPath = join(
                ctx.directory,
                `funcs/${command.script}.sh`,
            );
            if (!existsSync(scriptPath)) continue;
            const script = getFile(scriptPath);
            scriptFiles.push(`${command.script}.sh`);
            let definedArgs = '';
            let argCount = 1;
            for (const argName of Object.keys(command.args || {})) {
                definedArgs += `${argName}=$${argCount}\n`;
                argCount++;
            }
            scripts += buildFunc(
                commandName,
                command.description,
                definedArgs + script,
            );
        }
    }
    return scripts;
};

const parseBashCommands = (commands: Record<string, Command>, authLevel = 0) =>
    parseCommands(scriptFiles, 'bashCommand', 'sh', commands, authLevel);

const generateBashHelpCommand = (
    ctx: Context,
    name: string,
    commands: Record<string, Command>,
): string => {
    const helpMessage = generateHelpCommand(
        `Showing commands for the ${name} menu.`,
        parseBashCommands(commands),
    );
    let code = `printf "${helpMessage}"\n`;
    for (const authLevel of Object.keys(ctx.cli.auth || {})) {
        const authCommands = parseBashCommands(commands, parseInt(authLevel));
        if (!Object.keys(authCommands).length) continue;
        const authHelpMessage = generateHelpCommand(
            `\nAuth level ${authLevel} commands.`,
            authCommands,
        );
        code += `\nif [ "$AUTH_LEVEL" == "${authLevel}" ];
then
printf "${authHelpMessage}"
fi\n`;
    }
    return code;
};

const buildHeader = (menu: Menu): string => {
    if (!menu.header) return '';
    return `${BASH_TIME_VARIABLES}\nprintf "\${BG_DARK_GREY}${menu.header} $RESET"\necho ""`;
};

const valueToBash = (value: string | number | boolean): string =>
    typeof value == 'string' ? `"${value}"` : '' + value;

const buildArgCheck = (cmd: Command): string => {
    const args = cmd.args || {},
        argNames = Object.keys(args);
    let code = '';
    if (!argNames.length) return code;
    code = '# Argument validation.\n';
    let argCount = 1;
    for (const argName of argNames) {
        const arg = args[argName],
            argKeys = Object.keys(arg),
            internalArgName = argName;
        let minValueCheck = '',
            maxValueCheck = '';

        // The logic if an arg is not defined.
        let noDefinedArgLogic;
        if (Object.keys(arg).includes('default')) {
            noDefinedArgLogic = `${internalArgName}=${valueToBash(
                arg.default!,
            )}\n`;
        } else {
            const promptMessage = arg.promptMessage || capitalize(argName);
            const promptPrefix = DEFAULT_PROMPT_FORMAT.replace(
                '{PROMPT}',
                promptMessage,
            );
            noDefinedArgLogic = prompt(promptPrefix, internalArgName);
        }

        if (argKeys.includes('minValue')) {
            minValueCheck = `
if [ "$${internalArgName}" -lt "${arg.minValue}" ];
then
error "Arg '${argName}' must be at least ${arg.minValue}"
return
fi
`;
        }
        if (argKeys.includes('maxValue')) {
            maxValueCheck = `
if [ "$${internalArgName}" -ge "${arg.maxValue}" ];
then
error "Arg '${argName}' must be less than ${arg.maxValue}"
return
fi
`;
        }

        code += `${internalArgName}=\${parts[${argCount}]}
if [ "$${internalArgName}" == "" ];
then
    ${noDefinedArgLogic}
fi

${minValueCheck}
${maxValueCheck}
`;

        argCount++;
    }
    return tab(code, 2);
};

const includeArgsInScript = (cmd: Command): string | undefined => {
    if (!cmd.script) return undefined;
    const args = Object.keys(cmd.args || {});
    return `${cmd.script} ${args.map((arg) => `$${arg}`).join(' ')}`;
};

const buildAuthCheck = (cmd: Command): string => {
    if (!cmd.access) return '';
    return `
if [ "$AUTH_LEVEL" != "${cmd.access}" ];
then
auth_${cmd.access}
if [ "$?" != "0" ];
then
return 1
fi
fi
`;
};

const buildProcess = (ctx: Context, name: string, menu: Menu): string => {
    let code = `IFS=' ' read -ra parts <<< "$1"
case "\${parts[0]}" in`;

    const commands = Object.assign(copyObject<Command>(menu.commands || {}), {
        clear: {
            description: 'Clear the screen.',
            bashCommand: name,
            aliases: ['cls', 'c'],
        },
        exit: {
            description: 'Exit the CLI.',
            bashCommand: ['clear', 'exit 0'],
            aliases: ['ex', 'e'],
        },
        help: {
            description: `Show all the commands for the ${name} menu.`,
            aliases: ['?', 'h'],
            bashCommand: '.',
        },
    } as Record<string, Command>);
    if (ctx.cli.auth) {
        commands.auth = {
            description: 'Authenticate to an access level.',
            bashCommand: 'auth_$level',
            args: {
                level: {
                    maxValue:
                        Math.max(
                            ...Object.keys(ctx.cli.auth || {}).map(parseInt),
                        ) + 1,
                    minValue: 1,
                },
            },
        };
    }
    commands['*'] = {
        description: 'Invalid command.',
        bashCommand: 'error "\\"${parts[0]}\\" is not a valid command."',
    };
    commands.help.bashCommand = generateBashHelpCommand(ctx, name, commands);

    for (const [commandName, cmd] of Object.entries(commands)) {
        const command = [commandName];
        command.push(...(cmd.aliases || []));

        let commandLines: string[] = [],
            argCheck = '',
            authCheck = '';
        if (!scriptFiles.includes(`${commandName}.sh`) && !cmd.bashCommand) {
            // Unsupported command.
            commandLines = [
                `error "The '${commandName}' command is not supported for Unix."`,
            ];
        } else {
            // Supported command.
            commandLines = Array.isArray(cmd.bashCommand)
                ? cmd.bashCommand
                : [(includeArgsInScript(cmd) || cmd.bashCommand)!];
            authCheck = buildAuthCheck(cmd);
            argCheck = buildArgCheck(cmd);
        }
        const logic = commandLines.join('\n');

        code += `\n    # ${cmd.description}\n    ${command.join(
            ' | ',
        )})\n${authCheck}${argCheck}\n${logic}\n        ;;`;
    }
    code += '\nesac';

    return buildFunc(`process_${name}`, `Process a ${name} command.`, code);
};

const prompt = (prefix: string, variable = 'input', hidden = false) =>
    `printf "${prefix}"\nread ${
        hidden ? ' -s ' : ''
    }-p "" ${variable} < /dev/tty\nprintf $RESET`;

const buildPrompt = (ctx: Context, name: string, menu: Menu): string =>
    buildProcess(ctx, name, menu) +
    buildFunc(
        `prompt_${name}`,
        `Create the ${name} prompt.`,
        `${prompt(menu.prefix || '> ')}
if [ "$input" != "" ];
then
    process_${name} $input
fi

prompt_${name}`,
    );

const buildMenu = async (ctx: Context, name: string, menu: Menu) =>
    buildPrompt(ctx, name, menu) +
    buildFunc(
        name,
        `The ${name} menu.`,
        `# Set IFS to nothing to preserve new lines
IFS=

clear
${buildHeader(menu)}

printf "${await buildSplash(sanitizeBashString, menu.splash)}"
echo ""

if [ "$1" != true ];
then
    prompt_${name}
fi
`,
    );

const buildShortCommand = (name: string): string => {
    const code = `if [ "$c" != "" ];
then
    IFS=',' read -ra parts <<< "$c"
    process_${name} $parts
    exit
fi
`;

    return code;
};

export const buildBash = async (ctx: Context): Promise<string> => {
    let file = '#!/usr/bin/env bash\n';

    file += buildVariables();
    file += buildError();
    file += buildAuth(ctx);

    file += includeScripts(ctx);

    // Build all the menus
    for (const [name, menu] of Object.entries(ctx.cli.menus || {})) {
        file += await buildMenu(ctx, name, menu);
    }
    file += buildShortCommand(ctx.cli.mainMenu);
    file += ctx.cli.mainMenu;

    return file;
};

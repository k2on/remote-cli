import { join } from 'path';
import {
    COLOR_CODES,
    BASH_TIME_VARIABLES,
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
    getFile,
    sanitizeString,
    tab,
} from './util';

const buildFunc = (name: string, description: string, code: string): string =>
    `\n# ${description}\n${name} ()\n{\n${code.split('\n').join('\n')}\n}\n\n`;

const sanitizeBashString = (str: string): string =>
    sanitizeString(str, BASH_ESCAPE_CHARACTER, BASH_ESCAPE_CHARACTERS);

const buildVariables = () => {
    const variables: Record<string, string> = BASH_VARIABLES;

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

const generateHelpCommand = (
    name: string,
    commandsRefrence: Record<string, Command>,
): string[] => {
    const commands = Object.assign({}, commandsRefrence);
    delete commands['*'];
    const lines = [`echo "Showing commands for ${name} menu."`, 'echo ""'];
    const maxWidth = Math.max(
        ...Object.keys(commands).map((commandName) => commandName.length),
    );
    for (const [commandName, command] of Object.entries(commands)) {
        const padding = Array(maxWidth - commandName.length + 4).join(' ');
        lines.push(
            `printf "${commandName}${padding}\${CYAN}${command.description}$RESET\n"`,
        );
    }
    return lines;
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
    if (argNames.length == 0) return code;
    code = '# Argument validation.\n';
    let argCount = 1;
    for (const argName of argNames) {
        const arg = args[argName];
        const internalArgName = argName;

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

        code += `${internalArgName}=\${parts[${argCount}]}
if [ "$${internalArgName}" == "" ];
then
    ${noDefinedArgLogic}
fi
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

const buildProcess = (name: string, menu: Menu): string => {
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
        },
        '*': {
            description: 'Invalid command.',
            bashCommand: 'error "\\"${parts[0]}\\" is not a valid command."',
        },
    } as Record<string, Command>);
    commands.help.bashCommand = generateHelpCommand(name, commands);

    for (const [commandName, cmd] of Object.entries(commands)) {
        const command = [commandName];
        command.push(...(cmd.aliases || []));
        if (!cmd.script && !cmd.bashCommand)
            throw new Error(
                `Command: '${commandName}' must have a script or bashCommand`,
            );
        const commandLines: string[] = Array.isArray(cmd.bashCommand)
            ? cmd.bashCommand
            : [(includeArgsInScript(cmd) || cmd.bashCommand)!];
        const logic = tab(commandLines.join('\n'), 2);

        const argCheck = buildArgCheck(cmd);

        code += `\n    # ${cmd.description}\n    ${command.join(
            ' | ',
        )})\n${argCheck}\n${logic}\n        ;;`;
    }
    code += '\nesac';

    return buildFunc(`process_${name}`, `Process a ${name} command.`, code);
};

const prompt = (prefix: string, variable = 'input') =>
    `printf "${prefix}"\nread -p "" ${variable} < /dev/tty\nprintf $RESET`;

const buildPrompt = (name: string, menu: Menu): string =>
    buildProcess(name, menu) +
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

const buildMenu = async (name: string, menu: Menu) =>
    buildPrompt(name, menu) +
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

export const buildBash = async (ctx: Context): Promise<string> => {
    let file = '#!/usr/bin/env bash\n';

    file += buildVariables();
    file += buildError();

    file += includeScripts(ctx);

    // Build all the menus
    for (const [name, menu] of Object.entries(ctx.cli.menus || {})) {
        file += await buildMenu(name, menu);
    }

    file += ctx.cli.mainMenu;

    return file;
};

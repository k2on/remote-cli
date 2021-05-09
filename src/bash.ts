import { join } from 'path';
import {
    BASH_COLOR_CODES,
    BASH_TIME_VARIABLES,
    BASH_VARIABLES,
} from './constants';
import { Context, Menu, Command } from './type';
import { buildSplash, getFile } from './util';

const buildFunc = (name: string, description: string, code: string): string =>
    `\n# ${description}\n${name} ()\n{\n${code.split('\n').join('\n')}\n}\n\n`;

const buildVariables = () => {
    const variables: Record<string, string> = BASH_VARIABLES;

    for (const [colorName, number] of Object.entries(BASH_COLOR_CODES)) {
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
            scripts += buildFunc(commandName, command.description, script);
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

const buildProcess = (name: string, menu: Menu): string => {
    let code = `IFS=' ' read -ra parts <<< "$1"
case "\${parts[0]}" in`;

    const commands = Object.assign(menu.commands, {
        clear: {
            description: 'Clear the screen.',
            command: name,
            aliases: ['cls', 'c'],
        },
        exit: {
            description: 'Exit the CLI.',
            command: ['clear', 'exit 0'],
            aliases: ['ex', 'e'],
        },
        help: {
            description: `Show all the commands for the ${name} menu.`,
            aliases: ['?', 'h'],
        },
        '*': {
            description: 'Invalid command.',
            command: 'error "\\"${parts[0]}\\" is not a valid command."',
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
        const logic = commandLines.map((line) => `        ${line}`).join('\n');

        code += `\n    # ${cmd.description}\n    ${command.join(
            ' | ',
        )})\n${logic}\n        ;;`;
    }
    code += '\nesac';

    return buildFunc(`process_${name}`, `Process a ${name} command.`, code);
};

const prompt = (prefix: string) =>
    `printf "${prefix}"\nread -p "" input < /dev/tty`;

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

printf "${await buildSplash(menu.splash)}"
echo ""

if [ "$1" != true ];
then
    prompt_${name}
fi`,
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

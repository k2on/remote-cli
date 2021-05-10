import { join } from 'path';

export const CLI_FILE_NAME = 'cli.json';
export const OUT_DIRECTORY = './out';
export const WINDOWS_OUT_DIRECTORY = join(OUT_DIRECTORY, 'w/');

// Bash Variables
export const BASH_COLOR_CODES = {
    RESET: 0,
    BLACK: 30,
    RED: 31,
    GREEN: 32,
    YELLOW: 33,
    BLUE: 34,
    MAGENTA: 35,
    CYAN: 36,
    GREY: 37,
    DARK_GREY: 90,
    BRIGHT_RED: 91,
    BRIGHT_GREEN: 92,
    BRIGHT_YELLOW: 93,
    BRIGHT_BLUE: 94,
    BRIGHT_PURPLE: 95,
    BRIGHT_CYAN: 96,
    WHITE: 97,
    BG_BLACK: 40,
    BG_RED: 41,
    BG_GREEN: 42,
    BG_YELLOW: 43,
    BG_BLUE: 44,
    BG_MAGENTA: 45,
    BG_CYAN: 46,
    BG_GREY: 47,
    BG_DARK_GREY: 100,
    BG_BRIGHT_RED: 101,
    BG_BRIGHT_GREEN: 102,
    BG_BRIGHT_YELLOW: 103,
    BG_BRIGHT_BLUE: 104,
    BG_BRIGHT_PURPLE: 105,
    BG_BRIGHT_CYAN: 106,
    BG_WHITE: 107,
};

export const BASH_VARIABLES = {
    USER: '$(whoami)',
};

export const BASH_TIME_VARIABLES = 'TIME=`date "+%m/%d/%Y %H:%M:%S"`';

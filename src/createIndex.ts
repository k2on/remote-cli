import { CLI } from './type';

export const createIndexFile = (
    cli: CLI,
    script: string,
    runCommand: string,
    scriptType: 'bash' | 'cmd',
    firstLine: '#!/usr/bin/env bash' | '@echo off',
    comment: '#' | ':',
    tagComment: '##' | 'REM',
): string => `${firstLine}

${tagComment} <script src="./readability_${scriptType}.js"></script>
${tagComment} <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/themes/prism-okaidia.min.css" rel="stylesheet" />
${tagComment} <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/components/prism-core.min.js" data-manual></script>
${tagComment} <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/components/prism-bash.min.js"></script>
${tagComment} <style>body {color: #272822; background-color: #272822; font-size: 0.8em;} </style>
: ==========================================
:   Introduction
: ==========================================

${comment} ${cli.description || 'Remote CLI.'}
${comment}
: ${runCommand}
${comment}

: ==========================================
:   Advanced Usage
: ==========================================

${comment} The behavior of this script can be modified at runtime by passing environmental
${comment} variables to the \`${scriptType}\` process.
${comment}
${comment} For example, passing an argument called arg1 set to true and one called arg2 set
${comment} to false would look like this.
${comment} TODO: IDK FIX THIS
: curl ${cli.uri} | arg1=true arg2=false bash
${comment}
${comment} These arguments are optional, but be aware that explicitly setting them will help
${comment} ensure consistent behavior if / when defaults are changed.
${comment}

: ==========================================
:   Source Code
: ==========================================

${comment} This script contains a large amount of comments so you can understand
${comment} how it interacts with your system. If you're not interested in the
${comment} technical details, you can just run the command above.

${script}

${comment} ------------------------------------------
${comment}   Notes
${comment} ------------------------------------------
${comment}
${comment} This script contains hidden JavaScript which is used to improve
${comment} readability in the browser (via syntax highlighting, etc), right-click
${comment} and "View source" of this page to see the entire ${scriptType} script!
${comment}
${comment} You'll also notice that we use the ":" character in the Introduction
${comment} which allows our copy/paste commands to be syntax highlighted, but not
${comment} ran. In ${scriptType} : is equal to  and true can take infinite arguments
${comment} while still returning true. This turns these commands into no-ops so
${comment} when ran as a script, they're totally ignored.
${comment}`;

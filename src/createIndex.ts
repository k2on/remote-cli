import { CLI } from './type';

export const createIndexFile = (
    cli: CLI,
    script: string,
): string => `#!/usr/bin/env bash

## <script src="./readability.js"></script>
## <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/themes/prism-okaidia.min.css" rel="stylesheet" />
## <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/components/prism-core.min.js" data-manual></script>
## <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/components/prism-bash.min.js"></script>
## <style>body {color: #272822; background-color: #272822; font-size: 0.8em;} </style>
: ==========================================
:   Introduction
: ==========================================

# ${cli.description || 'Remote CLI.'}
#
: curl ${cli.uri} | bash
#

: ==========================================
:   Advanced Usage
: ==========================================

# The behavior of this script can be modified at runtime by passing environmental
# variables to the \`bash\` process.
#
# For example, passing an argument called arg1 set to true and one called arg2 set
# to false would look like this.
#
: curl ${cli.uri} | arg1=true arg2=false bash
#
# These arguments are optional, but be aware that explicitly setting them will help
# ensure consistent behavior if / when defaults are changed.
#

: ==========================================
:   Source Code
: ==========================================

# This script contains a large amount of comments so you can understand
# how it interacts with your system. If you're not interested in the
# technical details, you can just run the command above.

${script}

# ------------------------------------------
#   Notes
# ------------------------------------------
#
# This script contains hidden JavaScript which is used to improve
# readability in the browser (via syntax highlighting, etc), right-click
# and "View source" of this page to see the entire bash script!
#
# You'll also notice that we use the ":" character in the Introduction
# which allows our copy/paste commands to be syntax highlighted, but not
# ran. In bash : is equal to  and true can take infinite arguments
# while still returning true. This turns these commands into no-ops so
# when ran as a script, they're totally ignored.
#`;

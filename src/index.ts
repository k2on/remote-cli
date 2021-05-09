#!/usr/bin/env node

import { build } from './build';

const args = process.argv;
args.splice(0, 2);
const directory = args[0] || './';

build(directory);

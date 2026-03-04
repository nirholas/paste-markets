#!/usr/bin/env node

import { runWrapper } from "./run-trade-wrapper-lib.mjs";

const exitCode = runWrapper(process.argv[2]);
process.exit(exitCode);

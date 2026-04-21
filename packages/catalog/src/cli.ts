#!/usr/bin/env node
import { buildProgram } from './cli/program';

void buildProgram().parseAsync(process.argv);

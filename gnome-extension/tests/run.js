// Single entry point: `gjs -m tests/run.js` (gjs -m runs only one module).
import System from 'system';
import {runAll} from './harness.js';

import './fixtures.test.js';
import './model.filter.test.js';
import './model.normalize.test.js';

const failures = runAll();
System.exit(failures === 0 ? 0 : 1);

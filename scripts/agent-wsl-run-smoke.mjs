import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./agent-wsl-run.ps1', import.meta.url), 'utf8');

assert(script.includes('ValueFromRemainingArguments'), 'helper should forward arbitrary commands');
assert(script.includes('PositionalBinding = $false'), 'helper should not treat forwarded commands as named parameters');
assert(script.includes('\\\\wsl\\.localhost'), 'helper should support wsl.localhost UNC paths');
assert(script.includes('\\\\wsl\\$'), 'helper should support legacy wsl$ UNC paths');
assert(script.includes('wsl.exe -d $Distro --exec /bin/bash -lc'), 'helper should run through WSL bash');
assert(script.includes('bash scripts/agent-healthcheck.sh'), 'helper should default to the agent healthcheck through bash');
assert(!script.includes('git reset --hard'), 'helper must not run destructive git commands');
assert(!script.includes('git checkout --'), 'helper must not discard working tree changes');

console.log('Agent WSL runner smoke passed.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./agent-wsl-run.ps1', import.meta.url), 'utf8');
const quickstart = readFileSync(new URL('../AGENT_QUICKSTART.md', import.meta.url), 'utf8');

assert(script.includes('ValueFromRemainingArguments'), 'helper should forward arbitrary commands');
assert(script.includes('PositionalBinding = $false'), 'helper should not treat forwarded commands as named parameters');
assert(script.includes('\\\\wsl\\.localhost'), 'helper should support wsl.localhost UNC paths');
assert(script.includes('\\\\wsl\\$'), 'helper should support legacy wsl$ UNC paths');
assert(script.includes('wsl.exe -d $Distro --exec /bin/bash -lc'), 'helper should run through WSL bash');
assert(script.includes('bash scripts/agent-healthcheck.sh'), 'helper should default to the agent healthcheck through bash');
assert(!script.includes('git reset --hard'), 'helper must not run destructive git commands');
assert(!script.includes('git checkout --'), 'helper must not discard working tree changes');
assert(quickstart.includes('`\\\\wsl.localhost\\...`'), 'quickstart should document the Windows UNC terminal failure mode');
assert(quickstart.includes('Windows `cmd.exe` does not support UNC current directories'), 'quickstart should explain why direct npm runs fail from UNC');
assert(quickstart.includes('powershell -ExecutionPolicy Bypass -File scripts/agent-wsl-run.ps1'), 'quickstart should show the WSL wrapper command');
assert(quickstart.includes('scripts/agent-wsl-run.ps1 npm run ui:shell-smoke'), 'quickstart should show targeted command recovery through the wrapper');

console.log('Agent WSL runner smoke passed.');

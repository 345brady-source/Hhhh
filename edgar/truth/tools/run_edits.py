"""Run a file of sheet_edit.py commands in one call: python3 -I run_edits.py <id> <commands.txt>; one command per line (shlex)."""
import shlex, subprocess, sys
T = __import__('os').path.dirname(__import__('os').path.abspath(__file__))
i, f = sys.argv[1], sys.argv[2]
n = bad = 0
for line in open(f):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    r = subprocess.run(['python3', '-I', T + '/sheet_edit.py', '--id', i] + shlex.split(line), capture_output=True, text=True)
    n += 1
    if r.returncode:
        bad += 1
        print('ERR', line[:80], r.stdout.strip(), r.stderr.strip()[-200:])
    elif r.stdout.strip():
        print(r.stdout.strip())
print('ran %d, errors %d' % (n, bad))

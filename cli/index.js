
import path from 'node:path';

export function parseCliArgs(args = []) {
  const result = {
    help: false,
    version: false,
    verbose: false,
    newWindow: false,
    reuseWindow: false,
    paths: [],
    errors: [],
  };

  let positionalOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (positionalOnly) { result.paths.push(arg); continue; }
    if (arg === '--') { positionalOnly = true; continue; }

    switch (arg) {
      case '-h':
      case '--help':
        result.help = true;
        break;

      case '-v':
      case '--version':
        result.version = true;
        break;

      case '--verbose':
        result.verbose = true;
        break;

      case '-n':
      case '--new-window':
        result.newWindow = true;
        break;

      case '-r':
      case '--reuse-window':
        result.reuseWindow = true;
        break;

      default:
        if (arg.startsWith('-')) {
          result.errors.push(`Unknown option: ${arg}`);
        } else {
          result.paths.push(arg);
        }
    }
  }

  if (result.newWindow && result.reuseWindow) {
    result.errors.push('--new-window and --reuse-window cannot be used together.');
  }

  return result;
}

export function resolveCliPaths(paths, cwd = process.cwd()) {
  return paths.map((target) => path.resolve(cwd, target));
}

export function getHelpText() {
  return `
Scripter - Code Editor

Usage:
  scripter [options] [paths...]

Examples:
  scripter
  scripter .
  scripter ./my-project
  scripter ./src/App.jsx
  scripter App.jsx App.css
  scripter --verbose .

Options:
  -h, --help          Show this help
  -v, --version       Show application version
  -n, --new-window    Open in a new window
  -r, --reuse-window  Reuse an existing window
      --verbose       Enable verbose logging

`;
}

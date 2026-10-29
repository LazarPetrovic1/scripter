import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import packageJson from './package.json' with { type: "json" };
import semver from 'semver';
import minimist from 'minimist';  // Add this to parse command-line arguments
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, 'package.json');
// Parse command-line arguments
const args = minimist(process.argv.slice(2));
const versionType = args.type || 'patch';  // Default to 'patch' if --type is not provided
const newVersion = semver.inc(packageJson.version, versionType);
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
console.log(`Updated version to ${newVersion}`);
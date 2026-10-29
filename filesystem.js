import ignore from "ignore";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import * as path from "path";

const DEFAULT_IGNORES = [
  'node_modules/', '.git/', '.hg/', '.svn/', 'dist/', 'build/',
  'coverage/', '.next/', '.nuxt/', '.turbo/', '.cache/', 'vendor/',
];

async function readIgnoreRules(directory) {
  try {
    const content = await readFile(path.join(directory, '.gitignore'), 'utf8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function searchWorkspaceFiles() {
  if (!workspaceRoot) throw new Error('Open a workspace first.');
  const results = [];
  async function walk(directory, relativeDirectory = '', inheritedRules = []) {
    const localContent = await readIgnoreRules(directory);
    const rules = [...inheritedRules];
    if (relativeDirectory === '') {
      rules.push({ base: '', matcher: ignore().add(DEFAULT_IGNORES).add(localContent) });
    } else if (localContent) {
      rules.push({ base: relativeDirectory, matcher: ignore().add(localContent) });
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (!entry.isFile() && !entry.isDirectory()) continue;
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const ignored = rules.some(({ base, matcher }) => {
        const candidate = base ? relative.slice(base.length + 1) : relative;
        return matcher.ignores(candidate);
      });

      if (ignored) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute, relative, rules);
      else results.push({ name: entry.name, path: absolute, kind: 'file' });
    }
  }

  await walk(workspaceRoot);

  return results.sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

let workspaceRoot = null;

async function setWorkspace(root) {
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Workspace must be a real directory.");
  workspaceRoot = await realpath(root);
  return workspaceRoot;
}

function getWorkspace() { return workspaceRoot; }

function resolveWorkspacePath(input) {
  if (!workspaceRoot) throw new Error("Open a workspace first.");
  if (typeof input !== "string" || input.trim() === "") throw new Error("A valid path is required.");
  const resolved = path.resolve(workspaceRoot, input);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error("Path is outside the workspace.");
  return resolved;
}

async function assertSafeExisting(input) {
  const resolved = resolveWorkspacePath(input);
  const info = await lstat(resolved);
  if (info.isSymbolicLink()) throw new Error("Symbolic links are not supported in this version.");
  const canonical = await realpath(resolved);
  resolveWorkspacePath(canonical);
  return canonical;
}

async function assertSafeNew(input) {
  const resolved = resolveWorkspacePath(input);
  const parent = await realpath(path.dirname(resolved));
  resolveWorkspacePath(parent);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink())
    throw new Error("Parent must be a real directory.");
  return path.join(parent, path.basename(resolved));
}

async function readDirectory(input) {
  const directory = await assertSafeExisting(input);
  const info = await lstat(directory);
  if (!info.isDirectory()) throw new Error("Path is not a directory.");
  const items = await readdir(directory, { withFileTypes: true });
  const entries = [];
  for (const item of items) {
    if (item.isSymbolicLink()) continue;
    if (!item.isFile() && !item.isDirectory()) continue;
    entries.push({
      name: item.name,
      path: path.join(directory, item.name),
      kind: item.isDirectory() ? "directory" : "file",
    });
  }

  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function readTextFile(input) {
  const file = await assertSafeExisting(input);
  const info = await lstat(file);
  if (!info.isFile()) throw new Error("Path is not a regular file.");
  return readFile(file, "utf8");
}

async function writeTextFile(input, content) {
  if (typeof content !== "string") throw new Error("File content must be text.");
  const file = await assertSafeNew(input);
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error("Target must be a regular file.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(file, content, "utf8");
}

async function createFile(input) {
  const file = await assertSafeNew(input);
  const { open } = await import("node:fs/promises");
  const handle = await open(file, "wx");
  await handle.close();
}

async function createDirectory(input) {
  const directory = await assertSafeNew(input);
  await mkdir(directory);
}

async function renamePath(from, to) {
  const source = await assertSafeExisting(from);
  const destination = await assertSafeNew(to);
  const info = await lstat(source);
  if (info.isDirectory()) {
    const relative = path.relative(source, destination);
    if (relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`)))
      throw new Error("Cannot move a directory into itself.");
  }
  try {
    await lstat(destination);
    throw new Error("Destination already exists.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  await rename(source, destination);
}

async function deletePath(input) {
  const target = await assertSafeExisting(input);
  if (target === workspaceRoot) throw new Error("Cannot delete the workspace root.");
  await rm(target, { recursive: true, force: false });
}

export {
  createDirectory,
  createFile,
  deletePath,
  getWorkspace,
  readDirectory,
  readTextFile,
  renamePath,
  setWorkspace,
  writeTextFile,
  searchWorkspaceFiles
}
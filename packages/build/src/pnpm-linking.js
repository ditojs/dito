/* eslint-disable no-console */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync
} from 'node:fs'
import { relative, resolve } from 'node:path'

// Resolve workspace package directories for a sibling workspace.  For
// monorepos, parses pnpm-workspace.yaml to find all packages.  For
// single-package repos, returns the workspace root.
function getWorkspacePackages(name) {
  const dir = resolve('..', name)
  const workspaceFile = resolve(dir, 'pnpm-workspace.yaml')
  if (!existsSync(workspaceFile)) {
    return [{ dir, ...readPackageMeta(dir) }]
  }
  const content = readFileSync(workspaceFile, 'utf8')
  const packages = []
  for (const [, prefix] of content.matchAll(/- ['"]?(.+?)\/\*['"]?/g)) {
    const pkgDir = resolve(dir, prefix)
    for (const entry of readdirSync(pkgDir)) {
      const pkgPath = resolve(pkgDir, entry)
      if (existsSync(resolve(pkgPath, 'package.json'))) {
        packages.push({ dir: pkgPath, ...readPackageMeta(pkgPath) })
      }
    }
  }
  return packages
}

function readPackageMeta(dir) {
  const { name } = JSON.parse(
    readFileSync(resolve(dir, 'package.json'), 'utf8')
  )
  const parts = name.split('/')
  const scoped = parts.length === 2
  return {
    name,
    // Subpath within node_modules (e.g. '@scope/pkg' -> ['@scope', 'pkg'])
    moduleParts: scoped ? [parts[0], parts[1]] : [name],
    // .pnpm directory prefix (e.g. '@scope/pkg' -> '@scope+pkg@')
    pnpmPrefix: scoped ? `${parts[0]}+${parts[1]}@` : `${name}@`
  }
}

// Yield [pkgDir, entry] pairs from .pnpm/ matching a package.
function* getPnpmEntries(pnpmDir, { moduleParts, pnpmPrefix }) {
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry.startsWith(pnpmPrefix)) {
        const dir = resolve(pnpmDir, entry, 'node_modules', ...moduleParts)
        if (existsSync(dir)) {
          yield [dir, entry]
        }
      }
    }
  }
}

function replaceWithSymlink(target, pkgDir) {
  rmSync(target, { recursive: true, force: true })
  symlinkSync(pkgDir, target)
}

export function link(names) {
  const linkedNames = new Set()
  const repoDirs = []
  const nodeModules = resolve('node_modules')
  const pnpmDir = resolve(nodeModules, '.pnpm')

  for (const name of names) {
    repoDirs.push(resolve('..', name))

    for (const meta of getWorkspacePackages(name)) {
      linkedNames.add(meta.name)
      const { moduleParts } = meta

      // Replace the top-level symlink with a direct link to the local
      // workspace.
      const target = resolve(nodeModules, ...moduleParts)
      if (moduleParts.length > 1) {
        mkdirSync(resolve(nodeModules, moduleParts[0]), { recursive: true })
      }
      replaceWithSymlink(target, meta.dir)
      console.log(`  linked ${meta.name} → ${meta.dir}`)

      // Also replace real directories inside .pnpm/ so that other packages that
      // depend on this one also resolve to the local workspace.
      for (const [dir, entry] of getPnpmEntries(pnpmDir, meta)) {
        if (!lstatSync(dir).isSymbolicLink()) {
          replaceWithSymlink(dir, meta.dir)
          console.log(`  linked .pnpm/${entry} → ${meta.dir}`)
        }
      }
    }
  }

  // Symlink missing dependencies from linked repos into node_modules, so that
  // bundlers with preserveSymlinks can resolve them from the symlink location.
  function symlinkIfMissing(source, target, name) {
    if (linkedNames.has(name)) return
    // Use lstatSync to detect broken symlinks that existsSync would miss.
    if (lstatSync(target, { throwIfNoEntry: false })) return
    symlinkSync(source, target)
    console.log(`  symlinked ${name}`)
  }

  for (const repoDir of repoDirs) {
    const repoModules = resolve(repoDir, 'node_modules')
    if (!existsSync(repoModules)) continue
    for (const entry of readdirSync(repoModules)) {
      if (entry.startsWith('.')) continue
      if (entry.startsWith('@')) {
        const scopeDir = resolve(repoModules, entry)
        const localScopeDir = resolve(nodeModules, entry)
        for (const scopedEntry of readdirSync(scopeDir)) {
          mkdirSync(localScopeDir, { recursive: true })
          symlinkIfMissing(
            resolve(scopeDir, scopedEntry),
            resolve(localScopeDir, scopedEntry),
            `${entry}/${scopedEntry}`
          )
        }
      } else {
        symlinkIfMissing(
          resolve(repoModules, entry),
          resolve(nodeModules, entry),
          entry
        )
      }
    }
  }
}

export function unlink(names) {
  const nodeModules = resolve('node_modules')
  const pnpmDir = resolve(nodeModules, '.pnpm')

  for (const name of names) {
    for (const meta of getWorkspacePackages(name)) {
      // Remove the top-level linked symlink.
      rmSync(resolve(nodeModules, ...meta.moduleParts), { force: true })
      console.log(`  unlinked ${meta.name}`)

      // Remove linked symlinks inside .pnpm/.
      for (const [dir, entry] of getPnpmEntries(pnpmDir, meta)) {
        if (lstatSync(dir).isSymbolicLink()) {
          rmSync(dir, { force: true })
          console.log(`  unlinked .pnpm/${entry}`)
        }
      }
    }
  }
}

export function listLinks() {
  const nodeModules = resolve('node_modules')
  const parentDir = resolve('..')
  const repos = new Set()

  function checkEntry(target) {
    const stat = lstatSync(target, { throwIfNoEntry: false })
    if (!stat?.isSymbolicLink()) return
    const linkTarget = readlinkSync(target)
    const resolved = resolve(target, '..', linkTarget)
    // A linked symlink points outside node_modules
    if (!resolved.startsWith(nodeModules)) {
      const rel = relative(parentDir, resolved)
      if (!rel.startsWith('..')) {
        repos.add(rel.split('/')[0])
      }
    }
  }

  for (const entry of readdirSync(nodeModules)) {
    if (entry.startsWith('.')) continue
    if (entry.startsWith('@')) {
      const scopeDir = resolve(nodeModules, entry)
      for (const scopedEntry of readdirSync(scopeDir)) {
        checkEntry(resolve(scopeDir, scopedEntry))
      }
    } else {
      checkEntry(resolve(nodeModules, entry))
    }
  }

  return [...repos]
}

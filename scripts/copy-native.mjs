/**
 * copy-native.mjs
 *
 * Copies native .node binaries from pnpm's virtual store into the package
 * directories that electron-builder knows about, so they get bundled in the
 * packaged app. This is needed because pnpm installs optional-dep platform
 * packages into the virtual store (.pnpm/) but does NOT create a top-level
 * node_modules symlink for them, which electron-builder doesn't traverse.
 */

import { readFileSync, existsSync, cpSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const pnpmStore = join(root, 'node_modules', '.pnpm')

/**
 * Each entry describes a NAPI-RS package that ships its binary as a separate
 * optional-dep package.
 *
 * - `destPackage`:   the package folder in node_modules that needs the binary
 * - `binaryPackage`: the optional-dep package name containing the .node file
 * - `binaryFile`:    the .node filename inside that optional-dep package
 */
const nativeModules = [
    {
        destPackage: 'node-screenshots',
        binaryPackage: 'node-screenshots-win32-x64-msvc',
        binaryVersion: '0.2.8',
        binaryFile: 'node-screenshots.win32-x64-msvc.node',
    },
]

for (const mod of nativeModules) {
    const src = join(
        pnpmStore,
        `${mod.binaryPackage}@${mod.binaryVersion}`,
        'node_modules',
        mod.binaryPackage,
        mod.binaryFile,
    )

    const destDir = join(root, 'node_modules', mod.destPackage)
    const dest = join(destDir, mod.binaryFile)

    if (!existsSync(src)) {
        console.warn(`[copy-native] WARNING: Source not found, skipping: ${src}`)
        continue
    }

    if (existsSync(dest)) {
        console.log(`[copy-native] Already exists, skipping: ${dest}`)
        continue
    }

    mkdirSync(destDir, { recursive: true })
    cpSync(src, dest)
    console.log(`[copy-native] Copied ${mod.binaryFile} → ${destDir}`)
}

console.log('[copy-native] Done.')

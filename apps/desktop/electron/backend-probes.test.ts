/**
 * Tests for electron/backend-probes.ts.
 *
 * Run with: node --test electron/backend-probes.test.ts
 * (Wired into npm test:desktop:platforms in package.json.)
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  canImportVetriCli,
  DEFAULT_PROBE_TIMEOUT_MS,
  execProbe,
  PROBE_TIMEOUT_MS,
  resolveProbeTimeoutMs,
  shouldTrustVetriOverride,
  verifyVetriCli
} from './backend-probes'

// Resolve the host's own Node binary -- guaranteed to be on disk and
// runnable. We use it as both a stand-in for "a python that doesn't
// have vetri_cli" (since `node -c "import vetri_cli"` will exit
// non-zero) and as a way to script verifyVetriCli's success path
// (a tiny script we write to disk that exits 0 on --version).
const NODE_BIN = process.execPath

test('execProbe keeps the parent event loop available to the child', async () => {
  let unexpectedSocketError: Error | undefined

  const server = net.createServer(socket => {
    socket.on('error', error => {
      // A successful child exits immediately after reading the sentinel. On
      // Windows that peer close can surface as ECONNRESET on the server side.
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') {
        unexpectedSocketError ??= error
      }
    })
    socket.end('pong')
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object')

  const childScript = `
    const net = require('node:net')
    let reply = ''
    const socket = net.createConnection(${address.port}, '127.0.0.1')
    socket.setEncoding('utf8')
    socket.on('data', (chunk) => { reply += chunk })
    socket.on('end', () => process.exit(reply === 'pong' ? 0 : 1))
    socket.on('error', () => process.exit(1))
  `

  try {
    await execProbe(NODE_BIN, ['-e', childScript], {
      stdio: 'ignore',
      timeout: 5_000,
      windowsHide: true
    })
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()))
    })
  }

  assert.ifError(unexpectedSocketError)
})

test('canImportVetriCli returns false when path is falsy', async () => {
  assert.equal(await canImportVetriCli(''), false)
  assert.equal(await canImportVetriCli(null), false)
  assert.equal(await canImportVetriCli(undefined), false)
})

test('canImportVetriCli returns false when interpreter cannot run -c', async () => {
  // node IS an interpreter, but `node -c "import vetri_cli"` is a
  // SyntaxError -- different exit reason from a real Python's
  // ModuleNotFoundError, but the predicate is "exit 0 or not" and
  // both land on "not", which is exactly what we want for the
  // resolver fall-through.
  assert.equal(await canImportVetriCli(NODE_BIN), false)
})

test('canImportVetriCli returns false when binary does not exist', async () => {
  const ghost = path.join(os.tmpdir(), 'vetri-probes-ghost-' + Date.now() + '.exe')
  assert.equal(await canImportVetriCli(ghost), false)
})

test('explicit Vetri override is authoritative', () => {
  assert.equal(shouldTrustVetriOverride('/nix/store/abc/bin/vetri'), true)
})

test('empty Vetri override is not authoritative', () => {
  assert.equal(shouldTrustVetriOverride(''), false)
  assert.equal(shouldTrustVetriOverride(undefined), false)
})

test('verifyVetriCli returns false when command is falsy', async () => {
  assert.equal(await verifyVetriCli(''), false)
  assert.equal(await verifyVetriCli(null), false)
  assert.equal(await verifyVetriCli(undefined), false)
})

test('verifyVetriCli returns false when binary does not exist', async () => {
  const ghost = path.join(os.tmpdir(), 'vetri-probes-ghost-' + Date.now() + '.exe')
  assert.equal(await verifyVetriCli(ghost), false)
})

test('verifyVetriCli accepts an actual zero-exit executable', async (): Promise<void> => {
  assert.equal(await verifyVetriCli(NODE_BIN), true)
})

// #74064: with shell:true the command line goes through a shell (cmd.exe on
// Windows, /bin/sh here), which truncates an unquoted executable at the first
// space — `C:\Users\John Doe\...\vetri.cmd --version` runs `C:\Users\John`.
// The same truncation reproduces on POSIX sh, so this is a real behavioral
// test of the quoting, not a platform-conditional one. Windows gets its own
// lane: there the quoted form goes through cmd.exe /s semantics instead.
test.skipIf(process.platform === 'win32')(
  'verifyVetriCli quotes a spaced executable path when probing through a shell',
  async (): Promise<void> => {
    const spacedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vetri probe-'))
    const spacedCmd = path.join(spacedDir, 'vetri.cmd')
    fs.writeFileSync(spacedCmd, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    fs.chmodSync(spacedCmd, 0o755)

    try {
      // Unquoted (the pre-fix wiring): the shell truncates at the space → 127.
      await execProbe(spacedCmd, ['--version'], {
        stdio: 'ignore',
        timeout: 5_000,
        shell: true,
        windowsHide: true
      })
      assert.fail('unquoted spaced path must fail through the shell')
    } catch {
      // expected: the shell could not run the truncated command
    }

    // verifyVetriCli wraps the same failure: off-Windows the helper is a
    // no-op (POSIX sh truncates identically), so the spaced-path probe
    // reports the backend missing — exactly the #74064 symptom. The quoting
    // itself is covered by the windowsShellCommand unit tests and runs on
    // the Windows lane.
    assert.equal(await verifyVetriCli(spacedCmd, { shell: true }), false)

    // Direct execution (shell: false) never goes through a shell, so a
    // spaced path works as-is — the fix must not leak into the non-shell path.
    assert.equal(await verifyVetriCli(spacedCmd, { shell: false }), true)

    fs.rmSync(spacedDir, { recursive: true, force: true })
  }
)

test('default probe timeout is 15s (not the old 5s death-loop value)', () => {
  assert.equal(DEFAULT_PROBE_TIMEOUT_MS, 15_000)
  // Module constant uses process.env at load time; with no override it
  // matches the default (tests run without VETRI_PROBE_TIMEOUT_MS).
  assert.equal(PROBE_TIMEOUT_MS, DEFAULT_PROBE_TIMEOUT_MS)
})

test('resolveProbeTimeoutMs honours VETRI_PROBE_TIMEOUT_MS', () => {
  assert.equal(resolveProbeTimeoutMs({}), DEFAULT_PROBE_TIMEOUT_MS)
  assert.equal(resolveProbeTimeoutMs({ VETRI_PROBE_TIMEOUT_MS: '30000' }), 30_000)
  assert.equal(resolveProbeTimeoutMs({ VETRI_PROBE_TIMEOUT_MS: '0' }), DEFAULT_PROBE_TIMEOUT_MS)
  assert.equal(resolveProbeTimeoutMs({ VETRI_PROBE_TIMEOUT_MS: 'nope' }), DEFAULT_PROBE_TIMEOUT_MS)
  // Cap runaway values
  assert.equal(resolveProbeTimeoutMs({ VETRI_PROBE_TIMEOUT_MS: '999999' }), 120_000)
})

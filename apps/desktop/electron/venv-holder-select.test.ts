import assert from 'node:assert/strict'

import { test } from 'vitest'

import { hasWindowsPathPrefix, isExternalVenvHolder, isVetriOwnedVenvDaemon } from './venv-holder-select'

const SCRIPTS = 'C:\\Vetri\\venv\\Scripts'

test('matches the hindsight daemon shim (exe under venv Scripts + hindsight cmdline)', () => {
  assert.equal(
    isVetriOwnedVenvDaemon(
      'C:\\Vetri\\venv\\Scripts\\pythonw.exe',
      'C:\\Vetri\\venv\\Scripts\\pythonw.exe -m hindsight_api.main --daemon --idle-timeout 300 --port 9177',
      SCRIPTS
    ),
    true
  )
})

test('Windows path prefix match is ordinal case-insensitive', () => {
  assert.equal(
    isVetriOwnedVenvDaemon(
      'c:\\vetri\\venv\\scripts\\python.exe',
      'python.exe -m hindsight_api.main --daemon',
      'C:\\Vetri\\venv\\Scripts'
    ),
    true
  )
})

test('excludes external venv holders that are not the hindsight daemon', () => {
  // a user terminal running the vetri CLI from the venv — must NOT be killed
  assert.equal(isVetriOwnedVenvDaemon('C:\\Vetri\\venv\\Scripts\\vetri.exe', 'vetri chat -q "hi"', SCRIPTS), false)
  // an unrelated python script using the venv interpreter
  assert.equal(
    isVetriOwnedVenvDaemon('C:\\Vetri\\venv\\Scripts\\python.exe', 'python C:\\tools\\import.py', SCRIPTS),
    false
  )
})

test('excludes exes outside the venv even when the cmdline mentions hindsight', () => {
  assert.equal(
    isVetriOwnedVenvDaemon('C:\\Other\\pythonw.exe', 'pythonw -m hindsight_api.main --daemon', SCRIPTS),
    false
  )
})

test('prefix boundary: sibling dirs (ScriptsX) do not match', () => {
  assert.equal(hasWindowsPathPrefix('C:\\Vetri\\venv\\ScriptsX\\python.exe', SCRIPTS), false)
  assert.equal(hasWindowsPathPrefix('C:\\Vetri\\venv\\Scripts\\python.exe', SCRIPTS), true)
})

test('null/undefined fields never match', () => {
  assert.equal(isVetriOwnedVenvDaemon(null, 'x', SCRIPTS), false)
  assert.equal(isVetriOwnedVenvDaemon('C:\\Vetri\\venv\\Scripts\\pythonw.exe', null, SCRIPTS), false)
  assert.equal(isVetriOwnedVenvDaemon(undefined, undefined, SCRIPTS), false)
})

// --- isExternalVenvHolder (#62311) ------------------------------------------

test('matches the autostart gateway shim (vetri.exe under venv Scripts)', () => {
  assert.equal(
    isExternalVenvHolder(
      'C:\\Vetri\\venv\\Scripts\\vetri.exe',
      '"C:\\Vetri\\venv\\Scripts\\vetri.exe" gateway run --external-supervisor',
      SCRIPTS
    ),
    true
  )
})

test('matches the dashboard scheduled task (python -m vetri_cli / -m vetri)', () => {
  assert.equal(
    isExternalVenvHolder(
      'C:\\Vetri\\venv\\Scripts\\python.exe',
      '"C:\\Vetri\\venv\\Scripts\\python.exe" -m vetri_cli.main dashboard',
      SCRIPTS
    ),
    true
  )
  assert.equal(
    isExternalVenvHolder('C:\\Vetri\\venv\\Scripts\\pythonw.exe', 'pythonw.exe -m vetri serve', SCRIPTS),
    true
  )
})

test('never matches an unrelated process that merely borrows the venv interpreter', () => {
  // a user's own script running on the venv python — NOT Vetri, must NOT be killed
  assert.equal(
    isExternalVenvHolder('C:\\Vetri\\venv\\Scripts\\python.exe', 'python C:\\tools\\import.py', SCRIPTS),
    false
  )
  // hindsight daemon is selected by isVetriOwnedVenvDaemon, not here
  assert.equal(
    isExternalVenvHolder('C:\\Vetri\\venv\\Scripts\\pythonw.exe', 'pythonw -m hindsight_api.main --daemon', SCRIPTS),
    false
  )
})

test('never matches a process outside the venv, even with vetri in the cmdline', () => {
  // an editor / shell whose command line mentions the install root (#62445 regression guard)
  assert.equal(
    isExternalVenvHolder('C:\\Windows\\System32\\cmd.exe', 'cmd /c cd C:\\Vetri\\venv\\Scripts && dir', SCRIPTS),
    false
  )
  assert.equal(isExternalVenvHolder('C:\\Other\\vetri.exe', 'vetri gateway run', SCRIPTS), false)
})

test('sibling-dir and boundary safety for the external selector', () => {
  assert.equal(isExternalVenvHolder('C:\\Vetri\\venv\\ScriptsX\\vetri.exe', 'vetri gateway run', SCRIPTS), false)
  assert.equal(isExternalVenvHolder(null, 'vetri gateway run', SCRIPTS), false)
  assert.equal(isExternalVenvHolder('C:\\Vetri\\venv\\Scripts\\vetri.exe', null, SCRIPTS), false)
})

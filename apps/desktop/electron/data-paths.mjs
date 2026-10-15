// data-paths.mjs — the pure path-resolution core, shared by the desktop app
// (via data-paths.ts, a typed re-export) and the CI smoke driver (which runs
// under Node's type-stripping and therefore cannot import the app's
// extensionless TypeScript directly). No Electron imports here; only node:path.
//
// data-paths.ts re-exports these names and adds the TypeScript-facing
// `VetriHomeOptions` interface. Keep the two in lockstep: every behavior in
// this file is exercised by data-paths.test.ts through the re-export.

import path from 'node:path'

/** A VETRI_HOME rooted inside a `profiles/` directory names the profile's
 * parent (the home), not the profile directory itself. */
function normalizeVetriHomeRoot(vetriHome, pathModule) {
  if (!vetriHome) {
    return vetriHome
  }
  const resolved = pathModule.resolve(String(vetriHome))
  const parent = pathModule.dirname(resolved)
  if (pathModule.basename(parent).toLowerCase() === 'profiles') {
    return pathModule.dirname(parent)
  }
  return resolved
}

export function platformDefaultVetriHome(home, env = process.env, platform = process.platform) {
  const suffix = env.VETRI_DATA_DIR_SUFFIX || ''
  if (platform === 'win32') {
    const base = (env.LOCALAPPDATA || '').trim() || path.win32.join(home, 'AppData', 'Local')
    return path.win32.join(base, 'vetri') + suffix
  }
  return path.posix.join(home, '.vetri') + suffix
}

export function resolveDesktopUserData(defaultPath, env = process.env) {
  return env.VETRI_DESKTOP_USER_DATA_DIR
    ? path.resolve(env.VETRI_DESKTOP_USER_DATA_DIR)
    : defaultPath + (env.VETRI_DATA_DIR_SUFFIX || '')
}

export function resolveDesktopVetriHome({ home, env = process.env, platform = process.platform, directoryExists = () => false, readWindowsHome = () => null }) {
  const paths = platform === 'win32' ? path.win32 : path.posix
  if (env.VETRI_HOME) {
    return normalizeVetriHomeRoot(env.VETRI_HOME, paths)
  }
  // Fresh-install rehearsals must not touch the real Vetri home.
  if (env.VETRI_DESKTOP_USER_DATA_DIR) {
    return paths.join(paths.resolve(env.VETRI_DESKTOP_USER_DATA_DIR), 'vetri-home')
  }
  if (platform === 'win32' && env.VETRI_HOME === undefined) {
    // Explorer can miss setx changes. An explicit empty value opts out of that fallback.
    const registryHome = readWindowsHome()
    if (registryHome) {
      return normalizeVetriHomeRoot(registryHome, paths)
    }
  }
  const defaultHome = platformDefaultVetriHome(home, env, platform)
  // Keep the legacy migration for ordinary installs, not isolated suffix runs.
  if (platform === 'win32' && !env.VETRI_DATA_DIR_SUFFIX) {
    const legacy = paths.join(home, '.vetri')
    if (!directoryExists(defaultHome) && directoryExists(legacy)) {
      return legacy
    }
  }
  return defaultHome
}

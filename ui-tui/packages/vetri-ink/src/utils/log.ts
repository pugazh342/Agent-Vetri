export function logError(error: unknown): void {
  if (!process.env.VETRI_INK_DEBUG_ERRORS) {
    return
  }

  console.error(error)
}

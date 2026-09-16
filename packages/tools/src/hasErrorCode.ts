/**
 * Narrow an unknown caught value to a Node.js system error with a
 * specific `code`. Shared by the copy helpers, which branch on
 * EPERM / EEXIST / ENOENT and cannot use `instanceof` (libuv errors
 * are plain `Error`s with an extra `code` property).
 */
export const hasErrorCode = (
  error: unknown,
  code: string,
): boolean =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: unknown }).code === code

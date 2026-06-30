import { apiBase } from "../apiBase"

// Thin fetch wrapper around the server's /api/templates surface. All
// methods reject on non-2xx so the calling atom action can let the
// error bubble up to the UI's catch / toast plumbing.

export type TemplateListItem = {
  id: string
  name: string
  description?: string
  updatedAt: string
}

export type StoredTemplate = TemplateListItem & {
  yaml: string
  createdAt: string
}

// Pull the most useful human message out of an error response. The server
// returns `{ error, details }` for both validation (400) and unhandled
// failures (500, via the API's onError net) — surface `details` (e.g. the
// actual filesystem error) when present, falling back to the raw text.
const extractErrorMessage = (text: string): string => {
  try {
    const body = JSON.parse(text) as {
      error?: string
      details?: string
    }
    return body.details ?? body.error ?? text
  } catch {
    return text
  }
}

const parseJson = async <T>(
  response: Response,
): Promise<T> => {
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    const message =
      extractErrorMessage(text) || response.statusText
    throw new Error(
      `Templates API ${response.status}: ${message}`,
    )
  }
  return (await response.json()) as T
}

export const fetchTemplateList = async (): Promise<
  TemplateListItem[]
> => {
  const response = await fetch(`${apiBase}/templates`)
  const body = await parseJson<{
    templates: TemplateListItem[]
  }>(response)
  return body.templates
}

export const fetchTemplate = async (
  id: string,
): Promise<StoredTemplate> => {
  const response = await fetch(
    `${apiBase}/templates/${encodeURIComponent(id)}`,
  )
  return parseJson<StoredTemplate>(response)
}

export const createTemplate = async (input: {
  name: string
  description?: string
  yaml: string
}): Promise<StoredTemplate> => {
  const response = await fetch(`${apiBase}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<StoredTemplate>(response)
}

export const updateTemplate = async (
  id: string,
  changes: {
    name?: string
    description?: string
    yaml: string
  },
): Promise<StoredTemplate> => {
  const response = await fetch(
    `${apiBase}/templates/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    },
  )
  return parseJson<StoredTemplate>(response)
}

export const deleteTemplate = async (
  id: string,
): Promise<void> => {
  const response = await fetch(
    `${apiBase}/templates/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  )
  if (!response.ok) {
    throw new Error(
      `Templates API ${response.status}: ${response.statusText}`,
    )
  }
}

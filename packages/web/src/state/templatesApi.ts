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

const parseJson = async <T>(
  response: Response,
): Promise<T> => {
  if (!response.ok) {
    const text = await response
      .text()
      .catch(() => response.statusText)
    throw new Error(
      `Templates API ${response.status}: ${text || response.statusText}`,
    )
  }
  return (await response.json()) as T
}

export const fetchTemplateList = async (): Promise<
  TemplateListItem[]
> => {
  const response = await fetch(`${apiBase}/api/templates`)
  const body = await parseJson<{
    templates: TemplateListItem[]
  }>(response)
  return body.templates
}

export const fetchTemplate = async (
  id: string,
): Promise<StoredTemplate> => {
  const response = await fetch(
    `${apiBase}/api/templates/${encodeURIComponent(id)}`,
  )
  return parseJson<StoredTemplate>(response)
}

export const createTemplate = async (input: {
  name: string
  description?: string
  yaml: string
}): Promise<StoredTemplate> => {
  const response = await fetch(`${apiBase}/api/templates`, {
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
    `${apiBase}/api/templates/${encodeURIComponent(id)}`,
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
    `${apiBase}/api/templates/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  )
  if (!response.ok) {
    throw new Error(
      `Templates API ${response.status}: ${response.statusText}`,
    )
  }
}

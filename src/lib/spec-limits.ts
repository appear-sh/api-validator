export const SPEC_MAX_BYTES = 4.5 * 1000 * 1000
export const MAX_YAML_ANCHORS = 40
export const MAX_YAML_ALIASES = 80

export const SPEC_TOO_LARGE = 'Specification exceeds the 4.5 MB limit.'
export const YAML_UNSAFE = 'YAML alias/anchor count exceeds the safe limit.'

export function specByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function assertSpecBudget(text: string): { error: string } | undefined {
  if (specByteLength(text) > SPEC_MAX_BYTES) {
    return { error: SPEC_TOO_LARGE }
  }

  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return

  const anchors = text.match(/(?:^|[\s{[,\n])&[A-Za-z0-9_-]+/g)
  const aliases = text.match(/(?:^|[\s{[,\n])\*[A-Za-z0-9_-]+/g)
  if ((anchors?.length ?? 0) > MAX_YAML_ANCHORS || (aliases?.length ?? 0) > MAX_YAML_ALIASES) {
    return { error: YAML_UNSAFE }
  }
}

export const SWAGGER_LOCAL_REFS_ONLY = {
  resolve: {
    external: false,
    http: { canRead: false },
    file: { canRead: false },
  },
} as const

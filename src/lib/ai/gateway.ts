/**
 * Vercel AI Gateway helpers for all future AI features.
 *
 * Auth (in order):
 * 1. AI_GATEWAY_API_KEY — local + Vercel dashboard key
 * 2. Vercel OIDC on deploy (AI SDK picks up automatically when linked)
 *
 * Model: AI_GATEWAY_MODEL (default anthropic/claude-sonnet-4.5)
 */
import { generateText, streamText } from 'ai'

export const DEFAULT_AI_GATEWAY_MODEL =
  process.env.AI_GATEWAY_MODEL?.trim() || 'anthropic/claude-sonnet-4.5'

export function isAiGatewayConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL
  )
}

export type GatewayGenerateParams = {
  prompt: string
  system?: string
  model?: string
  /** Cost / analytics tag, e.g. listing-description */
  tag?: string
  maxOutputTokens?: number
}

export async function gatewayGenerateText(params: GatewayGenerateParams) {
  const model = params.model || DEFAULT_AI_GATEWAY_MODEL
  return generateText({
    model,
    system: params.system,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens ?? 2048,
    providerOptions: params.tag
      ? {
          gateway: {
            tags: [params.tag],
          },
        }
      : undefined,
  })
}

export function gatewayStreamText(params: GatewayGenerateParams) {
  const model = params.model || DEFAULT_AI_GATEWAY_MODEL
  return streamText({
    model,
    system: params.system,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens ?? 2048,
    providerOptions: params.tag
      ? {
          gateway: {
            tags: [params.tag],
          },
        }
      : undefined,
  })
}

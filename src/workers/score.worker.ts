// Off-main-thread scoring worker
import { calculateAgentReadinessScore } from '@/lib/agent-readiness-score'
import type { ValidationResult, AgentReadinessScore } from '@/lib/types';

interface ScoreRequestMessage {
  type: 'score-request'
  results: ValidationResult[]
  specContent: string
}

interface ScoreResponseMessage {
  type: 'score-response'
  score: AgentReadinessScore
}

interface ScoreErrorMessage {
  type: 'score-error'
  error: string
}

self.onmessage = (event: MessageEvent<ScoreRequestMessage>) => {
  const data = event.data
  if (!data || data.type !== 'score-request') return

  try {
    const score = calculateAgentReadinessScore(data.results, data.specContent)
    const resp: ScoreResponseMessage = { type: 'score-response', score }
    ;(self as unknown as Worker).postMessage(resp)
  } catch (e) {
    const err: ScoreErrorMessage = { type: 'score-error', error: e instanceof Error ? e.message : 'Unknown error' }
    ;(self as unknown as Worker).postMessage(err)
  }
}



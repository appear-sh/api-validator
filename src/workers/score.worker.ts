// Off-main-thread scoring worker
// Minimal typing to avoid extra TS/WebWorker config
import { calculateApiScore } from '@/lib/calculate-api-score'

type ValidationResult = {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: { start: { line: number, character: number }, end: { line: number, character: number } };
}

interface ScoreRequestMessage {
  type: 'score-request'
  results: ValidationResult[]
  specContent: string
}

interface ScoreResponseMessage {
  type: 'score-response'
  overallScore: number
}

interface ScoreErrorMessage {
  type: 'score-error'
  error: string
}

self.onmessage = (event: MessageEvent<ScoreRequestMessage>) => {
  const data = event.data
  if (!data || data.type !== 'score-request') return

  try {
    const { overallScore } = calculateApiScore(data.results, data.specContent)
    const resp: ScoreResponseMessage = { type: 'score-response', overallScore }
    ;(self as unknown as Worker).postMessage(resp)
  } catch (e) {
    const err: ScoreErrorMessage = { type: 'score-error', error: e instanceof Error ? e.message : 'Unknown error' }
    ;(self as unknown as Worker).postMessage(err)
  }
}



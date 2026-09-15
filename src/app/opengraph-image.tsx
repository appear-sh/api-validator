import { ImageResponse } from 'next/og'

export const alt = 'OpenAPI validator plus a documentation checklist. Not a runtime test of agents.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, #0a0a12 0%, #010101 100%)',
          padding: 72,
          color: '#f4f4f5',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#40E0D0',
          }}
        >
          OpenAPI · AI agents
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            Agent-Ready Score
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#a1a1aa',
              marginTop: 20,
            }}
          >
            <div style={{ display: 'flex', marginRight: 12 }}>OpenAPI</div>
            <div style={{ display: 'flex', marginRight: 12 }}>lint</div>
            <div style={{ display: 'flex', marginRight: 12 }}>+</div>
            <div style={{ display: 'flex', marginRight: 12 }}>spec</div>
            <div style={{ display: 'flex', marginRight: 12 }}>checklist.</div>
            <div style={{ display: 'flex', marginRight: 12 }}>Not</div>
            <div style={{ display: 'flex', marginRight: 12 }}>a</div>
            <div style={{ display: 'flex', marginRight: 12 }}>runtime</div>
            <div style={{ display: 'flex' }}>test.</div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#71717a' }}>
          validator.appear.sh
        </div>
      </div>
    ),
    { ...size },
  )
}

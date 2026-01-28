# Unicorn Studio Animations

This directory contains Unicorn Studio animation JSON files for the score background.

## Animation Files

Place your exported Unicorn Studio JSON animation files here:

- `good-score.json` - Animation for scores 70+ (Grade C, B, A)
  - **Status:** ⏳ To be created
  - **Recommended colors:** Positive colors (greens, blues, lighter tones)
  
- `medium-score.json` - Animation for scores 40-69 (Grade D)
  - **Status:** ⏳ To be created
  - **Recommended colors:** Neutral colors (yellows, oranges, amber tones)
  
- `bad-score.json` - Animation for scores < 40 (Grade F)
  - **Status:** ✅ Saved (red color scheme)
  - **Colors:** Red gradient with dark tones

## Implementation

The implementation follows the same pattern as the appear.sh homepage:

### SDK Version
- Using **v1.4.29** (matching appear.sh)
- CDN: `https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js`

### Architecture
1. **Singleton SDK Loader** (`src/lib/unicorn-studio.ts`)
   - Ensures script only loads once
   - Caches the load promise
   
2. **React Component** (`src/components/unicorn-background.tsx`)
   - Uses `UnicornStudio.addScene()` API with config object
   - Lazy loads with IntersectionObserver
   - Respects `prefers-reduced-motion` accessibility setting
   - Handles cleanup on unmount
   - Handles window resize

### Component Configuration
```tsx
<UnicornBackground 
  score={score.overallScore} 
  grade={score.grade}
  fps={30}          // Lower for performance
  scale={1}
  dpi={1.5}
  disableMobile={true}  // Disables mouse interactivity on mobile
/>
```

## How to Export from Unicorn Studio

1. Open your project in Unicorn Studio
2. Click "Export" or the download icon
3. Choose "JSON" format
4. Save the file with the appropriate name:
   - `good-score.json` for good score animation
   - `medium-score.json` for medium score animation
   - `bad-score.json` for bad score animation
5. Place in this directory (`/public/animations/`)

## Score Thresholds

| Score Range | Grade | Animation File |
|-------------|-------|----------------|
| 70-100 | C, B, A | good-score.json |
| 40-69 | D | medium-score.json |
| 0-39 | F | bad-score.json |

## Troubleshooting

If animations don't appear:

1. **Check browser console** for errors
2. **Verify file exists** - Try accessing `/animations/bad-score.json` directly in browser
3. **Check file format** - Should be valid Unicorn Studio JSON export
4. **Reduced motion** - Animation won't play if user has `prefers-reduced-motion: reduce` enabled
5. **Container size** - Parent must have defined dimensions

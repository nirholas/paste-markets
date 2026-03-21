# Fix: THREE.Clock Deprecation Warning

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

The browser console repeatedly logs:
```
THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
```

This comes from the 3D globe component on the home page. The warning fires every time the globe re-initializes (e.g. on navigation via back/forward cache restore).

---

## Steps

### 1. Find the globe component

Search for files that import from `three` or `three-globe` or `react-globe.gl` or similar. The globe is rendered on the home page (`src/app/page.tsx`) and likely has a dedicated component.

```bash
grep -r "three" src/components/ --include="*.tsx" --include="*.ts" -l
grep -r "three" src/app/ --include="*.tsx" --include="*.ts" -l
grep -r "Globe" src/ --include="*.tsx" --include="*.ts" -l
grep -r "Clock" src/ --include="*.tsx" --include="*.ts" -l
```

### 2. Identify the Clock usage

The `THREE.Clock` deprecation comes from either:
- **Direct usage**: Code that does `new THREE.Clock()` — replace with `new THREE.Timer()`
- **Library internal**: A dependency like `three-globe` or `react-globe.gl` using Clock internally

### 3a. If direct usage

Replace `THREE.Clock` with `THREE.Timer`:

```ts
// BEFORE
const clock = new THREE.Clock();
const delta = clock.getDelta();
const elapsed = clock.getElapsedTime();

// AFTER
const timer = new THREE.Timer();
timer.update(); // call once per frame
const delta = timer.getDelta();
const elapsed = timer.getElapsed();
```

Note: `THREE.Timer` requires an explicit `timer.update()` call each frame (typically in the animation loop), and the method is `.getElapsed()` not `.getElapsedTime()`.

### 3b. If from a library dependency

Check if upgrading the globe library fixes it:

```bash
npm ls three
npm ls three-globe
npm ls react-globe.gl
```

If the library has a newer version that uses Timer instead of Clock, upgrade it. If not, the warning is cosmetic and can be suppressed by patching the console in the globe component:

```ts
// Suppress THREE.Clock deprecation warning (from three-globe internals)
useEffect(() => {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
    originalWarn.apply(console, args);
  };
  return () => {
    console.warn = originalWarn;
  };
}, []);
```

Only use this suppression as a last resort if the library can't be upgraded.

---

## Testing

1. `npm run build` — no type errors
2. Load the home page — the THREE.Clock warning should no longer appear in the console
3. The globe should still render and animate correctly

---

## Do NOT

- Remove the globe feature
- Change the globe's visual appearance
- Downgrade three.js

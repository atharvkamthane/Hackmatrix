---
name: Expo devtools library quirk
description: Non-blocking React Native DevTools binary failure in the current Nix environment.
---

The Expo workflow may report that React Native DevTools cannot load `libglib-2.0.so.0`. Metro can still start, bundle the app, and render the Expo web preview.

**Why:** The optional native debugger helper depends on a system library that is absent from this workspace image; this does not indicate a failure in the app bundle.

**How to apply:** Treat it as non-blocking when Metro and the preview are healthy. Investigate the system library only if the native DevTools debugger is needed.
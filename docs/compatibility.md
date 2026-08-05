# Compatibility

| Surface | V1 support |
|---|---|
| Node.js | Active LTS lines, minimum 20.19 |
| Angular | 20–22 development builds (the currently maintained majors) |
| PixiJS | 8.x, preferably registered through `@pixi/devtools` |
| Signal Forms | Angular 21–22 |
| Chromium | Primary, through Playwright/CDP |
| Firefox/WebKit | Experimental through Playwright |
| NgRx | Angular adapter modules, versions 17–21 |
| SSR/hydration/multi-root | Partial discovery |

The example matrix validates Angular 20 (`di-app`), Angular 21 (`ngrx-app`), Angular 22 (the remaining Angular fixtures), and PixiJS 8 (`pixi-app`) through ADP domain contracts. Browser smoke tests can exercise Chromium, Firefox, and WebKit against Angular and Chromium against PixiJS. Older Angular 18–19 applications and PixiJS 7 are outside the maintained support contract.

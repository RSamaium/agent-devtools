# Compatibility

| Surface | V1 support |
|---|---|
| Node.js | Active LTS lines, minimum 20.19 |
| Angular | 20–22 development builds (the currently maintained majors) |
| Signal Forms | Angular 21–22 |
| Chromium | Primary, through Playwright/CDP |
| Firefox/WebKit | V1 experimental; V2 smoke-tested through Playwright |
| NgRx | Optional adapters, versions 17–21 |
| SSR/hydration/multi-root | Partial discovery; strengthened in V2 |

The example matrix validates Angular 20 (`di-app`), Angular 21 (`ngrx-app`), and Angular 22 (the remaining fixtures) without changing public protocol types. Browser smoke tests exercise Chromium, Firefox, and WebKit against the same runtime bridge. Older Angular 18–19 applications may work through discovery mode but are outside the maintained support contract.

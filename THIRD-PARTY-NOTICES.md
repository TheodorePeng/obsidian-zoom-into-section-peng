# Third-party notices

## @lezer/markdown

MIT License

Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Modules provided by the Obsidian host

The following modules are declared `external` in `esbuild.config.mjs` and are
therefore **not bundled into `main.js`**. They resolve from the Obsidian
application at runtime and are not redistributed with this plugin.

- `obsidian` — Obsidian API, provided by the host application
- `electron` — provided by the host application
- `@codemirror/autocomplete`, `@codemirror/collab`, `@codemirror/commands`,
  `@codemirror/language`, `@codemirror/lint`, `@codemirror/search`,
  `@codemirror/state`, `@codemirror/view` — MIT License,
  Copyright (C) by Marijn Haverbeke and others
- `@lezer/common`, `@lezer/highlight`, `@lezer/lr` — MIT License,
  Copyright (C) by Marijn Haverbeke and others

Only `@lezer/markdown` is compiled into the distributed `main.js`; its notice is
reproduced in full above.

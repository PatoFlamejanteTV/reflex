## 2025-01-08 - Critical Missing Components
**Vulnerability:** The repository is missing the `server/lib/` directory, which contains core logic (`groq.js`, `utils.js`, `request-handler.js`).
**Learning:** This renders the server unrunnable and prevents dynamic security analysis (AST/static analysis is still possible). It implies a broken deployment pipeline or incomplete repo synchronization.
**Prevention:** Ensure CI/CD pipelines verify the presence of all required modules and that `.gitignore` doesn't inadvertently exclude source code unless it's a build artifact (which `lib/` does not appear to be, based on requires).

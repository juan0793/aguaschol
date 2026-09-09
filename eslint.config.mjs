import js from "@eslint/js";

// Lint del alcance de Control de Entregas, sin imponer reglas a módulos ajenos.
export default [{ ignores: ["**/node_modules/**", "**/dist/**", "bot-informes-whatsapp/**"] }, {
  files: ["frontend/src/modules/entregas/**/*.{js,jsx,mjs}", "frontend/src/components/NotificationCenter.jsx", "backend/src/services/entregas*.{js,mjs}", "backend/src/services/{auditService,profileService}.js", "backend/src/config/env.js", "backend/src/server.js"],
  languageOptions: {
    ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } },
    globals: Object.fromEntries(["window", "document", "navigator", "sessionStorage", "localStorage", "fetch", "console", "process", "Buffer", "URL", "URLSearchParams", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "Blob", "FormData", "TextEncoder", "atob"].map((name) => [name, "readonly"]))
  },
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
  rules: { ...js.configs.recommended.rules, "no-unused-vars": "off" }
}];

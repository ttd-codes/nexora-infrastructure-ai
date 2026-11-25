# NEXORA — Infrastructure Memory & Intelligence Platform

**"Remember Every Failure. Understand Every Pattern. Maintain Before It Matters."**

NEXORA is an AI-powered infrastructure memory and intelligence platform that converts scattered maintenance records—handwritten logbooks, PDF reports, equipment photos, technician voice notes, and manual notes—into connected, searchable, evidence-backed institutional knowledge.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion (Framer Motion), Recharts, React Flow (`@xyflow/react`), Lucide React, jsPDF.
- **Backend**: Node.js + Express (`server.ts`, `server/routes/api.ts`, `server/services/geminiService.ts`, `server/services/recurrenceEngine.ts`), Firebase Admin ID token verification.
- **Database & Auth**: Firebase Firestore (with hardened `firestore.rules` and `firebase-blueprint.json` schema) + Google Authentication.
- **AI Intelligence**: Server-side `@google/genai` SDK (`gemini-4-hydrogen` for multimodal PDF/image/text structured extraction & bounded investigation synthesis, `gemini-3.5-transcribe` for technician audio notes) paired with a deterministic, configurable rule engine (`R-01` through `R-05`).

## Seven Core Modules

1. **Command Center**: Live KPIs, date/category/location filters, maintenance trends, location breakdown, and critical pattern insights.
2. **Asset Intelligence**: Full asset CRUD, component tracking, search/filtering, and dedicated Asset Detail profiles with interactive timelines.
3. **Infrastructure Memory Graph**: Interactive React Flow graph connecting Locations → Assets → Components → Maintenance Events → Repair Actions → Source Documents → AI Recommendations.
4. **AI Investigation Center**: Explainable pattern workbench strictly separating Observed Facts, AI Interpretations, Missing Information, and Suggested Inspection Actions, with expandable source evidence and configurable rule thresholds.
5. **Smart Data Intake**: Drag-and-drop multimodal ingestion (PDF, image, audio, text, manual notes) with uncertain-field highlighting and mandatory user validation.
6. **Maintenance Management**: Incident/repair lifecycle management, status tracking, and timeline views.
7. **Reports & Analytics**: Maintenance frequency analysis, component intervention history, formula-safe CSV export, and PDF intelligence report downloads.

## Local Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Set GEMINI_API_KEY in .env (server-side only)

# 3. Start development server (Express + Vite on port 3000)
npm run dev

# 4. Type check & build for production
npm run lint
npm run build
npm start
```

## REST API Endpoints

- `GET /api/health` — Backend service health check.
- `GET /api/docs` — OpenAPI 3.0 specification.
- `POST /api/ai/extract` — Authenticated multimodal maintenance extraction via Gemini.
- `POST /api/recurrence/analyze` — Authenticated deterministic recurrence rule engine + optional Gemini narrative synthesis.
- `POST /api/export/csv` — Authenticated formula-safe RFC-4180 CSV report generator.

## Security & Rules Verification

- Lint Firestore security rules: `npx eslint firestore.rules`
- Security invariants & adversarial test cases: `security_spec.md` & `firestore.rules.test.ts`

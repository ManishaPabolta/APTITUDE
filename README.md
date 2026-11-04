# Elevate · Online Aptitude Examination Platform

A full-stack aptitude examination platform with a React/Vite/Tailwind client, FastAPI service, MongoDB persistence, role-based access, CSV workflows, analytics and secure exam sessions.

## Project structure

```text
backend/
  app/
    ai/                 Groq question generation client
    controllers/        AI draft orchestration
    middleware/         role-based authorization
    models/             typed MongoDB document models
    routes/             admin, student, reporting, auth, catalog, communication, media, question-bank and AI routers
    schemas/            request and support/announcement validation schemas
    services/           exam finalization, grading, question bank, AI drafts, catalog and serializers
    config.py            environment-backed settings
    database.py          MongoDB lifecycle and indexes
    main.py              application lifecycle and examination APIs
  sample_data/           CSV import templates
  tests/                 grading and validation tests
frontend/src/
  api/                   auth, admin, student and AI API services
  auth/                  authentication context and protected routes
  components/
    layout/              role-specific application shells
    ui/                  shared controls and state components
  hooks/                  reusable React hooks
  pages/
    admin/                administration, analytics, question bank, AI and integrity pages
    student/              student dashboard and isolated exam-room workflow
  utils/                  date and display helpers
  validation/             client-side form validation
```

## Requirements

- Python 3.11+
- Node.js 20+
- MongoDB 6+ (local or hosted)

## Start the API

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` before starting: set a private `JWT_SECRET` (at least 32 characters), a strong unique `ADMIN_PASSWORD`, and `MONGODB_URL` if MongoDB is not local. Then run:

```powershell
uvicorn app.main:app --reload
```

The API listens on `http://localhost:8000`; OpenAPI documentation is available at `http://localhost:8000/docs`. The account matching `ADMIN_EMAIL` is the platform's single superadmin; it is bootstrapped on first startup and promoted to superadmin if the account already exists. The superadmin can create admin accounts or grant admin role to an existing teacher from **People & admin access**. Only the superadmin can revoke or change admin access. Regular admins can manage students, teachers, exams and other operational features, but cannot create or modify admin accounts. The superadmin role is protected from user management.

If the configured superadmin already existed in MongoDB before you changed `ADMIN_PASSWORD`, reset its stored password from the `backend` directory with `.\\.venv\\Scripts\\python.exe -m app.reset_superadmin_password` in PowerShell (or `python -m app.reset_superadmin_password` after activating the virtual environment). This command reads the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`, updates only that account, and does not print the password. Restart the API afterward.

For AI question generation, set `GROQ_API_KEY` in **backend/.env**. The API key is read only by the Python backend and is never sent to or bundled into the browser. `GROQ_MODEL` can be set to a Groq chat model available to your account. Staff can launch **Generate with AI** from the question bank or generate questions while editing an exam. Specify a topic, subtopic, custom prompt/instructions, exam pattern, question type, difficulty, and up to 149 questions. Generation uses batches of at most five; if Groq truncates or returns fewer questions, the backend automatically splits and retries the incomplete batch. It rejects duplicate or malformed output and requires four distinct options, exactly one correct answer, and an explanation for every question. Reviewers can preview and edit question text, options, correct answers, difficulty, marks, and explanations before approval. Approved questions are saved in the bank and, when generated in the exam editor, added to that exam as well.

To insert optional sample students and a published practice exam:

```powershell
python -m app.seed
```

Sample student: `aarav@example.com` / `Student123!` (development only). The sample exam is assigned to `Cohort 2026`. Change these sample credentials before using any shared or production environment.

## Notifications and audit trail

In-app notifications are stored per user and refreshed in the application every 30 seconds. Exam publication notifies assigned students; exam starts, submissions, and integrity events notify administrators. Email delivery is optional and uses the SMTP settings in `backend/.env` (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_USE_TLS`, and `MAIL_USE_SSL`). Without SMTP configuration, in-app notifications continue to work and emails remain marked as not configured. Configure credentials only in the backend environment, never in the frontend.

The administrator integrity page includes an audit trail for user management, examinations, CSV imports, and question-bank changes. Audit records are append-only from the application interface and are retained in MongoDB.

The **Announcements & support** workspace lets administrators publish audience-scoped notices. Students and staff can submit support requests; administrators and exam managers can track and respond to tickets. Notices and tickets persist in MongoDB and new announcements/ticket updates create in-app notifications.

CSV templates are in `backend/sample_data/`. Student CSV headers: `name,email,password,batch,course` (`password` is optional; when omitted, the import response returns a one-time generated temporary password). Question CSV/XLSX headers: `text,type,category,section,difficulty,option_1,...,option_6,correct_answer,marks,explanation,image_url,math_expression,tags,topic`. Choice questions require four or more options; for multiple-answer questions, separate correct option values with `|`. Each examination is limited to 149 questions, and duplicate question text is rejected when saving an examination or importing its question pool.

Question diagrams can be uploaded as PNG, JPEG, GIF, or WebP up to 5 MB. Uploaded files are stored in MongoDB GridFS; image IDs are unguessable and served with a restrictive content type. For production, include GridFS data in MongoDB backup/restore procedures. Alternatively, use an HTTPS image URL. Optional section timing is configured with one `Section name: minutes` line per section; each exam question must be assigned to a matching section and the section budgets must fit inside the overall exam duration.

## Start the frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Set `VITE_API_URL` in `frontend/.env` when the API is hosted elsewhere. Add that origin to `CORS_ORIGINS` in `backend/.env`.

Create a student account from the sign-in screen. Admins can add teachers/students, import student CSVs, create and schedule exams, manage the shared question bank, and review or export results. Approved Groq questions and manually authored questions are saved in the bank and can be edited or removed by staff. Assign exams to a batch or selected student IDs; leaving both fields empty makes a published exam available to all students.

## Examination integrity and timing

The server stores randomized question/option snapshots, persists answers, enforces the overall and configured section deadlines, evaluates submissions once, and records suspicious activity. The client requests fullscreen and blocks common clipboard/context-menu actions. Configured immediate events or the configured violation threshold trigger automatic submission. Browser controls cannot prevent operating-system-level capture or a second device, so use institutional proctoring policy for high-stakes exams.

## Deployment notes

- Use HTTPS, a managed MongoDB deployment with authentication/network controls, a unique secret manager-backed JWT key, and strong administrator credentials.
- Configure exact trusted origins in `CORS_ORIGINS`; do not use wildcard origins with credentials.
- Put the API behind a TLS-terminating reverse proxy and apply platform-level rate limiting and monitoring.
- Back up MongoDB and test restoration. Keep sample credentials and practice data out of production.
- The result export endpoint supports `csv` and `xlsx`. Analytics use Pandas/NumPy over stored submissions.

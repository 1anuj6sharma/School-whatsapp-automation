# School WhatsApp Automation (Meta WhatsApp Cloud API Broadcast Engine)

A production-grade, full-stack school messaging engine designed to broadcast official WhatsApp updates to student parents concurrently. 

Built with **FastAPI**, **SQLAlchemy 2.0 (Async)**, **Pydantic v2**, **Meta WhatsApp Cloud API (Graph API v26.0)**, and **React + Vite + TypeScript + Tailwind CSS**.

---

## Key Architecture & Business Features

1. **Direct Meta WhatsApp Cloud API Integration**: Connects to Meta's official Graph API (`https://graph.facebook.com/v26.0/{PHONE_NUMBER_ID}/messages`). Zero fake/mock layers in production.
2. **Strict Individual 1-to-1 Messaging**: Never creates noisy WhatsApp groups. Every parent receives an isolated, official 1-to-1 message directly from the school's verified WhatsApp business number.
3. **Opt-in Compliance Enforcement**: Messages are only dispatched to numbers where `whatsapp_opt_in == True`. Opted-out students are cleanly recorded as `SKIPPED` in audit logs without interrupting the batch.
4. **Controlled Concurrency Engine**: Dispatches messages concurrently using `asyncio.Semaphore(WHATSAPP_MAX_CONCURRENCY)` (default: 5) with exponential backoff on HTTP 429 rate-limits.
5. **Template Lifecycle Guardrails**: Distinguishes between pre-approved templates (`hello_world` = `ACTIVE`) and unapproved custom templates (`student_attendance` = `PENDING`), protecting the school from Meta API rejection penalties.
6. **Real-Time Webhook Processing**: Ingests Meta delivery receipts (`sent` &rarr; `delivered` &rarr; `read` &rarr; `failed`) and correlates them directly to specific student message logs via `whatsapp_message_id`.
7. **Security & Privacy by Design**: Zero access tokens exposed to the frontend; tokens are never logged. Phone numbers are securely masked in logs and client tables (e.g. `+91******1234`).

---

## Project Structure

```text
.
├── backend/
│   ├── alembic/              # Alembic database migration scripts
│   ├── app/
│   │   ├── main.py           # FastAPI application & lifecycle startup
│   │   ├── config.py         # Pydantic Settings & environment variables
│   │   ├── database.py       # Async SQLAlchemy engine & session factory
│   │   ├── models/           # Class, Student, Template, Campaign, MessageLog models
│   │   ├── schemas/          # Pydantic validation schemas
│   │   ├── routers/          # REST & Webhook endpoints
│   │   ├── services/         # WhatsApp Cloud API client & Campaign batch engine
│   │   ├── utils/            # Phone sanitizer, phone masker & secure logger
│   │   └── seed.py           # Database seeder (Class 10-A, 2 test students, templates)
│   ├── tests/                # Automated pytest suite with mocked Meta API
│   ├── requirements.txt      # Python dependencies
│   ├── seed.py               # Convenience root seed runner
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # Glassmorphism UI components (Sidebar, Header, Modals, Badges)
│   │   ├── pages/            # Dashboard, SendMessage, Students, Classes, Templates, Campaigns, Logs, Settings
│   │   ├── services/api.ts   # REST API client
│   │   ├── types/            # TypeScript data definitions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── .env.example
├── .gitignore
└── README.md
```

---

## 1. Prerequisites

- **Python 3.10+**
- **Node.js 18+ & npm**
- **Meta Developer Account** with a WhatsApp Cloud API App configured.
- (Optional) **PostgreSQL 14+** (SQLite is supported out-of-the-box for zero-config local testing).

---

## 2. Environment Configuration & Recipient Number Format

Edit [.env](file:///c:/inverosoft/School%20whatsapp/.env) with your credentials:

```ini
# Meta WhatsApp Cloud API Credentials
# Get "Phone number ID" from: Meta Developers -> WhatsApp -> API Setup (Step 1)
WHATSAPP_PHONE_NUMBER_ID=your_actual_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_meta_access_token_here
WHATSAPP_API_VERSION=v26.0

# Zero-config SQLite (no external DB server required!)
DATABASE_URL=sqlite+aiosqlite:///./school_whatsapp.db

# Recipient WhatsApp Numbers:
# FORMAT: [Country Code] + [Phone Number] with NO '+', NO spaces, NO dashes.
# Example for India (+91) with 9876543210 -> 919876543210
# Example for US (+1) with 555-123-4567   -> 15551234567
TEST_RECIPIENT_1=919876543210
TEST_RECIPIENT_2=919876543211

# Or comma-separated list of multiple recipients:
# RECIPIENT_NUMBERS=919876543210,919876543211
```

---

## 3. Running with Docker (Recommended - 1 Command)

You can launch both the FastAPI backend and React frontend together with Docker:

```bash
# Build and run with Docker Compose
docker compose up --build
```

- **Frontend Dashboard**: `http://localhost:5173` (or `http://localhost:3000`)
- **Backend Swagger API**: `http://localhost:8000/docs`

---

## 4. Running Locally without Docker (Alternative)

### 4.1 Backend
```bash
cd backend
python -m venv venv
# Activate virtualenv (Windows: .\venv\Scripts\Activate.ps1 | Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4.2 Frontend
```bash
cd frontend
npm install
npm run dev
```

Open your browser to:
`http://localhost:5173`

---

## 5. First End-to-End Test (Class 10-A Broadcast)

1. Open `http://localhost:5173`.
2. Navigate to **"Settings & Test"** on the sidebar:
   - Enter `TEST_RECIPIENT_1` and click **"Send Real WhatsApp Message"**.
   - Verify that your test phone receives Meta's official "Hello World" message.
3. Navigate to **"Send Message"**:
   - **Step 1:** Select **Class 10-A** (shows 2 enrolled test students).
   - **Step 2:** Select template **hello_world** (shows status `ACTIVE`).
   - **Step 3:** Notice both students (Rahul Sharma & Priya Sharma) are checked.
   - Click **"Send to 2 Recipients"**.
4. In the confirmation dialog, review the summary and click **"Confirm & Send Now"**.
5. The system concurrently dispatches 2 individual Meta WhatsApp requests and redirects you to the live **Campaign Progress** page.
6. Check your WhatsApp devices &mdash; both numbers will receive individual messages!

---

## 6. Running Automated Backend Tests

The backend includes comprehensive automated unit and integration tests covering API endpoints, opt-in rules, concurrency control, and mocked Meta API failures:

```bash
cd backend
pytest -v
```

---

## 7. Webhook Configuration (Cloudflare Tunnel)

To receive real-time status updates from Meta (`DELIVERED`, `READ` double blue ticks), expose your local FastAPI backend to HTTPS using Cloudflare Tunnel:

### 7.1 Start Cloudflare Tunnel

```bash
# In a new terminal:
cloudflared tunnel --url http://localhost:8000
```

Cloudflare will give you a public URL (e.g. `https://random-subdomain.trycloudflare.com`).

### 7.2 Configure Meta Developer Portal

1. Go to [Meta Developers](https://developers.facebook.com/) &rarr; Your App &rarr; **WhatsApp** &rarr; **Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL**: `https://random-subdomain.trycloudflare.com/webhooks/whatsapp`
   - **Verify Token**: Enter the exact string from your `.env` (`WHATSAPP_VERIFY_TOKEN`).
3. Click **Verify and Save**.
4. Under **Webhook Fields**, click **Manage** and subscribe to **`messages`**.

Whenever a parent receives or reads a message, Meta will post the status event to your webhook, instantly updating the record from `SENT` &rarr; `DELIVERED` &rarr; `READ`.

---

## 8. REST API Reference

### Health
- `GET /health` &mdash; System & database connectivity check.

### Classes
- `GET /api/classes` &mdash; List all classes with student counts.
- `POST /api/classes` &mdash; Create a class `{"name": "Class 10-B", "section": "B"}`.
- `GET /api/classes/{id}` &mdash; Retrieve class details.
- `PUT /api/classes/{id}` &mdash; Update class name or section.
- `DELETE /api/classes/{id}` &mdash; Delete class.

### Students
- `GET /api/students?class_id=1&opt_in=true&search=Rahul` &mdash; Filterable student roster.
- `POST /api/students` &mdash; Add student `{"class_id": 1, "student_name": "...", "whatsapp_number": "919876543210", "whatsapp_opt_in": true}`.
- `PUT /api/students/{id}` &mdash; Update student details / toggle opt-in.
- `DELETE /api/students/{id}` &mdash; Delete student.

### Templates
- `GET /api/templates` &mdash; List registered Meta templates.
- `POST /api/templates` &mdash; Register new template with category and status.

### Campaigns & Broadcast
- `POST /api/campaigns` &mdash; Launch broadcast:
  ```json
  {
    "class_id": 1,
    "template_id": 1,
    "student_ids": [1, 2]
  }
  ```
- `GET /api/campaigns` &mdash; List recent broadcast campaigns with progress counters.
- `GET /api/campaigns/{id}` &mdash; View campaign logs for all recipients.

### Direct Test Message
- `POST /api/messages/test` &mdash; Send single test template message:
  ```json
  {
    "recipient_number": "919876543210",
    "template_name": "hello_world"
  }
  ```

---

## 9. Troubleshooting Common Meta API Errors

| HTTP Status / Error | Cause | Solution |
| :--- | :--- | :--- |
| **401 Unauthorized (`OAuthException: 190`)** | Temporary access token expired (24h validity). | Generate a new access token in Meta API Setup or configure a permanent System User Token. Update `WHATSAPP_ACCESS_TOKEN` in `.env`. |
| **400 Bad Request (`131030: Recipient phone number not in allowed list`)** | In Meta Development mode, recipients must be manually whitelisted. | Go to Meta Developers &rarr; WhatsApp &rarr; API Setup &rarr; Manage Phone Numbers, add and verify the recipient's phone number. |
| **400 Bad Request (`Template does not exist`)** | Template name or language code mismatch. | Ensure template name matches Meta WhatsApp Manager exactly (e.g. `hello_world` in `en_US`). |
| **429 Too Many Requests** | Meta rate-limit threshold exceeded. | The backend automatically retries with exponential backoff. You can lower `WHATSAPP_MAX_CONCURRENCY=3` in `.env`. |

---

## 10. Scaling from 2 to 50+ or 5,000 Students

The architecture is built for horizontal scale:
1. **Concurrency Control**: Adjust `WHATSAPP_MAX_CONCURRENCY=10` or `20` in `.env` based on your Meta WhatsApp Business Tier (Tier 1 allows 1,000 business-initiated conversations/24h; Tier 2 allows 10,000/24h).
2. **PostgreSQL**: Switch `DATABASE_URL` in `.env` to PostgreSQL for high-volume concurrent ACID writes.
3. **Template Registration**: Create and submit templates in Meta WhatsApp Manager (`student_attendance`, `fee_reminder`, `exam_announcement`). Once Meta approves them, update their status to `ACTIVE` in `/api/templates` to broadcast to thousands of students instantly.

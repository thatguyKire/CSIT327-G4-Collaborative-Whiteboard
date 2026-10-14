# COLLABoard: Collaborative Whiteboard

COLLABoard is a real-time web whiteboard for classes. A **teacher** creates a session and shares a join code or QR code. **Students** join from any browser and watch the board live, and draw when the teacher allows it. The teacher can upload images and files, send announcements, toggle a session chat, save snapshots (PNG/PDF), and review attendance and participation.

**Live:** https://collaboard-z4sx.onrender.com

## Features

* Accounts with roles (student / teacher / admin); log in with username **or** email
* Session management: create, search, duplicate, delete, invite by QR code
* Live whiteboard: pen, eraser, colors, sizes, undo/redo, highlight, pins, clear all
* Per-student drawing permission with online presence and automatic revoke
* Late joiners receive the current board
* Image/file uploads (images go on the board; PDF/DOCX/PPTX as links)
* Announcements, notification bell, session chat with teacher toggle
* Snapshots saved on the server, saved sessions, PNG/PDF export
* Attendance page with CSV export; teacher/student/admin dashboards with charts

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript, Chart.js |
| Backend | Python 3.11+, Django 5.2, Django Channels, Daphne (ASGI), WhiteNoise |
| Database | SQLite (PostgreSQL optional via `DATABASE_URL`) |
| Realtime | WebSockets via Django Channels (broadcast and presence), no external service |
| File storage | Local `media/` folder served by the app |
| Hosting | Render |

## Documentation

Full project documentation lives in [`docs/`](docs/README.md):

| | |
|---|---|
| [PRD](docs/PRD.md): Product Requirements | [SRS](docs/SRS.md): Software Requirements Specification |
| [SDD](docs/SDD.md): Software Design Document | [TRD](docs/TRD.md): Technical Requirements |
| [App Flow](docs/APP_FLOW.md) | [UI/UX Design Brief](docs/UI_UX_DESIGN_BRIEF.md) |
| [Backend Schema](docs/BACKEND_SCHEMA.md): ERD, API, realtime protocol | [Implementation Plan](docs/IMPLEMENTATION_PLAN.md): fix log, roadmap, test plan |

## Getting started

### 1. Clone

```bash
git clone https://github.com/thatguyKire/CSIT327-G4-Collaborative-Whiteboard.git
cd CSIT327-G4-Collaborative-Whiteboard
```

### 2. Create a virtual environment and install dependencies

```bash
# macOS / Linux
python3 -m venv env
source env/bin/activate

# Windows (PowerShell)
python -m venv env
.\env\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 3. Configure (optional for local development)

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Nothing is required for local development: the app uses SQLite (`db.sqlite3`) and stores uploads and snapshots in `media/`. Live sync works out of the box. See [TRD §3](docs/TRD.md#3-configuration-environment-variables) for all settings.

### 4. Set up the database

```bash
python manage.py migrate
python manage.py createsuperuser   # optional: admin account (role = admin)
```

### 5. Run

```bash
python manage.py runserver
```

`runserver` uses Daphne, so WebSockets (live drawing) work in development too. Open http://127.0.0.1:8000, sign up as a teacher in one browser and as a student in another (or a private window).

## Running tests

```bash
python manage.py test modules
```

The suite (67 tests) covers authentication, sessions, access control, the whiteboard APIs and WebSocket consumer, uploads, snapshots/PDF, chat, notifications and dashboards.

## Project structure

```
collaborative_whiteboard_backend/   Django settings, root URLs, WSGI/ASGI
modules/
  authentication/   custom user, signup/login, email-or-username backend, roles
  core/             base layout, landing, media serving, realtime.js client, shared decorators, test helpers
  dashboard/        student / teacher / admin dashboards
  session/          sessions, participants, whiteboard pages + APIs, WebSocket consumer, uploads, attendance
  chat/             session chat rooms and messages
  notifications/    notifications, announcements, bell
  profiles/         profile and email edit
  settings_app/     settings hub, password change
  help_app/         FAQ page
docs/               PRD, SRS, SDD, TRD, app flow, UI/UX brief, schema, plan
build.sh            Render build script
```

## Deployment (Render)

* **Build command:** `./build.sh` (installs packages, runs migrations, collects static files)
* **Start command:** `daphne -b 0.0.0.0 -p $PORT collaborative_whiteboard_backend.asgi:application` (Daphne is required for WebSockets; Gunicorn/WSGI would serve pages but no live sync)
* **Persistent disk:** SQLite and uploads are files. Without a disk, Render wipes them on every deploy/restart. Add a disk (e.g., mounted at `/var/data`) and set `SQLITE_PATH=/var/data/db.sqlite3` and `MEDIA_ROOT=/var/data/media`
* **Environment:** the variables from `.env.example`; set `SECRET_KEY`; `DEBUG` defaults to `False` on Render
* Run a **single instance** (the realtime layer lives in process memory)

## Team

- Bien, Erik Samuel Legaspi | Lead Developer | eriksamuel.bien@cit.edu
- Beato, Angel Anel Celaya | Developer | angelanel.beato@cit.edu
- Bibit, Paul Andrei Eco | Developer | paulandrie.bibit@cit.edu

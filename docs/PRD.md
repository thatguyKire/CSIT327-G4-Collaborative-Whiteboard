# Product Requirements Document (PRD)

**Product:** COLLABoard: Collaborative Whiteboard
**Team:** CSIT327 Group 4: Erik Samuel L. Bien (Lead Developer), Angel Anel C. Beato (Developer), Paul Andrei E. Bibit (Developer)
**Version:** 1.0 · **Date:** 2026-10-14 · **Status:** Living document

---

## 1. Summary

COLLABoard is a web-based, real-time whiteboard for classrooms. A **teacher** opens a session, shares a short join code (or QR code), and **students** join from any browser. Everyone sees the same board live. The teacher decides who may draw, can broadcast announcements, toggle a session chat, save snapshots, and later review attendance and participation.

## 2. Problem statement

Online and hybrid classes rely on tools that are either:

* **Presentation-only** (screen share): students cannot contribute.
* **Fully open** (generic whiteboards): any participant can scribble over the lesson, and the teacher has no per-student control.
* **Disconnected**: drawing, chat, announcements and attendance live in separate apps, so teachers cannot see who actually participated.

Teachers need one place where they keep control of the board, can hand the "pen" to specific students, and can see afterwards who joined and contributed.

## 3. Goals and non-goals

### Goals
| # | Goal | Measured by |
|---|---|---|
| G1 | A student can join a live board in under 30 seconds | Time from opening the join page to seeing the board |
| G2 | Strokes appear on other screens fast enough to feel live | Median broadcast latency < 300 ms (NFR-01) |
| G3 | Teachers stay in control of who can draw | Per-student draw toggle, automatic revoke when a student leaves |
| G4 | Participation is visible and exportable | Attendance page and CSV, dashboard metrics (strokes, uploads, messages) |
| G5 | Work is not lost | Teacher can save snapshots; saved boards reload as the background and export as PNG/PDF |

### Non-goals (v1)
* Video/voice calls (use the school's existing meeting tool).
* Infinite canvas, shapes/text tools, layers UI.
* Native mobile apps (the web app must work on tablets and phones).
* Grading or LMS integration (possible later, see Implementation Plan).

## 4. Users and personas

| Persona | Description | Key needs |
|---|---|---|
| **Teacher "Ms. Reyes"** | Teaches 3–5 sections, runs live classes from a laptop | Fast session setup, control over drawing, announcements, attendance records |
| **Student "Paolo"** | Joins from a phone or school PC | Join with a code, see the board instantly, draw when called on, read announcements |
| **Admin "IT Office"** | Maintains accounts for the department | User/session overview, account management through Django Admin |

## 5. User stories

| ID | As a… | I want to… | So that… | Priority |
|---|---|---|---|---|
| US-01 | visitor | sign up as a student (with Student ID) or teacher | I can use the platform | Must |
| US-02 | user | log in with my username **or** institutional email | I don't need to remember which one | Must |
| US-03 | teacher | create a session with a title and get a join code + QR | students can join quickly | Must |
| US-04 | student | join a session by typing or scanning the code | I can see the board | Must |
| US-05 | teacher | draw, erase, undo/redo, highlight and pin on the board | I can teach visually | Must |
| US-06 | teacher | grant or revoke drawing per student | the board stays orderly | Must |
| US-07 | student | draw when allowed and see a clear "view-only" banner when not | I know what I can do | Must |
| US-08 | teacher | upload images/files to the board | I can annotate worksheets and slides | Should |
| US-09 | teacher | send (urgent) announcements to everyone in the session | students get instructions even if chat is off | Should |
| US-10 | participant | chat in the session, and the teacher can disable chat | discussion can happen without chaos | Should |
| US-11 | teacher | save a snapshot and later download it as PNG/PDF | the lesson is archived | Should |
| US-12 | teacher | see attendance (joined / last active) and export CSV | I can record attendance | Must |
| US-13 | teacher | see participation metrics per student | I can grade participation | Should |
| US-14 | student | see the sessions I joined and my own participation chart | I can track my activity | Could |
| US-15 | admin | see platform totals and manage users/sessions | I can support teachers | Could |
| US-16 | user | receive notifications in a bell menu | I don't miss announcements | Should |
| US-17 | teacher | duplicate a session | I can reuse a board for another section | Could |

## 6. Feature list and scope

| Feature | Release | Status |
|---|---|---|
| Accounts: signup, login (username/email), logout, roles, password rules | v1 | ✅ Done |
| Role dashboards (student / teacher / admin) | v1 | ✅ Done (admin now shows live counts) |
| Session management: create, search, duplicate, delete, QR invite | v1 | ✅ Done |
| Live whiteboard: pen, eraser, size, color, undo/redo, clear all | v1 | ✅ Done |
| Annotations: highlight, pin, clear marks | v1 | ✅ Done |
| Draw-permission control and presence (online dots, auto-revoke) | v1 | ✅ Done |
| Late-joiner sync (new students receive the current board) | v1 | ✅ Added in refinement |
| Uploads (images on board; PDF/DOCX/PPTX as links) | v1 | ✅ Done (now persisted and validated) |
| Announcements + notification bell | v1 | ✅ Done |
| Session chat with teacher toggle | v1 | ✅ Done |
| Snapshot save, saved sessions, PNG/PDF export | v1 | ✅ Done (PDF export fixed) |
| Attendance page + CSV | v1 | ✅ Done |
| Participation analytics (strokes, uploads, messages) | v1 | ✅ Done (metrics now real) |
| Password reset by email | v1.1 | ⏳ Planned |
| Persistent board state (vector strokes stored server-side) | v1.1 | ⏳ Planned |
| Text and shape tools, page/slide navigation | v2 | 💡 Proposed |
| LMS export (Google Classroom / Moodle) | v2 | 💡 Proposed |

## 7. Success metrics

| Metric | Target |
|---|---|
| Join success rate (valid code → board loaded) | ≥ 98 % |
| Median time to join | ≤ 30 s |
| Stroke latency (p50 / p95) | ≤ 300 ms / ≤ 800 ms |
| Sessions with at least one saved snapshot | ≥ 60 % of sessions lasting > 15 min |
| Crash-free page loads (HTTP 5xx rate) | ≤ 0.5 % |

## 8. Assumptions and constraints

* Users have a modern browser (Chrome, Edge, Firefox, Safari, latest two versions).
* The app is self-contained: one Django process (Daphne) with a SQLite database and a local media folder. No third-party backend service is required. Hosting needs a persistent disk for the database and uploads (e.g., a Render disk).
* Accounts are created by self-signup; there is no SSO in v1.
* Board state between live clients is relayed by the app's own WebSocket server (Django Channels). Only snapshots are stored on the server (see SDD §6).

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Single server process (in-memory WebSocket layer, SQLite) | Lag in very large classes; cannot scale to several servers | Throttle broadcasts; keep classes ≤ 50 live users; move to Redis channel layer + PostgreSQL to scale out |
| Hosting without a persistent disk | Database and uploads wiped on redeploy/restart | Mount a disk and set `SQLITE_PATH` / `MEDIA_ROOT` (TRD §8) |
| Unsaved boards are lost when everyone leaves | Lost lesson content | "Save" button, reminders in help; planned server-side stroke storage |
| Render free instance sleeps | Slow first load | Paid instance for class hours, or warm-up ping |
| Students drawing inappropriate content | Classroom disruption | Draw is off by default; teacher toggles per student; Clear All |

## 10. Related documents

[SRS](SRS.md) · [SDD](SDD.md) · [TRD](TRD.md) · [App Flow](APP_FLOW.md) · [UI/UX Brief](UI_UX_DESIGN_BRIEF.md) · [Backend Schema](BACKEND_SCHEMA.md) · [Implementation Plan](IMPLEMENTATION_PLAN.md)

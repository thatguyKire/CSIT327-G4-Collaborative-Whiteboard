# Application Flow

**System:** COLLABoard: Collaborative Whiteboard
**Version:** 1.0 · **Date:** 2026-10-14

This document maps every screen, who can reach it, and how users move between screens. URL names match `urls.py`.

---

## 1. Site map

```mermaid
flowchart TB
    ROOT["/ (landing)"] --> LOGIN["/auth/login/"]
    LOGIN <--> SIGNUP["/auth/signup/"]
    LOGIN --> REDIR["/dashboard/redirect/"]
    SIGNUP --> REDIR
    REDIR -->|student| SD["/dashboard/student/"]
    REDIR -->|teacher| TD["/dashboard/teacher/"]
    REDIR -->|admin| AD["/dashboard/admin/"]

    subgraph Shared["Sidebar (all roles)"]
        NOTIF["Bell dropdown → /notifications/"]
        PROF["/profiles/ → /profiles/edit/"]
        SETT["/settings/ → /settings/password_change/"]
        HELP["/help/"]
        CHATW["Chat window (on a board)"]
        LOGOUT["Logout (POST)"]
    end

    SD --> JOIN["/session/join/"]
    JOIN --> SWB["/session/{id}/student/"]
    SD --> SWB

    TD --> SL["/session/ (Manage Sessions)"]
    TD --> TWB["/session/{id}/ (teacher board)"]
    TD --> SAVED["/session/sessions/saved/"]
    SL --> TWB
    SL --> ATT["/session/{id}/attendance/"]
    SL --> QR["Invite QR modal"]
    SL --> PDF["/session/export_pdf/{id}/"]
    SAVED --> PDF
    SAVED --> TWB

    AD --> DJA["/admin/ (Django Admin)"]
```

## 2. Screen inventory

| Screen | URL | Roles | Template | Main actions |
|---|---|---|---|---|
| Landing | `/` | anyone | none (redirect) | → Login |
| Login | `/auth/login/` | anyone | `authentication/login.html` | Log in with username or email; link to Sign up |
| Sign up | `/auth/signup/` | anyone | `authentication/signup.html` | Create a student/teacher account |
| Student dashboard | `/dashboard/student/` | student | `dashboard/student_dashboard.html` | Join session, open joined sessions, participation chart |
| Teacher dashboard | `/dashboard/teacher/` | teacher | `dashboard/teacher_dashboard.html` | Recent sessions, Manage Sessions, performance table + chart |
| Admin dashboard | `/dashboard/admin/` | admin | `dashboard/admin_dashboard.html` | Platform counts, links to Django Admin |
| Manage sessions | `/session/` | teacher, admin | `session/session_list.html` | Create, search, open, attendance, invite (QR), PDF, duplicate, delete |
| Saved sessions | `/session/sessions/saved/` | teacher, admin | `session/saved_sessions.html` | Open snapshot, PNG, PDF, open board |
| Join session | `/session/join/?code=` | any logged-in user | `session/join_session.html` | Enter or confirm code |
| Teacher board | `/session/{id}/` | owner, staff | `session/whiteboard.html` | Draw tools, Clear All, Save, chat toggle, upload, participants, announcements |
| Student board | `/session/{id}/student/` | participant | `session/whiteboard.html` | Draw tools when allowed, upload when allowed, announcements panel, chat |
| Attendance | `/session/{id}/attendance/` | owner, staff | `session/attendance.html` | Live table, CSV export |
| Notifications | `/notifications/` | all | `notifications/notifications.html` | Full list of notifications |
| Profile / Edit | `/profiles/`, `/profiles/edit/` | all | `profiles/*.html` | View profile, change email |
| Settings | `/settings/` | all | `settings_app/settings.html` | Links to profile, password change, help, logout |
| Change password | `/settings/password_change/` | all | `settings_app/password_change.html` | Change password (stays logged in) |
| Help | `/help/` | all | `help_app/help.html` | FAQs |
| Django Admin | `/admin/` | staff | Django | Manage users, sessions, notifications, chat |

## 3. Authentication flow

```mermaid
flowchart TD
    A([Open site]) --> B{Logged in?}
    B -- no --> L[Login page]
    B -- yes --> L
    L -->|"Sign up here"| S[Sign up form]
    S --> V{Form valid?<br/>unique username/email,<br/>student ID if student,<br/>password rules}
    V -- no --> S
    V -- yes --> CU[Create user + log in] --> R
    L --> C{Credentials OK?<br/>username or email}
    C -- no --> L
    C -- yes --> R{{"/dashboard/redirect/"}}
    R -->|role = student| SD[Student dashboard]
    R -->|role = teacher| TD[Teacher dashboard]
    R -->|role = admin| AD[Admin dashboard]
```

The login page is shown even to logged-in users (intentional: lets users switch accounts). A `next` parameter is ignored; users always land on their dashboard.

## 4. Teacher flow: running a class

```mermaid
flowchart TD
    TD[Teacher dashboard] --> MS[Manage Sessions]
    MS --> CR{Create session<br/>title unique for me?}
    CR -- no --> MS
    CR -- yes --> WB[Teacher whiteboard]
    MS -->|Invite| QR[QR modal + copy code] --> SHARE([Share code with class])
    WB --> PANEL[Participants panel<br/>online dots appear as students join]
    PANEL -->|toggle| PERM[Grant / revoke drawing]
    WB --> DRAW[Draw, erase, undo/redo,<br/>highlight, pin, upload]
    WB --> ANN[Send announcement]
    WB --> CHT[Enable / disable chat]
    WB --> SAVE[Save snapshot]
    WB --> CLR[Clear All]
    WB -->|Back| MS
    MS --> ATT[Attendance → CSV]
    TD --> SAVED[Saved Sessions → PNG / PDF]
```

## 5. Student flow: joining and participating

```mermaid
flowchart TD
    SD[Student dashboard] --> J[Join Session]
    QRS([Scan teacher's QR]) --> J2["Join page<br/>code pre-filled"]
    J --> F[Enter code]
    J2 --> F
    F --> V{Valid code?}
    V -- no --> E["'Invalid session code'"] --> F
    V -- yes --> P[Participant created / reused<br/>can_draw = off]
    P --> B[Student board<br/>view-only banner]
    B -->|teacher grants| D[Toolbar appears:<br/>draw, erase, annotate, upload]
    D -->|teacher revokes or I go offline| B
    B --> AN[Announcements panel + bell]
    B --> CH[Chat, if enabled]
    B --> EX[Export PNG]
    B -->|Back| SD
    SD -->|Open| B
```

## 6. Whiteboard interaction flow (inside the board)

```mermaid
flowchart LR
    subgraph Load
        L1[Page loads] --> L2[Draw saved snapshot<br/>as background]
        L2 --> L3[Subscribe wb:session channel]
        L3 --> L4[Track presence]
        L4 --> L5[Ask peers for current board]
    end
    subgraph Draw["While can_draw"]
        D1[pointerdown] --> D2{On an image?}
        D2 -- yes --> IM[Select / move / resize / ✕ delete]
        D2 -- no --> D3[Stroke on my layer + broadcast]
        D3 --> D4[pointerup → history snapshot,<br/>count stroke]
    end
    subgraph Receive
        R1[stroke / layer / image / anno / perm / meta events] --> R2[Update layers → redraw]
    end
    L5 --> Draw
    L5 --> Receive
```

## 7. Permission change flow

```mermaid
sequenceDiagram
    actor T as Teacher
    participant UI as Teacher board
    participant API as Django API
    participant RT as WebSocket server
    actor S as Student board
    T->>UI: flip "Allow drawing" switch
    UI->>API: POST can-draw
    alt saved
        API-->>UI: ok
        UI->>RT: perm {uid, can}
        RT-->>S: perm
        S->>S: toast "You can now draw." / view-only banner
    else failed
        API-->>UI: error
        UI->>UI: switch reverts + alert
    end
```

## 8. Notification and chat flow

```mermaid
flowchart TD
    A[Teacher sends announcement] --> N[Notification rows<br/>one per participant]
    N --> B1[Bell badge count<br/>5 s poll]
    N --> B2[Student board<br/>Announcements panel]
    B1 -->|open bell| MR[Mark all read - POST]
    B1 -->|See all| NP[Notifications page]

    C0[Chat bubble] --> C1{Chat enabled?}
    C1 -- no --> CD["'Chat Disabled' popup"]
    C1 -- yes --> C2[Get room → load messages → poll 5 s]
    C2 --> C3[Send message ≤ 1000 chars]
    TT[Teacher toggles chat] -->|meta broadcast| C1
```

## 9. Error and edge states

| Situation | What the user sees |
|---|---|
| Wrong login | "⚠️ Invalid credentials. Please try again." |
| Student opens teacher URL of a session they joined | Redirected to the student board |
| Anyone opens a board they did not join | Redirected to Join page with "You are not part of this session…" |
| Student opens teacher-only page (sessions, saved) | Redirected to own dashboard with "🚫 You do not have permission…" |
| Duplicate session title | "You already have a session named '…'" on Manage Sessions |
| Upload too large / wrong type | Toast "⚠️ File is larger than 10 MB." / "⚠️ Unsupported file type." |
| Upload while view-only | "You don't have permission to upload (ask the teacher to enable drawing)." |
| Save fails (disk error, file too large) | Toast "Save failed." |
| PDF export with no snapshot | "No snapshot available" (404). The PDF button only shows when a snapshot exists |
| Chat disabled mid-conversation | Input disabled, "Chat Disabled" popup |
| WebSocket disconnected (network drop, server restart) | Board keeps working locally; client reconnects automatically (backoff up to 10 s) and re-syncs strokes |

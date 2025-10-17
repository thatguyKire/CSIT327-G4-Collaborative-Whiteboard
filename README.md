# 🧠 CSIT327-G4 — Collaborative Whiteboard

## 🖋️ Project Name
**Collaborative Whiteboard**

---

## 📖 Project Description
**Collaborative Whiteboard** is a real-time web application designed to enhance teamwork, online learning, and brainstorming by allowing multiple users to draw, write, and share ideas on a shared digital canvas.  
The system supports **real-time synchronization**, **user role management** (teachers as hosts and students as participants), and **session storage** for later access — providing a seamless and interactive collaboration experience.

---

## ⚙️ Technologies, Frameworks, and Tools Used

| Category | Tools |
|-----------|-------|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Django |
| **Database** | Supabase (PostgreSQL) |
| **Other Tools/Services** | GitHub, Render (for deployment), Figma (for UI design), Visual Studio Code |

---

## 🧩 Setup Guide

### 🖥️ Installation

#### 1️⃣ Clone the repository
```bash
git clone https://github.com/yourusername/CSIT327-G4-CollaborativeWhiteboard.git
2️⃣ Navigate to the project directory
bash
Copy code
cd CSIT327-G4-CollaborativeWhiteboard
3️⃣ Create a virtual environment
On macOS and Linux

bash
Copy code
python3 -m venv env
source env/bin/activate
On Windows

bash
Copy code
python -m venv env
.\env\Scripts\activate
4️⃣ Install dependencies
bash
Copy code
pip install -r requirements.txt
🗄️ Database Configuration (Supabase / PostgreSQL)
1️⃣ Create a .env file in the project root directory
2️⃣ Add your credentials inside the file
bash
Copy code
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_api_key
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[dbname]
3️⃣ Apply database migrations
bash
Copy code
python manage.py migrate
4️⃣ Create a Superuser/Admin
bash
Copy code
python manage.py createsuperuser
🚀 Run the Server
Start the local development server:

bash
Copy code
python manage.py runserver
 
👥 Team Members
Name	Role	Email
Bien, Erik Samuel Legaspi	Lead Developer	eriksamuel.bien@cit.edu
Beato, Angel Anel Celaya	Developer	angelanel.beato@cit.edu
Bibiy, Paul Andrei Eco	Developer	paulandrie.bibit@cit.edu
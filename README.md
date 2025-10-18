# Collaborative Whiteboard
Collaborative Whiteboard is a real-time web application designed to enhance teamwork, online learning, and brainstorming by allowing multiple users to draw, write, and share ideas on a shared digital canvas.  
It supports real-time synchronization, user role management (teachers as hosts and students as participants), and session storage for later access — providing a seamless and interactive collaboration experience.

---

## List all technologies, frameworks, and tools used:

**Frontend:** HTML, CSS, JavaScript  
**Backend:** Django  
**Database:** Supabase  
**Other Tools/Services:** GitHub, Visual Studio Code  

---

## Setup

### Installation

1. **Clone the repository.**
    ```bash
    git clone https://github.com/yourusername/CSIT327-G4-CollaborativeWhiteboard.git
    ```

2. **Setup the virtual environment.**

    i. Navigate to project root directory.  
    ```bash
    cd Collaborative-Whiteboard-Backend
    ```

    ii. Create a virtual environment.  
    ```bash
    # On macOS and Linux
    python3 -m venv env

    # On Windows
    python -m venv env
    ```

    iii. Activate the virtual environment.  
    ```bash
    # On macOS and Linux
    source env/bin/activate

    # On Windows (PowerShell)
    .\env\Scripts\activate
    ```

3. **Install dependencies.**
    ```bash
    pip install -r requirements.txt
    ```

---

### (Optional step) If you want to use a database that uses PostgreSQL like Supabase:

4. **Setup Supabase/PostgreSQL database connection**

    i. Create a `.env` file.  

    ii. Copy and paste this into your file:
    ```bash
    # Replace it with your database credentials
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_api_key
    DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[dbname]
    ```

---

### Database configuration

5. **Migrate models in database**

    i. Navigate to the project directory.
    ```bash
    cd collaborative_whiteboard_backend
    ```

    ii. Migrate models.
    ```bash
    python manage.py migrate
    ```

6. **Create a Superuser/Admin**
    ```bash
    python manage.py createsuperuser
    ```

---

### Run

7. **Start the server**
    ```bash
    python manage.py runserver
    ```

---

## Team Members
- Bien, Erik Samuel Legaspi | Lead Developer | eriksamuel.bien@cit.edu  
- Beato, Angel Anel Celaya | Developer | angelanel.beato@cit.edu  
- Bibiy, Paul Andrei Eco | Developer | paulandrie.bibit@cit.edu

# APIMetric Gateway & Real-Time Telemetry Engine

## Project Ideology: Why We Built This

Modern web architecture relies heavily on microservices—small, independent services (like a Weather API, Stock API, or Currency Conversion API) that talk to each other and to client applications. However, managing these services creates three massive challenges for developers and platform engineers:

1. **API Key Security & Control:** How do you issue API keys to developers, ensure only authorized users access your services, and instantly block compromised keys?
2. **Real-Time Observability & Telemetry:** How do you track which user is making requests, which endpoints are popular, and how fast your server responds (in milliseconds), all without slowing down the actual user requests?
3. **Role Separation:** Developers only need to manage their own keys and test endpoints. Administrators need a high-level bird's-eye view of all users, request volumes, error distributions, and system health.

**APIMetric** was built to solve these exact problems. It is a lightweight, asynchronous API Gateway and Telemetry Engine. It sits between incoming client requests and backend microservices, acting as a security guard and traffic meter. Every single request is timed, logged into a database, aggregated using high-performance data tools, and rendered into live visual charts for system administrators.

---

## What the System Does & How It Works

1. **Authentication & Security:** Users register and log in securely using JSON Web Tokens (JWT) and encrypted passwords (hashed with bcrypt). The system automatically separates accounts into **Developers** and **Admins**.
2. **Key Generation:** Developers can generate cryptographically secure API keys (prefixed with `apm_`).
3. **Middleware Interception:** When a user executes an API request (passing their key in the `X-API-Key` header), our custom backend middleware intercepts the call:
* It starts a high-precision timer.
* It verifies that the key exists and is marked as active.
* It lets the endpoint run and complete.
* It stops the timer, calculates response latency in milliseconds, and writes a log entry (Key ID, Endpoint, HTTP Status Code, Latency, Timestamp) to the MySQL database.


4. **Data Aggregation with Pandas:** When an Admin opens their dashboard, the backend doesn't run slow, heavy database queries. Instead, it streams raw log records into a **Pandas DataFrame** in Python memory. Pandas computes average latency, peak speed, and HTTP status code counts (e.g., HTTP 200 Success vs. HTTP 401 Unauthorized) across all users in milliseconds.
5. **Multi-Tenant Graphical Dashboard:** The admin frontend takes that Pandas analytical JSON data and uses **Recharts** to display live bar charts comparing request volumes across every user in the system ($User_1, User_2, \dots, User_n$).
6. **Instant Key Revocation:** If an administrator sees suspicious activity or excessive error codes from a specific user, they can click a single button to revoke that user's key. The gateway middleware instantly starts rejecting all subsequent calls with that key.

---

## Complete Breakdown of Built Project Files

The project is structured into a clean separation between the Python FastAPI backend, the React Vite frontend, and an automated Pytest testing suite.

### **1. Backend Directory (`backend/app/`)**

* **`backend/app/database.py`**
Configures the SQLAlchemy database engine and session maker. It manages connection pooling to our local MySQL database (`apimetric_db`) so all API routes can cleanly read and write records.
* **`backend/app/schemas.py`**
Contains Pydantic models that validate data coming into and leaving the API. It ensures that user registration payloads (email, password) and API key responses strictly follow expected JSON formats.
* **`backend/app/main.py`**
The central powerhouse of the entire backend. It contains:
* Database Table Definitions (`User`, `APIKey`, `RequestLog`).
* JWT Token creation logic and Password Hashing helpers (`passlib`/`bcrypt`).
* Custom **`TelemetryMiddleware`** that intercepts every HTTP request, timing latency and writing telemetry logs to MySQL.
* User Auth endpoints (`/auth/register`, `/auth/register-admin`, `/auth/login`).
* Key Management endpoints (`/keys/generate`, `/keys/`, `/keys/revoke/{key_id}`).
* Admin Analytics endpoint (`/analytics/admin-summary`) that loads SQL records into **Pandas** for aggregate metrics.
* Mock Microservice Endpoints (`/api/v1/weather`, `/api/v1/stock`, `/api/v1/currency`) to test payload execution.



### **2. Automated Test Directory (`backend/tests/`)**

* **`backend/tests/test_gateway.py`**
The automated Pytest integration suite. It uses FastAPI's `TestClient` to test the backend logic programmatically without opening a web browser:
* Asserts the server root status is online.
* Verifies requests without API keys are blocked with `HTTP 401`.
* Verifies fake/invalid API keys are rejected.
* Simulates a full end-to-end lifecycle: Registering a user, logging in, acquiring a JWT token, generating an API key, and executing microservice endpoints.



### **3. Frontend Directory (`frontend/src/`)**

* **`frontend/src/api.js`**
Configures an Axios client instance pointing to `http://localhost:8000`. It automatically attaches the user's JWT Bearer token to outgoing HTTP authorization headers.
* **`frontend/src/App.jsx`**
The single-page React frontend application featuring a dual-portal view:
* **Auth Screen:** Tabbed interface allowing standard users or administrators (requiring an admin secret key) to register and sign in.
* **User Dashboard:** Stripped of unnecessary charts. Gives developers a clean interface to generate keys, copy credentials, and test Weather/Stock/Currency endpoints in an interactive console.
* **Admin Console:** High-level dashboard displaying aggregate system metrics, side-by-side Recharts bar charts (comparing per-user request counts and global HTTP status distributions), and an Admin Key Control Table to revoke user keys in real time.


* **`frontend/src/main.jsx` & `frontend/src/index.css**`
Mounts the React application into the DOM tree and imports utility-first styling rules powered by Tailwind CSS.

---

## Step-by-Step Execution Guide

To run the entire platform from scratch on your local machine, open three separate PowerShell terminal windows.

### **Terminal 1: Start the Backend Gateway**

Navigate to the project root directory, activate your virtual environment, set the Python module path, and launch the Uvicorn web server:

```powershell
cd C:\Users\ACER\OneDrive\Desktop\apimetric
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH="."
uvicorn backend.app.main:app --reload

```

*The FastAPI engine runs on `[http://127.0.0.1:8000](http://127.0.0.1:8000)`.*

---

### **Terminal 2: Start the Frontend Interface**

Navigate to the `frontend` folder, install Node packages, and boot up the Vite development server:

```powershell
cd C:\Users\ACER\OneDrive\Desktop\apimetric\frontend
npm install
npm run dev

```

*The React Portal opens on `http://localhost:5173`.*

---

### **Terminal 3: Run Automated System Tests (Pytest)**

To programmatically verify backend health, JWT security, and endpoint execution speed in under 3 seconds:

```powershell
cd C:\Users\ACER\OneDrive\Desktop\apimetric
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH="."
pytest backend/tests/test_gateway.py -v

```

All 4 test assertions will execute programmatically and return green `PASSED` status indicators, confirming your system is stable, secure, and ready for production deployment.
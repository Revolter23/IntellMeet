# IntellMeet 🚀

**IntellMeet** is an intelligent, real-time collaboration and virtual meeting platform designed for professional teams. It seamlessly combines video conferencing, real-time chat, collaborative workspace boards, cloud recording storage, and AI-powered meeting intelligence (summaries, key takeaways, and action items).

---

## 🛠 Tech Stack

### **Frontend (Client)**
* **Core Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tooling:** [Vite 8](https://vitejs.dev/)
* **Styling & UI:** TailwindCSS v4, Radix UI, Shadcn UI, HugeIcons, Figtree Variable Font
* **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
* **Routing:** React Router v7
* **Real-time Client:** Socket.io Client
* **Form & Validation:** React Hook Form + Zod
* **Drag and Drop:** `@hello-pangea/dnd`

### **Backend (Server)**
* **Runtime & Framework:** Node.js + Express 5
* **Real-Time WebSockets:** Socket.io (with Redis adapter support)
* **Database:** MongoDB with Mongoose ODM
* **Caching & Message Broker:** Redis
* **AI Engine:** Google Gemini AI SDK (`@google/genai`)
* **Security & Auth:** Dual-Token JWT (Access & HTTP-only Refresh Cookies), Bcrypt password salting, Helmet, Cors, Express Rate Limit
* **Cloud & Media Storage:** Cloudinary SDK (direct signed avatar uploads), AWS S3 SDK (presigned URL uploads for meeting recordings)

### **DevOps & Containerization**
* **Containerization:** Docker & Docker Compose
* **Orchestration:** Kubernetes (`k8s`) & Helm Charts

---

## ✨ Features Available

- 📹 **Real-Time Video Conferencing & Chat:** Seamless meeting rooms powered by WebSockets for instant video/audio interaction and live messaging.
- 🤖 **AI Meeting Intelligence (Google Gemini):** Automated post-meeting analysis delivering transcript summaries, key takeaways, and actionable tasks.
- 📋 **Interactive Workspace & Kanban Boards:** Integrated drag-and-drop boards (`@hello-pangea/dnd`) for task tracking and team collaboration.
- ☁️ **Direct Cloud Media Uploads:**
  - Secure profile avatar uploads using Cloudinary SHA-1 signed URLs.
  - Efficient direct video recording storage to Amazon S3 via AWS Presigned URLs.
- 🗓 **Meeting Scheduling & Analytics:** Dashboard for scheduling future meetings, reviewing past sessions, and accessing post-meeting analytical dashboards.
- 🔒 **Enterprise-Grade Security:** Dual-token JWT architecture with HTTP-only cookies protecting against XSS attacks, bcrypt password hashing, and Helmet headers.
- 🔔 **Notification System:** In-app real-time notifications for meeting invites, workspace activities, and updates.

---

## 💻 Local Setup Instructions

Follow these instructions to set up and run IntellMeet locally on your machine.

### **Prerequisites**
Ensure you have the following installed on your system:
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- **Git**
- **MongoDB** (Local instance running on `mongodb://localhost:27017` or a MongoDB Atlas URI)
- **Redis** (Optional: for socket scaling and caching)

---

### **1. Get the Code**

If you haven't cloned the repository yet:
```bash
git clone <repository-url>
cd IntellMeet
```

If you already have the repository cloned, pull the latest changes:
```bash
git pull origin main
```

---

### **2. Install Dependencies**

Install root dependencies as well as dependencies for both the frontend (`client`) and backend (`server`):

```bash
# Install root dependencies (concurrently)
npm install

# Install client and server dependencies
npm install --prefix client
npm install --prefix server
```

---

### **3. Environment Configuration**

Create a `.env` file inside the `server/` directory:

```bash
# Create server .env file
touch server/.env
```

Add the following environment variables to `server/.env`:

```env
# Server Configuration
PORT=3000
CLIENT_URL=http://localhost:5173

# Database & Cache
MONGOOSE_KEY=mongodb://localhost:27017/intellmeet
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication (JWT)
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# Cloudinary (Optional - Profile Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AWS S3 (Optional - Meeting Recording Uploads)
AWS_REGION=your_aws_region
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your_s3_bucket_name

# Google Gemini AI (Optional - Meeting Summaries & Insights)
GEMINI_API_KEY=your_gemini_api_key
```

---

### **4. Running the Application Locally**

#### **Option A: Run Client and Server Concurrently (Recommended)**
From the root directory of the project, run:
```bash
npm run dev
```
This will launch both the Express backend server (`http://localhost:3000`) and the Vite React client (`http://localhost:5173`) simultaneously.

#### **Option B: Run Services Separately**
If you prefer running services in separate terminal windows:

* **Backend Server:**
  ```bash
  cd server
  npm run dev
  ```
  *(Runs on http://localhost:3000)*

* **Frontend Client:**
  ```bash
  cd client
  npm run dev
  ```
  *(Runs on http://localhost:5173)*

#### **Option C: Run via Docker Compose**
If you have Docker installed, you can spin up the full stack (MongoDB, Redis, Server, and Client) with a single command:
```bash
docker-compose up --build
```
Access the client at `http://localhost:80` and server at `http://localhost:3000`.


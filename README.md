# 🎯 Multitenant SaaS Platform

A secure and scalable **multitenant SaaS platform** that allows multiple organizations to manage **users, roles, authentication, authorization, projects, tasks, and real-time collaboration** — all inside a single unified system.

---

## 🚀 Features

### 🔐 Authentication & Authorization
- JWT-based login/logout  
- Role-based access control (Admin, Manager, Employee, etc.)  
- Protected frontend + backend routes  
- Prevents direct URL access  

### 🏢 Multitenancy
- Isolated tenants  
- No cross-tenant data leakage  
- Tenant-specific users, roles, projects, tasks, and settings  
- Admin controls only their organization  

### 🗂️ Project Management
- Create/manage projects  
- Add tasks, assign users, update statuses  
- Role-restricted actions  
- Clean dashboard and workflow UI  

### ⚡ Real-Time Features
- Live updates via Socket.IO  
- Real-time task/project status changes  
- Multi-user activity updates  

### 📦 Tech Stack
- **Frontend:** React + Vite + Tailwind  
- **Backend:** Node.js + Express + Prisma  
- **Database:** NeonDB (PostgreSQL)  
- **Hosting:** Render  
- **Real-time:** Socket.IO  

## 🏗️ Architecture
Frontend (React + Vite)
|
| REST + WebSocket
v
Backend API (Express + Prisma)
|
| PostgreSQL ORM
v
Database (NeonDB)


---

## ⚙️ Environment Variables

### Frontend
VITE_API_URL=<backend url>
VITE_SOCKET_URL=<backend url>


### Backend
DATABASE_URL=<neondb url>
JWT_SECRET=<jwt secret>
PORT=10000

---

## 🚀 Deployment (Render)

### Frontend (Static Hosting)
- Build command: `npm run build`  
- Publish directory: `dist`  
- Add rewrite rule:  
/* → /index.html

- Add environment variables  

### Backend (Web Service)
- Start command: `npm start`  
- Add env variables  
- Prisma migrations run automatically  
- Test API via Render URL  

---

## 🧪 Testing Instructions

### 1. Tenant Signup
- Creates organization + admin account  

### 2. Login Tests
- Valid login  
- Invalid password  
- Protected route access  

### 3. RBAC Tests
- Admin: full access  
- Employee: restricted pages  

### 4. Tenant Isolation
- Tenant A cannot access Tenant B resources  
- Test via URL IDs and API  

### 5. CRUD
- Create/update/delete projects  
- Create/update/delete tasks  

### 6. WebSocket Test
- Open 2 browser windows  
- Update task → see real-time change  

---

## 📚 Project Structure

root/
│── frontend/
│ └── src/
│
│── backend/
│ ├── prisma/
│ ├── routes/
│ ├── controllers/
│ ├── middlewares/
│ └── server.js

yaml
Copy code

---

## 🙌 Contributing
Open issues or pull requests to improve the project.

---

## 📄 License
MIT License.


## 🏗️ Architecture


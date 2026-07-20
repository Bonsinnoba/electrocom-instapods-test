# ElectrCom

**ElectrCom** is a high-performance, decoupled retail ecosystem. It provides a robust backend API and specialized React applications for customers and administrators, designed to handle everything from stock automation to complex warehouse workflows.

---

## 🏗️ Project Architecture

```text
/ElectrCom-project
  ├── /api            (PHP 8.1+ REST API)
  ├── /storefront     (React Customer Application)
  ├── /admin-panel    (React Management Application)
```

---

## 🚀 Getting Started

### 1. Backend API Setup
- Ensure **PHP 8.1+** and **MySQL 8.0+** are available.
- Create a `.env` file in `/api` using the provided `.env.example`.
- Run: `php -S localhost:8000` (for local development).

### 2. Frontend Applications
Navigate to both `/storefront` and `/admin-panel` and run:
```bash
npm install
npm run dev
```

---

## 📖 Essential Documentation

For up-to-date technical details and deployment guides, please refer to:

- **[TECHNICAL_OVERVIEW.md](TECHNICAL_OVERVIEW.md)**: A precise breakdown of system capabilities, security measures (Argon2id, IP-pinned JWT), and technical trade-offs.
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)**: Detailed configuration for server setup, SPA routing, and production environments.
- **[PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md)**: Guidelines for maintaining sub-second load times and efficient asset management.

---

## 🛡️ Security & Performance Highlights

- **Argon2id + Pepper**: Industry-leading password security.
- **IP-Pinned JWT**: Real-time session hijacking prevention.
- **Stock Automation**: Efficient stock status synchronization without manual intervention.
- **Lazy Loading**: Route-level code splitting for a premium customer experience.

---
© 2026 ElectrCom. All rights reserved.

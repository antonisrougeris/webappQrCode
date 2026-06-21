# DevDromos - Overall Documentation Part B (Client-Server)

This document provides a comprehensive overview of the DevDromos application architecture and functionality for Part B, detailing the interaction between the Frontend (Client) and Backend (Server).

## Team Members
* **ANTONIS KOURIS** - 3220089
* **ANTONIS ROUNGERIS** - 3220172

## Architecture & Data Flow
The application implements a **REST API** architecture:
1. **Frontend (Vite + TypeScript):** Handles user interaction and sends asynchronous fetch requests to the server.
2. **Backend (Node.js + Express):** Processes requests, validates Firebase ID tokens for protected routes, and interacts with the database.
3. **Database (Firebase/Firestore):** Provides persistent storage for users, courses, books, and shopping carts.

## Key API Endpoints
The integration is built upon the following core endpoints:

| Category | Endpoint | Functionality |
|----------|----------|---------------|
| **Auth** | `POST /api/auth/register` | User registration & Firebase auto login |
| **Auth** | `POST /api/auth/login` | User authentication |
| **Data** | `GET /api/courses` | Fetch all available courses |
| **Data** | `GET /api/books` | Fetch all available books |
| **Cart** | `GET /api/cart` | Retrieve cart items (Firebase ID token required) |
| **Cart** | `POST /api/cart` | Add item to persistent cart |
| **Orders**| `POST /api/checkout` | Process order & create enrollments |

## Implemented Core Functionality
The following features fulfill the project requirements:
* **Full Authentication Flow:** Secure Login/Register with Firebase Auth and session management via Firebase ID tokens.
* **Dynamic Data Rendering:** Content is fetched dynamically from Firestore instead of hardcoded local files.
* **Persistent Shopping Cart:** Items are stored server-side, ensuring the cart remains consistent across sessions.
* **Security & Guards:** Protected routes (e.g., Cart, Checkout) are restricted to authenticated users via Frontend Auth Guards and Backend Middleware.

## Execution Instructions
1. Set up the Firebase project and the server `.env` file.
2. In the `server` directory: run `npm install` then `npm start` (runs on port 4000).
3. In the `client` directory: run `npm install` then `npm run dev` (runs on port 5173).
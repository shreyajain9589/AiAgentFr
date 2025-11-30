# AiAgentFr

> ✨ Frontend for your AI-Agent Chat Application

## 📚 Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Project Structure](#project-structure)

- ## 🧠 About
AiAgentFr is the frontend of your collaborative AI-agent chat application.  
It is built with **React** and **Vite**, providing a fast, lightweight, and responsive chat interface for interacting with AI agents.

---

## ✅ Features
- Clean and minimal chat UI  
- Fast development experience with Vite  
- Secure API handling using `.env`  
- Organized component-based structure in `src/`  
- Ready for deployment (Vercel / Netlify / any static host)

- ## 🛠️ Tech Stack
- **React**
- **Vite**
- **JavaScript (ES6+)**
- **npm**
- **ESLint**

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

VITE_API_URL=your_backend_api_url_here

Install dependencies:
npm install

Create a .env file:
cp .env.example .env

Running Locally
npm run dev

Open the URL shown in terminal (usually http://localhost:5173).

Build for Production
npm run build
📁 Project Structure
AiAgentFr/
  ├── src/              # All source code (components, pages, hooks, logic)
  ├── .env.example      # Example environment template
  ├── .gitignore
  ├── index.html
  ├── package.json
  ├── vite.config.js
  ├── eslint.config.js
  └── README.md

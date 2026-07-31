# Durdans LIMS Frontend

Production-facing web application for Durdans Hospital Laboratory Information Management System (LIMS), built with Next.js App Router and React.

![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white)
![Keycloak](https://img.shields.io/badge/Keycloak-4D4D4D?logo=keycloak&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=white)

## Overview

The frontend provides role-based workflows for:

- patient and order/billing operations
- phlebotomy sample collection and rejection/recollection
- lab reception and accessioning
- MLT result entry
- supervisor verification and clinical authorization
- report dispatch tracking

It integrates with the backend API and Keycloak-secured authentication.

## 🧰 Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Axios
- Keycloak JS
- ESLint 9

## 🗂 Repository Structure

- `src/app`: route pages (role-protected sections under `src/app/(protected)`)
- `src/components`: reusable UI components
- `src/lib`: API and auth clients (`axios`, `keycloak`)
- `src/constants`, `src/types`: shared constants and TypeScript contracts
- `public`: static assets

## ✅ Prerequisites

- Node.js 20+ (recommended LTS)
- npm (or pnpm/yarn)
- Backend service running (`http://localhost:11000` by default)
- Keycloak running (`http://localhost:8081` by default)

## 🔐 Environment Variables

Create a local env file (`.env.local`) and set values as needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:11000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081
NEXT_PUBLIC_KEYCLOAK_REALM=lims-realm
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=lims-frontend
```

Defaults already exist in code, but explicit env values are recommended for clarity across environments.

## 🚀 Local Development

```bash
npm install
npm run dev
```

App runs at:

- [http://localhost:3000](http://localhost:3000)

## 🛠 Available Scripts

- `npm run dev` - start local development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run ESLint checks

## 📦 Build and Release

1. Ensure backend and auth dependencies are reachable.
2. Run lint and production build:

   ```bash
   npm run lint
   npm run build
   ```

3. Deploy artifacts using your preferred hosting/runtime.

## 🛡 Security and Repo Hygiene

- Do not commit `.env` files with secrets.
- Keep local IDE/AI folders excluded (`.idea`, `.vscode`, `.cursor`, `.codex-logs`).
- Use environment variables per environment (dev/stage/prod), not hardcoded URLs or credentials.

## 🩺 Troubleshooting

- **401/403 from API**: verify Keycloak session/token and role mapping.
- **Cannot reach API**: confirm `NEXT_PUBLIC_API_URL` and backend port.
- **Login redirect/auth issues**: verify Keycloak URL/realm/client ID values.
- **Build failures**: run `npm install` again and ensure Node version matches project requirements.

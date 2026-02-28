# FairPay

FairPay is a modern, cross-platform expense splitting and group settlement application. It simplifies shared finances by allowing friends and groups to track expenses, calculate optimized debts, and settle up easily. The app is built as a hybrid mobile application using web technologies, providing native-like features such as automatic SMS parsing for UPI payments and OTA (Over-The-Air) updates.

Web URL :- https://fair-pay-problem-solvers.vercel.app/

## Key Features

- **Group & Friend Expense Tracking**: Centralize expenses within groups or split costs individually with friends.
- **Smart Settlements**: Automatically calculates the most efficient way to settle debts using minimal transactions.
- **Automated UPI Payment Detection** *(Mobile Only)*: Automatically reads SMS messages for UPI payments (via `cordova-plugin-sms-receive`) and prompts users to log the expense directly in the app.
- **Over-The-Air (OTA) Updates** *(Mobile Only)*: Silently download and apply updates in the background (via Capacitor Updater) without requiring app store resubmissions.
- **Real-time Synchronization**: Powered by Firebase Authentication and a custom Express/MongoDB backend, ensuring that user profiles and offline states sync smoothly across devices.
- **Modern UI & Dark Mode**: A stunning, premium user interface built with Tailwind CSS, shadcn/ui components, and accessible Radix UI primitives.
- **Offline Capabilities**: Uses local persistence and IndexedDB caching to keep users logged in and data accessible even in poor network conditions.

## Tech Stack

FairPay is fully typed in TypeScript and structured as a monorepo consisting of:

### Frontend (Client)
- **Framework**: React 18, Vite
- **Routing**: React Router (`react-router-dom`)
- **State & Data Fetching**: React Query (`@tanstack/react-query`), Context API
- **Styling**: Tailwind CSS, class-variance-authority, clsx, tailwind-merge
- **UI Components**: custom components built on `shadcn/ui` + `@radix-ui/react-*` primitives, `lucide-react` for icons, Recharts for data visualization.
- **Forms**: React Hook Form with Zod validation.
- **Mobile Integration**: Capacitor 8 for Android compilation, Local Notifications, Capgo Capacitor Updater, and Cordova SMS receive plugin.
- **Authentication**: Firebase Auth (Google Provider + Email)

### Backend (Server)
- **Framework**: Node.js, Express
- **Database**: MongoDB (via Mongoose schemas like `User`, `Group`, `Expense`, `Stats`, etc.)
- **Execution Engine**: `tsx` for running TypeScript directly.
- **Capabilities**: Custom API endpoints for managing users, balance requests, AI functionality (Google Generative AI), and serving OTA zip files.

## Local Development Setup

To run the project locally, you will need Node.js and MongoDB.

### 1. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file inside the `server/` directory and add your MongoDB specific URI and port settings (ensure `PORT=3000` is defined or omit it to run on default 3000). 
To start the backend server:

```bash
npm run dev
```
*(The server runs on http://localhost:3000)*

### 2. Frontend Setup

```bash
cd client
npm install
```

Create a `.env` file inside the `client/` directory and configure your Firebase keys and API endpoint:
```env
VITE_API_URL=http://localhost:3000
VITE_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
VITE_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
VITE_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

Start the Vite development server:

```bash
npm run dev
```

*(The client typically runs on http://localhost:5173 - fallback to 5175 if the port is busy)*

## Compiling for Mobile (Android)

FairPay utilizes Capacitor to compile the React build down into native mobile apps. 
From the `client/` directory, after confirming Android Studio and SDKs are installed:
```bash
npm run build:android
```
Then start Android Studio to generate the APK:
```bash
npx cap open android
```

## OTA Updates (Capgo)

To build and deploy a new OTA release locally for testing:
From the `client/` directory:
```bash
npm run deploy:ota
```
This script handles building the client, zipping the dist folder, calculating a fast hash, and moving the update file to the `server/updates/` folder. The app detects these versions automatically upon load and applies them seamlessly.

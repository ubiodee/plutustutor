# Backend Documentation - Personalized Web3 Learning Platform

## Overview
This document provides comprehensive documentation for the backend implementation of the Personalized Web3 Learning Platform, including Firebase integration, authentication, and data storage.

## Table of Contents
1. [Architecture](#architecture)
2. [Firebase Setup](#firebase-setup)
3. [Authentication](#authentication)
4. [Database Schema](#database-schema)
5. [API Integration](#api-integration)
6. [Data Flow](#data-flow)
7. [Environment Variables](#environment-variables)
8. [Security Rules](#security-rules)
9. [Firestore Indexes](#firestore-indexes)
10. [Deployment](#deployment)

---

## Architecture

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend Services**: Firebase (Authentication + Firestore)
- **External APIs**: Plutus AI API (Hugging Face Space)
- **Styling**: Tailwind CSS

### System Components
```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐  ┌──▼────────┐
│Firebase│  │Plutus AI │
│Auth +  │  │API       │
│Firestore│  │          │
└────────┘  └──────────┘
```

---

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name and follow setup wizard
4. Enable Google Analytics (optional)

### 2. Enable Authentication
1. Navigate to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider
3. Enable **Google** provider
   - Add authorized domains
   - Configure OAuth consent screen

### 3. Create Firestore Database
1. Navigate to **Firestore Database**
2. Click "Create database"
3. Start in **Production mode** (we'll add security rules later)
4. Choose a location closest to your users

### 4. Get Configuration Values
1. Go to **Project Settings** > **General**
2. Scroll to "Your apps" section
3. Click the **Web** icon (`</>`)
4. Register app with a nickname
5. Copy the configuration object

### 5. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## Authentication

### Email/Password Authentication

#### Sign Up
```typescript
import { signUpWithEmail } from "@/lib/firebase/auth"

await signUpWithEmail(
  email: string,
  password: string,
  name: string,
  personalityType: string,
  level: string
)
```

**Flow:**
1. User enters email, password, name, personality type, and level
2. Firebase creates user account
3. User profile is saved to Firestore `users` collection
4. User is redirected to learning page

#### Sign In
```typescript
import { signInWithEmail } from "@/lib/firebase/auth"

await signInWithEmail(email: string, password: string)
```

**Flow:**
1. User enters email and password
2. Firebase authenticates user
3. Last login timestamp is updated in Firestore
4. User is redirected to learning page

### Google OAuth Authentication

#### Sign In with Google
```typescript
import { signInWithGoogle } from "@/lib/firebase/auth"

await signInWithGoogle()
```

**Flow:**
1. User clicks "Sign in with Google"
2. Google OAuth popup appears
3. User selects Google account
4. Firebase creates/updates user account
5. User profile is saved/updated in Firestore
6. User is redirected to learning page

**First-time Google users:**
- Default personality: "Normal"
- Default level: "Beginner"
- User can update these later

### Password Reset
```typescript
import { resetPassword } from "@/lib/firebase/auth"

await resetPassword(email: string)
```

---

## Database Schema

See `FIRESTORE_SCHEMA.md` for detailed schema documentation.

### Collections Overview

1. **`users`** - User profiles and authentication data
2. **`modules`** - Module completion progress
3. **`topics`** - Generated content, recommendations, summaries, and feedback

### Key Relationships
- Each user has multiple modules (via `userId` field)
- Each user has multiple topics (via `userId` field)
- Topics belong to modules (via `moduleId` field)

---

## API Integration

### External API: Plutus AI
Base URL: `https://remostart-advanced-plutus-ai.hf.space`

#### Endpoints Used

1. **`POST /generate`** - Generate personalized content
   - Called when user clicks "Next" on a topic
   - Response is saved to Firestore `topics` collection

2. **`POST /recommend`** - Get learning recommendations
   - Automatically called after content generation
   - Response is saved to Firestore `topics` collection

3. **`POST /summary`** - Get learning summary
   - Automatically called after content generation
   - Response is saved to Firestore `topics` collection

### Data Flow
```
User clicks "Next" 
  → Generate API called
  → Content saved to Firestore
  → Recommendations API called (auto)
  → Recommendations saved to Firestore
  → Summary API called (auto)
  → Summary saved to Firestore
```

---

## Data Flow

### User Registration Flow
```
1. User fills signup form
2. Firebase Auth creates account
3. User profile saved to Firestore (users collection)
4. User redirected to learning page
```

### Content Generation Flow
```
1. User selects module
2. User clicks "Next" on topic
3. Generate API called
4. Content displayed to user
5. Recommendations API called (background)
6. Summary API called (background)
7. All data saved to Firestore
8. User can navigate between topics
9. Data loads from Firestore if available
```

### Module Completion Flow
```
1. User completes all topics in module
2. Confetti animation plays
3. Module completion saved to Firestore
4. User redirected to modules tab
```

### Feedback Flow
```
1. User clicks like/dislike on topic
2. Feedback saved to Firestore immediately
3. UI updates to show feedback state
```

---

## Environment Variables

### Required Variables
All variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `my-project-123` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | `1:123:web:abc` |

### Setup Instructions
1. Copy `.env.example` to `.env.local`
2. Fill in your Firebase configuration values
3. Restart the development server

---

## Security Rules

### Firestore Security Rules

**⚠️ CRITICAL:** You must configure these security rules in Firebase Console for the application to work properly. Without these rules, you will get "Missing or insufficient permissions" errors.

#### Quick Setup (Firebase Console)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** > **Rules** tab
4. Copy and paste the rules below
5. Click **Publish**

#### Alternative: Using Firebase CLI

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init firestore` (select existing project)
4. The `firestore.rules` file in the project root contains the rules
5. Deploy: `firebase deploy --only firestore:rules`

#### Security Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection - users can read/write their own data
    // Allow creation (when resource == null) and updates (when resource exists)
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if isOwner(userId);
    }
    
    // Modules collection - users can only access their own modules
    match /modules/{moduleId} {
      allow read, write: if isAuthenticated() && 
        (resource == null || resource.data.userId == request.auth.uid) &&
        (request.resource == null || request.resource.data.userId == request.auth.uid);
    }
    
    // Topics collection - users can only access their own topics
    match /topics/{topicId} {
      allow read, write: if isAuthenticated() && 
        (resource == null || resource.data.userId == request.auth.uid) &&
        (request.resource == null || request.resource.data.userId == request.auth.uid);
    }
  }
}
```

**Important:** These rules must be deployed to Firebase Console. See deployment instructions below.

### Authentication Security
- Email verification can be enabled in Firebase Console
- Password requirements can be configured
- Rate limiting is handled by Firebase
- OAuth redirect URIs must be whitelisted

---

## Firestore Indexes

### Required Composite Indexes

The application requires composite indexes for efficient queries. These are defined in `firestore.indexes.json`.

**Required Indexes:**

1. **Topics Collection Index**
   - Collection: `topics`
   - Fields: `userId` (ASC), `moduleId` (ASC), `topicIndex` (ASC)
   - Used by: `getAllModuleTopics()` function
   - Purpose: Load all topics for a specific module, ordered by index

2. **Modules Collection Index**
   - Collection: `modules`
   - Fields: `userId` (ASC), `createdAt` (DESC)
   - Used by: `getAllUserModules()` function
   - Purpose: Get all modules for a user, ordered by creation date

### Setting Up Indexes

#### Option 1: Quick Setup via Error Link (Recommended for First Time)

When you first run a query that needs an index, Firebase will show an error with a direct link:
1. Click the link in the error message
2. Firebase Console will open with the index pre-configured
3. Click "Create Index"
4. Wait for the index to build (usually 2-5 minutes)

#### Option 2: Deploy via Firebase CLI (Recommended for Production)

1. **Initialize Firestore** (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your existing Firebase project
   - Use existing `firestore.indexes.json` file

2. **Deploy Indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. **Check Index Status**:
   - Go to Firebase Console > Firestore Database > Indexes tab
   - Wait for indexes to show "Enabled" status (green checkmark)

#### Option 3: Manual Creation in Firebase Console

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **Create Index**
5. Configure each index:
   - **Collection ID**: `topics` or `modules`
   - **Fields**: Add fields in order (userId, moduleId, topicIndex) or (userId, createdAt)
   - **Query scope**: Collection
   - Click **Create**

### Index Status

- **Building**: Index is being created (wait 2-5 minutes)
- **Enabled**: Index is ready to use ✅
- **Error**: Check the error message and fix the configuration

**Note:** Queries will fail until indexes are enabled. The application will show an error with a link to create the index.

---

## Deployment

### Vercel Deployment (Recommended)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Add Firebase integration"
   git push origin main
   ```

2. **Import project to Vercel**
   - Go to [Vercel](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all `NEXT_PUBLIC_FIREBASE_*` variables
   - Redeploy the project

4. **Update Firebase Authorized Domains**
   - Go to Firebase Console > Authentication > Settings
   - Add your Vercel domain to authorized domains

### Firebase Hosting (Alternative)

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase**
   ```bash
   firebase init
   ```

4. **Build and Deploy**
   ```bash
   npm run build
   firebase deploy
   ```

---

## File Structure

```
lib/
  firebase/
    config.ts          # Firebase initialization
    auth.ts            # Authentication functions
    firestore.ts       # Firestore database functions
  api.ts               # External API integration

app/
  signup/
    page.tsx           # Signup page with Firebase auth
  learning/
    page.tsx           # Learning page with Firestore integration

FIRESTORE_SCHEMA.md    # Detailed database schema
BACKEND_README.md      # This file
.env.example           # Environment variables template
```

---

## Testing

### Local Testing
1. Start development server:
   ```bash
   npm run dev
   ```

2. Test authentication:
   - Sign up with email/password
   - Sign in with Google
   - Test password reset

3. Test data persistence:
   - Generate content for a topic
   - Refresh the page
   - Verify data loads from Firestore

### Firebase Emulator (Optional)
For local testing without affecting production:

```bash
npm install -g firebase-tools
firebase init emulators
firebase emulators:start
```

---

## Troubleshooting

### Common Issues

1. **"Firebase: Error (auth/invalid-api-key)"**
   - Check that environment variables are set correctly
   - Ensure variables are prefixed with `NEXT_PUBLIC_`
   - Restart development server after adding variables

2. **"Permission denied" errors**
   - Check Firestore security rules
   - Verify rules are published (not just saved)
   - Ensure user is authenticated

3. **"The query requires an index" errors**
   - Click the link in the error message to create the index
   - Or deploy indexes: `firebase deploy --only firestore:indexes`
   - Wait for indexes to build (check status in Firebase Console)
   - See [Firestore Indexes](#firestore-indexes) section above
   - Check that user owns the document

3. **Data not persisting**
   - Check browser console for errors
   - Verify Firestore rules allow writes
   - Check network tab for failed requests

4. **Google OAuth not working**
   - Verify OAuth consent screen is configured
   - Check authorized domains in Firebase Console
   - Ensure redirect URI is whitelisted

---

## Best Practices

1. **Error Handling**
   - Always wrap Firebase calls in try-catch blocks
   - Provide user-friendly error messages
   - Log errors for debugging

2. **Data Validation**
   - Validate data before saving to Firestore
   - Use TypeScript types for type safety
   - Sanitize user inputs

3. **Performance**
   - Use Firestore indexes for complex queries
   - Implement pagination for large datasets
   - Cache frequently accessed data

4. **Security**
   - Never expose Firebase admin credentials
   - Use security rules to protect data
   - Validate user permissions on the client

---

## Support

For issues or questions:
1. Check Firebase documentation: https://firebase.google.com/docs
2. Review Firestore schema: `FIRESTORE_SCHEMA.md`
3. Check API documentation: `API_ENDPOINTS_DOCUMENTATION.md`

---

## License

This project is part of the Personalized Web3 Learning Platform.


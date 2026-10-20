# Firestore Security Rules Setup Guide

## Quick Setup Instructions

### Option 1: Firebase Console (Recommended for Quick Setup)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Select your project

2. **Navigate to Firestore Rules**
   - Click on **Firestore Database** in the left sidebar
   - Click on the **Rules** tab

3. **Copy and Paste Rules**
   - Copy the rules from `firestore.rules` file in this project
   - Or copy from the BACKEND_README.md file
   - Paste into the rules editor

4. **Publish Rules**
   - Click **Publish** button
   - Wait for confirmation

### Option 2: Firebase CLI (Recommended for Production)

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firestore**
   ```bash
   firebase init firestore
   ```
   - Select your existing Firebase project
   - Use existing `firestore.rules` file (already in project)
   - Don't overwrite existing rules if prompted

4. **Deploy Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

## Security Rules Content

The rules are located in `firestore.rules` file. Here's what they do:

- **Users Collection**: Users can only read/write their own profile (document ID must match their UID)
- **Modules Collection**: Users can only access modules where `userId` matches their UID
- **Topics Collection**: Users can only access topics where `userId` matches their UID

## Firestore Indexes Setup

### Required Composite Indexes

The application requires composite indexes for efficient queries. These are defined in `firestore.indexes.json`.

**Required Indexes:**

1. **Topics Collection Index**
   - Collection: `topics`
   - Fields: `userId` (ASC), `moduleId` (ASC), `topicIndex` (ASC)
   - Used by: `getAllModuleTopics()` function

2. **Modules Collection Index**
   - Collection: `modules`
   - Fields: `userId` (ASC), `createdAt` (DESC)
   - Used by: `getAllUserModules()` function

### Option 1: Create Index via Error Link (Quick)

When you see an index error, Firebase provides a direct link to create it:
1. Click the link in the error message
2. Firebase Console will open with the index pre-configured
3. Click "Create Index"
4. Wait for the index to build (usually takes a few minutes)

### Option 2: Deploy Indexes via Firebase CLI (Recommended)

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
   - Wait for indexes to show "Enabled" status

### Option 3: Manual Creation in Firebase Console

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **Create Index**
5. Configure each index as shown above
6. Click **Create**

## Troubleshooting

### Error: "The query requires an index"

**Cause**: Firestore needs a composite index for queries with multiple `where` clauses and `orderBy`.

**Solution**:
1. Click the link in the error message (fastest method)
2. Or deploy indexes using Firebase CLI: `firebase deploy --only firestore:indexes`
3. Wait for indexes to build (check status in Firebase Console)

### Error: "Missing or insufficient permissions"

**Cause**: Firestore security rules are not configured or are too restrictive.

**Solution**:
1. **Deploy the rules**: The rules must be published in Firebase Console (not just saved)
   - Go to Firebase Console > Firestore Database > Rules
   - Copy the rules from `firestore.rules` file
   - Paste and click **Publish**
2. Verify the rules match the content in `firestore.rules`
3. Ensure the user is authenticated (`request.auth != null`)
4. For queries on `topics` collection:
   - The query must filter by `userId` (which it does in `getAllModuleTopics`)
   - The rules allow `list` operations for authenticated users
   - Make sure the `allow list` permission is present in the rules
5. If using `orderBy`, you may need to create a composite index in Firebase Console
   - Firebase will show a link to create the index when needed

### Error: "Failed to get document because the client is offline"

**Cause**: Network connectivity issue or Firestore sync delay.

**Solution**:
- The application now handles this gracefully with retry logic
- Check your internet connection
- Wait a few seconds and try again

## Testing Rules

After deploying rules, test them:

1. **Test User Profile Access**
   - Sign up with a new account
   - Try to read your own profile (should work)
   - Try to read another user's profile (should fail)

2. **Test Module Access**
   - Create a module for your user
   - Try to read it (should work)
   - Try to read another user's module (should fail)

## Production Checklist

- [ ] Rules are deployed to Firebase Console
- [ ] Rules match the content in `firestore.rules`
- [ ] No open/allow-all rules in production
- [ ] Rules are tested with authenticated users
- [ ] Rules prevent unauthorized access

## Support

If you continue to have permission errors:
1. Check Firebase Console > Firestore Database > Rules
2. Verify rules are published (not just saved)
3. Check browser console for specific error messages
4. Review Firebase documentation: https://firebase.google.com/docs/firestore/security/get-started


# Firestore Database Schema

## Overview
This document describes the NoSQL database schema for the Personalized Web3 Learning Platform using Firebase Firestore.

## Collections Structure

### 1. `users` Collection
Stores user profile information and authentication data.

**Document ID**: User's UID (from Firebase Auth)

```typescript
{
  uid: string,                    // Firebase Auth UID
  email: string,                  // User email
  name: string,                   // User's full name
  personalityType: string,        // "Dyslexic" | "Autistic" | "Dyscalculic" | "Expressive" | "Introverted" | "Nerd" | "Normal"
  level: string,                  // "Beginner" | "Intermediary" | "Expert"
  createdAt: Timestamp,           // Account creation timestamp
  lastLoginAt: Timestamp,         // Last login timestamp
  provider: string,               // "email" | "google.com"
  photoURL?: string,              // Profile photo URL (for Google OAuth)
}
```

**Indexes Required**: None (using document ID as primary key)

---

### 2. `modules` Collection
Stores module completion progress for each user.

**Document ID**: Auto-generated

**Subcollection**: None

```typescript
{
  userId: string,                 // Reference to users/{uid}
  moduleId: string,               // "module1" | "module2" | "module3"
  moduleName: string,             // "Module 1: Introduction to Plutus..."
  completedAt: Timestamp,          // When module was completed
  topicsCompleted: number,        // Number of topics completed
  totalTopics: number,            // Total topics in module
  createdAt: Timestamp,           // When module was started
  updatedAt: Timestamp,           // Last update timestamp
}
```

**Indexes Required**:
- `userId` (ascending)
- `moduleId` (ascending)
- `completedAt` (descending)

---

### 3. `topics` Collection
Stores generated content, recommendations, summaries, and feedback for each topic.

**Document ID**: Auto-generated

**Subcollection**: None

```typescript
{
  userId: string,                 // Reference to users/{uid}
  moduleId: string,               // "module1" | "module2" | "module3"
  topicName: string,              // "What is Plutus?"
  topicIndex: number,             // Position in module (0, 1, 2...)
  
  // Generated Content
  generatedContent: {
    text: string,                 // Full markdown text from /generate API
    topic: string,                // Topic from API response
    query: string,                // Query used for generation
    generatedAt: Timestamp,       // When content was generated
  },
  
  // Recommendations
  recommendations: {
    query: string,                // Query used
    results: Array<{
      topic: string,
      type: "doc" | "video",
      url: string,
    }>,
    fetchedAt: Timestamp,         // When recommendations were fetched
  },
  
  // Summary
  summary: {
    topic: string,                // Topic from API
    summary: string,               // Summary text from /summary API
    resources: Array<{
      type: "doc" | "video",
      url: string,
    }>,
    fetchedAt: Timestamp,         // When summary was fetched
  },
  
  // User Feedback
  feedback: {
    type: "like" | "dislike" | null,
    updatedAt: Timestamp,
  },
  
  // Metadata
  createdAt: Timestamp,           // When topic was first accessed
  updatedAt: Timestamp,           // Last update timestamp
}
```

**Indexes Required**:
- `userId` (ascending)
- `moduleId` (ascending)
- `topicName` (ascending)
- `createdAt` (descending)

**Composite Indexes**:
- `userId` + `moduleId` (ascending)
- `userId` + `moduleId` + `topicIndex` (ascending)

---

## Data Relationships

```
users/{uid}
  ├── modules/{moduleId}          (via userId field)
  └── topics/{topicId}            (via userId field)
```

## Query Patterns

### 1. Get User Profile
```typescript
const userDoc = await getDoc(doc(db, "users", userId))
```

### 2. Get All Modules for User
```typescript
const modulesQuery = query(
  collection(db, "modules"),
  where("userId", "==", userId),
  orderBy("createdAt", "desc")
)
```

### 3. Get All Topics for User in Module
```typescript
const topicsQuery = query(
  collection(db, "topics"),
  where("userId", "==", userId),
  where("moduleId", "==", moduleId),
  orderBy("topicIndex", "asc")
)
```

### 4. Get Specific Topic
```typescript
const topicQuery = query(
  collection(db, "topics"),
  where("userId", "==", userId),
  where("moduleId", "==", moduleId),
  where("topicName", "==", topicName),
  limit(1)
)
```

### 5. Get User Feedback Statistics
```typescript
const feedbackQuery = query(
  collection(db, "topics"),
  where("userId", "==", userId),
  where("feedback.type", "==", "like")
)
```

## Security Rules (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Modules - users can only access their own modules
    match /modules/{moduleId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Topics - users can only access their own topics
    match /topics/{topicId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## Data Migration Notes

1. **User Creation**: When a user signs up, create a document in `users` collection
2. **Topic Generation**: When content is generated, create/update document in `topics` collection
3. **Feedback Updates**: Use `updateDoc` to update only the `feedback` field
4. **Progress Tracking**: Update `modules` collection when a topic is completed

## Best Practices

1. **Batch Writes**: Use batch writes when creating multiple related documents
2. **Field Updates**: Use `updateDoc` instead of `setDoc` when updating specific fields
3. **Timestamp Fields**: Always use Firestore `Timestamp` for date fields
4. **Indexes**: Create composite indexes for common query patterns
5. **Data Validation**: Validate data on client side before writing to Firestore


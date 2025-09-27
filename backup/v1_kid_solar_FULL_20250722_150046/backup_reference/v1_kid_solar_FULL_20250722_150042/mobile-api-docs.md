# The Current-See Mobile API Documentation

## Overview

This document provides information about the Mobile API endpoints that allow a cross-platform mobile application to access the Current-See database.

## Base URL

All API endpoints are accessible under the `/mobile` path on the Current-See server.

## Authentication

Most endpoints require authentication using PostgreSQL database credentials. This ensures the mobile app has secure access to the database. Include the credentials in requests using one of these methods:

1. As HTTP headers:
   ```
   x-pguser: [database username]
   x-pgpassword: [database password]
   x-pghost: (optional) [database host]
   x-pgdatabase: (optional) [database name]
   ```

2. As query parameters:
   ```
   ?pguser=[database username]&pgpassword=[database password]&pghost=[database host]&pgdatabase=[database name]
   ```

## Endpoints

### 1. Status Check

**Endpoint:** `/mobile/status`
**Method:** GET
**Authentication:** Not required
**Description:** Checks if the API is operational. Can be used by the mobile app to verify connectivity.

**Response Example:**
```json
{
  "success": true,
  "message": "Mobile API is running",
  "timestamp": "2025-04-22T10:30:45.123Z"
}
```

### 2. Get All Members

**Endpoint:** `/mobile/members`
**Method:** GET
**Authentication:** Required
**Description:** Returns a list of all members in the system.

**Response Example:**
```json
{
  "success": true,
  "count": 15,
  "members": [
    {
      "id": 1,
      "username": "terry.franklin",
      "name": "Terry D. Franklin",
      "joined_date": "2025-04-09",
      "total_solar": "5.0000",
      "last_distribution_date": "2025-04-22",
      "is_anonymous": false,
      "email": "terry@example.com"
    },
    // ... more members
  ]
}
```

### 3. Get Specific Member

**Endpoint:** `/mobile/member/:identifier`
**Method:** GET
**Authentication:** Required
**Description:** Returns data for a specific member. The identifier can be either a member ID (number) or username (string).

**Response Example:**
```json
{
  "success": true,
  "member": {
    "id": 14,
    "username": "alex",
    "name": "Alex",
    "joined_date": "2025-04-10",
    "total_solar": "13.0000",
    "last_distribution_date": "2025-04-22",
    "is_anonymous": false,
    "email": "alex@example.com"
  }
}
```

### 4. Get Member's Distribution History

**Endpoint:** `/mobile/member/:id/distributions`
**Method:** GET
**Authentication:** Required
**Description:** Returns the distribution history for a specific member.

**Response Example:**
```json
{
  "success": true,
  "count": 13,
  "distributions": [
    {
      "id": 142,
      "member_id": 14,
      "distribution_date": "2025-04-22",
      "solar_amount": "1.0000",
      "dollar_value": "136000.0000"
    },
    // ... more distributions
  ]
}
```

### 5. Mobile Authentication

**Endpoint:** `/mobile/auth`
**Method:** POST
**Authentication:** Required (database credentials)
**Description:** Authenticates a user with their email and returns a token for further API requests.

**Request Example:**
```json
{
  "email": "user@example.com",
  "authToken": "optional-additional-token"
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": 14,
    "username": "user",
    "name": "User Name"
  },
  "token": "base64-encoded-token"
}
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error type or message",
  "message": "Detailed error description"
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (invalid or missing database credentials)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error

## Implementation Example

Here's a simple example of how to call the API from a mobile app using database credentials:

```javascript
// Example using fetch API in JavaScript
async function getMembersList() {
  const response = await fetch('https://your-current-see-domain.com/mobile/members', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-pguser': process.env.PGUSER,
      'x-pgpassword': process.env.PGPASSWORD,
      'x-pghost': process.env.PGHOST,
      'x-pgdatabase': process.env.PGDATABASE
    }
  });
  
  const data = await response.json();
  return data;
}
```

### Authentication Endpoint Example

```javascript
// Example of authenticating a user
async function authenticateUser(email) {
  const response = await fetch('https://your-current-see-domain.com/mobile/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pguser': process.env.PGUSER,
      'x-pgpassword': process.env.PGPASSWORD
    },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  if (data.success) {
    // Store the token for future authenticated requests
    localStorage.setItem('userToken', data.token);
  }
  return data;
}
```
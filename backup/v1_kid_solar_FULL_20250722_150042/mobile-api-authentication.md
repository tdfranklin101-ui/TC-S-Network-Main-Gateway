# Mobile API Authentication Guide

## Overview

The TC-S mobile API uses PostgreSQL database credentials for authentication. This approach ensures that the mobile app has access to the same authenticated data as the web server.

## Authentication Method

To authenticate your requests to the mobile API, include the following database credentials in your request:

- **Headers**: Include database credentials as HTTP headers
  ```
  x-pguser: [database username]
  x-pgpassword: [database password]
  x-pghost: (optional) [database host]
  x-pgdatabase: (optional) [database name]
  ```

- **Query Parameters**: Alternatively, you can include database credentials as query parameters
  ```
  ?pguser=[database username]&pgpassword=[database password]&pghost=[database host]&pgdatabase=[database name]
  ```

## Example Request (JavaScript)

```javascript
// Using fetch with database credential headers
const fetchMemberData = async (memberId) => {
  try {
    const response = await fetch(`https://api.thecurrentsee.org/mobile/member/${memberId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-pguser': process.env.PGUSER,
        'x-pgpassword': process.env.PGPASSWORD,
        'x-pghost': process.env.PGHOST,
        'x-pgdatabase': process.env.PGDATABASE
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching member data:', error);
    throw error;
  }
};
```

## Security Considerations

- Always use HTTPS for all API requests
- Store database credentials securely in your mobile app
- Consider implementing additional security measures like request signing
- Do not expose database credentials in client-side code

## Available Endpoints

- `GET /mobile/status` - Check API status (no authentication required)
- `GET /mobile/members` - Get list of all members
- `GET /mobile/member/:identifier` - Get a specific member by ID or username
- `GET /mobile/member/:id/distributions` - Get distribution history for a member
- `POST /mobile/auth` - Authenticate a user and receive a token for future requests

## Need Help?

If you encounter any issues with the API authentication, please contact the TC-S development team for assistance.
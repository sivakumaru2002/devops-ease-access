# User Registration & Approval System

## Overview
New users can now self-register for dashboard access. All new accounts require admin approval before they can log in and use the system.

## Features

### 📝 Registration Page
- **Accessible from**: Login screen via "✨ Sign Up" button
- **Required Fields**:
  - Email Address (must be valid email format)
  - Username (minimum 3 characters)
  - Password (minimum 4 characters)
  - Confirm Password (must match password)

### 🔀 Login/Register Toggle
- **Seamless Toggle**: Switch between login and register forms
- **Preserved State**: Form data is maintained when toggling (except passwords)
- **Visual Feedback**: Different headings and button styles

### ⏳ Approval Workflow
1. **User Registers** → Account created with `approved: false`
2. **Admin Reviews** → Sees pending user in Admin Controls
3. **Admin Approves** → Sets `approved: true`
4. **User Can Login** → Access granted to dashboard

## User Flow

### New User Registration
```
1. Visit application
2. Click "✨ Sign Up" button
3. Fill out registration form:
   - Email: your.email@company.com
   - Username: yourname
   - Password: ****
   - Confirm Password: ****
4. Click "✨ Register"
5. See success message
6. Wait for admin approval
7. Try logging in once approved
```

### Admin Approval Process
```
1. Login as admin
2. Navigate to Dashboard Portal
3. Scroll to "👥 Pending User Approvals"
4. Click "🔄 Refresh Pending" to see new users
5. Review user email and username
6. Click "✅ Approve" for each user
7. User can now login
```

## UI Components

### Login Form
```tsx
🔐 Dashboard Login                    [✨ Sign Up]

Email or Username
[admin@gmail.com                           ]

Password
[****                                       ]

[🚀 Login]
👤 New user? Click "Sign Up" to create an account
```

### Registration Form
```tsx
📝 Create Account                     [← Back to Login]

Create your account below. Your account will be 
pending until an admin approves it.

Email Address
[your.email@company.com                    ]

Username
[Choose a username (min 3 characters)      ]

Password
[Create a password (min 4 characters)      ]

Confirm Password
[Re-enter your password                    ]

[✨ Register]

ℹ️ After registration, your account will be pending approval.
👑 An admin will review and approve your account before you can 
access the dashboard.
```

## Validation

### Client-Side Validation
- ✅ Email format validation (HTML5)
- ✅ Username minimum length (3 characters)
- ✅ Password minimum length (4 characters)
- ✅ Password match verification
- ✅ Required field validation

### Server-Side Validation
- ✅ Email uniqueness check
- ✅ Username uniqueness check
- ✅ Password hashing (PBKDF2-SHA256)
- ✅ Input sanitization

## Status Messages

### Registration Success
```
✅ Registration successful! Your account is pending admin approval. 
You can try logging in once approved.
```

### Registration Errors
```
❌ Passwords do not match.
❌ Password must be at least 4 characters.
❌ Registration failed. Email or username may already exist.
❌ Network error during registration.
```

### Login Errors (Pending Users)
```
⏳ Your account is waiting for admin approval.
```

## Technical Implementation

### State Management
```tsx
const [showRegister, setShowRegister] = useState(false);
const [registerEmail, setRegisterEmail] = useState('');
const [registerUsername, setRegisterUsername] = useState('');
const [registerPassword, setRegisterPassword] = useState('');
const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
```

### Registration Handler
```tsx
const registerDashboardUser = async (event: FormEvent) => {
  event.preventDefault();
  
  // Validate passwords match
  if (registerPassword !== registerConfirmPassword) {
    setStatus('❌ Passwords do not match.');
    return;
  }
  
  // Validate password length
  if (registerPassword.length < 4) {
    setStatus('❌ Password must be at least 4 characters.');
    return;
  }
  
  setIsBusy(true);
  try {
    const response = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: registerEmail,
        username: registerUsername,
        password: registerPassword,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
      setStatus(`❌ ${errorData.detail || 'Registration failed. Email or username may already exist.'}`);
      return;
    }
    
    // Success - clear form and switch to login
    setStatus('✅ Registration successful! Your account is pending admin approval. You can try logging in once approved.');
    setRegisterEmail('');
    setRegisterUsername('');
    setRegisterPassword('');
    setRegisterConfirmPassword('');
    setShowRegister(false);
  } catch {
    setStatus('❌ Network error during registration.');
  } finally {
    setIsBusy(false);
  }
};
```

### Backend API

#### Endpoint: POST /api/auth/register
```python
@app.post("/api/auth/register")
async def register_user(payload: RegisterRequest) -> dict:
    # Create user with approved=False
    # Hash password using PBKDF2-SHA256
    # Return success message
```

#### Request Body
```json
{
  "email": "user@company.com",
  "username": "newuser",
  "password": "securepass123"
}
```

#### Response (Success)
```json
{
  "message": "User registered successfully. Pending admin approval."
}
```

#### Response (Error - Duplicate Email)
```json
{
  "detail": "Email already exists"
}
```

## Security Features

### Password Security
- **Hashing Algorithm**: PBKDF2-SHA256
- **Iterations**: 120,000
- **Salt**: 16 bytes random
- **Storage**: Never store plain text passwords

### Input Validation
```python
class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)
```

### Authentication Flow
```
Registration → Password Hashed → Stored with approved=false
↓
Admin Approval → approved=true
↓
Login → Password Verified → Token Issued → Access Granted
```

## Admin Controls

### Pending Users List
```tsx
👥 Pending User Approvals              [🔄 Refresh Pending]

┌─────────────────────────────────────────────────────┐
│ jane.doe                                             │
│ jane.doe@company.com                                 │
│ [✅ Approve]                                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ john.smith                                           │
│ john.smith@company.com                               │
│ [✅ Approve]                                         │
└─────────────────────────────────────────────────────┘
```

### Approval Action
- **Button Click**: Calls `/api/admin/users/{userId}/approve`
- **Effect**: Sets `approved: true` in database
- **Feedback**: "✅ User approved." status message
- **UI Update**: Refreshes pending users list

## UX Design

### Visual Hierarchy
- **Toggle Button**: Top-right, secondary style
- **Form Title**: Large, icon-enhanced headings
- **Info Boxes**: Color-coded backgrounds
  - Login: Blue info box
  - Register: Green info box
- **Submit Buttons**: Different styles
  - Login: Primary gradient
  - Register: Success gradient

### Color Coding
```css
/* Login Info Box */
background: rgba(99, 142, 255, 0.1);
border: 1px solid rgba(99, 142, 255, 0.2);

/* Register Info Box */
background: rgba(16, 185, 129, 0.1);
border: 1px solid rgba(16, 185, 129, 0.2);
```

### Icons & Emojis
- 🔐 Login heading
- 📝 Register heading
- ✨ Sign Up button
- 🚀 Login submit
- ⏳ Loading states
- ✅ Success messages
- ❌ Error messages
- 💡 Info/Tips
- 👤 User references
- 👑 Admin references

## Error Handling

### Network Errors
```tsx
try {
  // API call
} catch {
  setStatus('❌ Network error during registration.');
}
```

### Validation Errors
```tsx
// Client-side validation
if (registerPassword !== registerConfirmPassword) {
  setStatus('❌ Passwords do not match.');
  return;
}

// Server-side validation
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
  setStatus(`❌ ${errorData.detail || 'Registration failed. Email or username may already exist.'}`);
  return;
}
```

### Empty States
```tsx
{pendingUsers.length === 0 ? (
  <p className="muted">✅ No pending user approvals.</p>
) : null}
```

## User Experience Flow

### Happy Path
```
1. User clicks "✨ Sign Up"
   ↓
2. Form switches to registration
   ↓
3. User fills email, username, password, confirm password
   ↓
4. User clicks "✨ Register"
   ↓
5. Loading state: "⏳ Creating account..."
   ↓
6. Success: Form clears, switches to login
   ↓
7. Message: "✅ Registration successful! Your account is pending admin approval..."
   ↓
8. Admin logs in, sees pending user
   ↓
9. Admin clicks "✅ Approve"
   ↓
10. User can now login successfully
```

### Error Path
```
1. User fills registration form
   ↓
2. Passwords don't match
   ↓
3. Error: "❌ Passwords do not match."
   ↓
4. User fixes passwords
   ↓
5. Email already exists
   ↓
6. Error: "❌ Registration failed. Email or username may already exist."
   ↓
7. User changes email
   ↓
8. Success: Registration completes
```

## Accessibility

### Form Controls
- **Labels**: Clear, descriptive labels for all inputs
- **Placeholders**: Helpful examples in placeholders
- **AutoComplete**: Proper autocomplete attributes
  - `username` for username/email fields
  - `email` for email field
  - `current-password` for login password
  - `new-password` for registration passwords

### Keyboard Navigation
- Tab order follows logical form flow
- Enter key submits forms
- Focus states clearly visible

### Screen Readers
- Semantic HTML forms
- Proper label associations
- Status messages announced via aria-live

## Testing Scenarios

### Manual Testing
1. **Register New User**
   - Fill all fields correctly
   - Verify success message
   - Check user appears in pending list

2. **Password Mismatch**
   - Enter different passwords
   - Verify error message
   - Correct and retry

3. **Duplicate Email**
   - Register with existing email
   - Verify error message
   - Use different email

4. **Admin Approval**
   - Login as admin
   - View pending users
   - Approve user
   - Verify user can login

5. **Pending User Login**
   - Try login before approval
   - Verify pending message
   - Cannot access dashboard

## Future Enhancements

Potential improvements:
1. **Email Verification**: Send verification email before account creation
2. **Password Strength Meter**: Visual indicator of password strength
3. **Username Availability Check**: Real-time check while typing
4. **Bulk Approval**: Approve multiple users at once
5. **Rejection Workflow**: Option to reject users with reason
6. **User Notifications**: Email notification upon approval
7. **Registration Analytics**: Track registration trends
8. **Custom User Roles**: More granular permissions beyond admin/user

## Summary

The registration system provides:
- ✅ **Self-Service Registration**: Users can create accounts independently
- ✅ **Admin Control**: All accounts require admin approval
- ✅ **Secure**: Password hashing, validation, and error handling
- ✅ **User-Friendly**: Clear forms, helpful messages, smooth transitions
- ✅ **Modern UI**: Matches the glassmorphism theme
- ✅ **Accessible**: Proper labels, autocomplete, keyboard navigation
- ✅ **Robust**: Client and server-side validation

The workflow ensures admins maintain control while providing a smooth experience for new users! 🎉

# Workforce By Mindque

Workforce By Mindque is a browser-based employee attendance and HR management app built with HTML, CSS, JavaScript, and Firebase.

## Features

- Employee login with Firebase Authentication
- Role-based redirect for admin and employee users
- Employee punch in / punch out with camera selfie and location verification
- Live work timer with break pause and resume
- Break tracking
- Auto missed punch-out handling with grace period
- Employee attendance history for the last 7 or 30 days
- Employee profile system with editable HR details
- Leave management with employee requests and admin approval/rejection
- Holiday calendar
- Employee notifications for all or specific employees
- Admin dashboard with employees, attendance, reports, and payroll
- Weekly and monthly attendance timesheet views
- Salary calculation by hours or days
- Excel export for attendance, timesheets, and reports

## Files

- `index.html` - Login screen
- `dashboard.html` - Employee dashboard
- `admin.html` - Admin dashboard
- `css/` - Page stylesheets
- `js/` - Page JavaScript modules
- `assets/` - Workforce By Mindque logo assets

## Firebase Collections

The app uses these Firestore collections:

- `employees`
- `attendance`
- `breaks`
- `leaves`
- `holidays`
- `notifications`

## Setup

1. Create Firebase Authentication users.
2. Add matching employee records in Firestore under `employees`.
3. Use each Firebase Auth UID as the employee document ID.
4. Set employee role as `admin` or `employee`.
5. Open `index.html` in the browser and log in.

## Employee Document Example

```js
{
  name: "Employee Name",
  email: "employee@example.com",
  role: "employee",
  workStart: "10:00",
  workEnd: "19:00",
  leaveAllowance: 12,
  monthlySalary: 30000,
  salaryBasis: "hours"
}
```

## Notes

This is a frontend-only Firebase app. Features that must run automatically when nobody has the admin page open, such as end-of-day absence marking, should eventually be moved to Firebase Cloud Functions.

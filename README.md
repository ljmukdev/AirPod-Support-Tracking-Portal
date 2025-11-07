# LJM AirPod Support & Tracking Portal

A full-stack web application for managing AirPod replacement parts and providing customer support with pairing instructions.

## Features

- **Admin Panel**: Add products with serial numbers, security barcodes, and part types
- **Customer Portal**: Enter security barcode to access pairing instructions
- **Confirmation System**: Customers must confirm understanding before viewing instructions
- **Mobile Responsive**: Optimized for QR code scanning and mobile devices
- **Troubleshooting Guide**: Comprehensive help section for common issues

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Authentication**: Session-based admin authentication

## Installation

1. Install Node.js (version 14 or higher)

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Access the application:
   - Customer site: http://localhost:3000
   - Admin panel: http://localhost:3000/admin/login

## Default Admin Credentials

- **Username**: admin
- **Password**: LJM2024secure

**Important**: Change these credentials in production by setting environment variables:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Environment Variables

Create a `.env` file (optional) for production:

```
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_session_secret_key
PORT=3000
```

## Database

The application uses SQLite and automatically creates the database file (`database.sqlite`) on first run. The database schema includes:

- `id`: Primary key
- `serial_number`: Product serial number
- `security_barcode`: Unique security barcode for customer verification
- `part_type`: Type of part (left, right, or case)
- `date_added`: Timestamp when product was added
- `confirmation_checked`: Boolean flag for customer confirmation
- `confirmation_date`: Timestamp when customer confirmed

## Usage

### Admin Panel

1. Navigate to `/admin/login`
2. Log in with admin credentials
3. Add products by entering:
   - Item Serial Number
   - Security Barcode (unique identifier)
   - Part Type (Left AirPod, Right AirPod, or Case)
4. View all products in the table below
5. Delete products if needed

### Customer Flow

1. Customer enters security barcode on the landing page
2. System verifies barcode and identifies part type
3. Customer is shown confirmation page with warning about opening package
4. Customer must check confirmation box before proceeding
5. Customer is redirected to appropriate pairing instructions
6. Confirmation is logged in the database

## File Structure

```
.
├── server.js              # Express server and API routes
├── package.json           # Dependencies
├── database.sqlite        # SQLite database (created automatically)
├── public/
│   ├── index.html         # Landing page
│   ├── confirmation.html  # Confirmation page
│   ├── left-airpod.html   # Left AirPod instructions
│   ├── right-airpod.html  # Right AirPod instructions
│   ├── case.html          # Case instructions
│   ├── troubleshooting.html # Troubleshooting guide
│   ├── admin/
│   │   ├── login.html     # Admin login
│   │   └── dashboard.html # Admin dashboard
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   └── js/
│       ├── main.js        # Customer-facing JavaScript
│       └── admin.js       # Admin panel JavaScript
└── README.md
```

## Security Features

- Rate limiting on barcode verification (10 attempts per IP per hour)
- Session-based authentication for admin panel
- Input sanitization
- SQL injection protection with prepared statements
- CSRF protection ready (can be added with middleware)

## Production Deployment

1. Set environment variables for credentials
2. Use HTTPS in production
3. Consider using a production database (PostgreSQL, MySQL)
4. Add reverse proxy (nginx) for better performance
5. Set up SSL/TLS certificates
6. Configure firewall rules
7. Set up regular database backups

## Support

For issues or questions, contact: support@ljm.com

## License

Copyright © 2024 LJM. All rights reserved.




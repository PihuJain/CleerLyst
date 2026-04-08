# 🗄️ Database Setup for Best SAAS Kit V2

This folder contains all the SQL queries you need to set up your database in **Neon.tech** for the Best SAAS Kit V2.

## 📋 Setup Instructions

### 1. **Create Neon Database**
1. Go to [neon.tech](https://neon.tech/) and create an account
2. Create a new project
3. Copy your connection string from the dashboard

### 2. **Run SQL Files in Order**
Execute the SQL files in the following order:

1. **`01-create-users-table.sql`** - Creates the main users table
2. **`02-create-indexes.sql`** - Creates database indexes for performance
3. **`03-create-functions.sql`** - Creates utility functions and triggers
4. **`04-insert-sample-data.sql`** - (Optional) Inserts sample data for testing

### 3. **How to Execute SQL in Neon**

#### Option A: Using Neon Console
1. Go to your Neon project dashboard
2. Click on "SQL Editor" or "Query"
3. Copy and paste each SQL file content
4. Click "Run" to execute

#### Option B: Using psql Command Line
```bash
# Connect to your Neon database
psql "your-neon-connection-string"

# Execute each file
\i 01-create-users-table.sql
\i 02-create-indexes.sql
\i 03-create-functions.sql
\i 04-insert-sample-data.sql
```

#### Option C: Using Database Client (DBeaver, pgAdmin, etc.)
1. Connect to your Neon database using the connection string
2. Open each SQL file and execute them in order

## 📊 Database Schema Overview

### Users Table
The main table that stores all user information including:
- User authentication data (Google OAuth)
- Subscription status and billing information
- Credits system for AI usage
- User activity tracking

### Key Features
- **Automatic timestamps** for created_at and updated_at
- **Unique constraints** on google_id and email
- **Default values** for credits (10) and subscription_status ('free')
- **Indexes** for optimal query performance
- **Triggers** for automatic timestamp updates

## 🔧 Environment Variables

After setting up the database, make sure to add your connection string to `.env.local`:

```env
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
```

## ✅ Verification

After running all SQL files, you can verify the setup by:

1. Checking that the `users` table exists
2. Verifying indexes are created
3. Testing the trigger functions
4. (Optional) Checking sample data is inserted

## 🆘 Troubleshooting

### Common Issues:
- **Permission errors**: Make sure you're connected as the database owner
- **Syntax errors**: Ensure you're using PostgreSQL (not MySQL or other databases)
- **Connection issues**: Verify your connection string is correct

### Need Help?
- Check the [Neon documentation](https://neon.tech/docs)
- Review the main project README.md
- Open an issue on the GitHub repository

## 📝 Notes

- All SQL files are compatible with PostgreSQL 13+
- The schema is optimized for the SAAS kit's features
- Sample data is safe to use in development environments
- For production, skip the sample data file

import { Pool } from 'pg'

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

// Export pool for use in other modules
export { pool }

export interface User {
  id: number
  google_id: string
  email: string
  name?: string
  image_url?: string
  created_at: Date
  updated_at: Date
  last_login: Date
}

export interface CreateUserData {
  google_id: string
  email: string
  name?: string
  image_url?: string
}

export interface UpdateUserData {
  name?: string
  image_url?: string
  last_login?: Date
}

// Create or update user on login
export async function upsertUser(userData: CreateUserData): Promise<User> {
  const client = await pool.connect()
  
  try {
    const query = `
      INSERT INTO users (google_id, email, name, image_url, last_login)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (google_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        image_url = EXCLUDED.image_url,
        last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    
    const values = [
      userData.google_id,
      userData.email,
      userData.name || null,
      userData.image_url || null
    ]
    
    const result = await client.query(query, values)
    return result.rows[0] as User
  } finally {
    client.release()
  }
}

// Get user by Google ID
export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const client = await pool.connect()
  
  try {
    const query = 'SELECT * FROM users WHERE google_id = $1'
    const result = await client.query(query, [googleId])
    
    return result.rows[0] as User || null
  } finally {
    client.release()
  }
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const client = await pool.connect()

  try {
    const query = 'SELECT * FROM users WHERE email = $1'
    const result = await client.query(query, [email])

    return result.rows[0] as User || null
  } finally {
    client.release()
  }
}

// Get user by ID
export async function getUserById(id: number): Promise<User | null> {
  const client = await pool.connect()

  try {
    const query = 'SELECT * FROM users WHERE id = $1'
    const result = await client.query(query, [id])

    return result.rows[0] as User || null
  } finally {
    client.release()
  }
}

// Update user's last login
export async function updateUserLastLogin(googleId: string): Promise<void> {
  const client = await pool.connect()
  
  try {
    const query = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE google_id = $1
    `
    await client.query(query, [googleId])
  } finally {
    client.release()
  }
}

// Close the pool (for cleanup)
export async function closePool(): Promise<void> {
  await pool.end()
}

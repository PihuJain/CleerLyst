import { pool } from './database';

// Simplified analytics functions for debugging
export async function getSimpleAnalytics() {
  const client = await pool.connect();
  
  try {
    // Basic user count
    const totalUsersResult = await client.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].total);

    // Users by subscription status
    const statusResult = await client.query(`
      SELECT 
        subscription_status,
        COUNT(*) as count
      FROM users 
      GROUP BY subscription_status
    `);

    // Total credits
    const creditsResult = await client.query('SELECT SUM(credits) as total_credits FROM users');
    const totalCredits = parseInt(creditsResult.rows[0].total_credits) || 0;

    // Pro users count
    const proUsersResult = await client.query(`
      SELECT COUNT(*) as pro_users
      FROM users 
      WHERE subscription_status = 'pro'
    `);
    const proUsers = parseInt(proUsersResult.rows[0].pro_users);

    // Active users (last 30 days)
    const activeUsersResult = await client.query(`
      SELECT COUNT(*) as active_users
      FROM users 
      WHERE last_login >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const activeUsers = parseInt(activeUsersResult.rows[0].active_users);

    return {
      users: {
        total: totalUsers,
        byStatus: statusResult.rows,
        activeUsers: activeUsers,
        proUsers: proUsers,
        freeUsers: totalUsers - proUsers
      },
      revenue: {
        total: proUsers * 99,
        proUsers: proUsers
      },
      credits: {
        total: totalCredits,
        average: totalUsers > 0 ? totalCredits / totalUsers : 0
      }
    };

  } finally {
    client.release();
  }
}

export async function getSimpleGrowthMetrics() {
  const client = await pool.connect();
  
  try {
    // Current month signups
    const currentMonthResult = await client.query(`
      SELECT COUNT(*) as current_month
      FROM users 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const currentMonth = parseInt(currentMonthResult.rows[0].current_month);

    // Last month signups
    const lastMonthResult = await client.query(`
      SELECT COUNT(*) as last_month
      FROM users 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND created_at < DATE_TRUNC('month', CURRENT_DATE)
    `);
    const lastMonth = parseInt(lastMonthResult.rows[0].last_month);

    // Calculate growth rate
    const growthRate = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth) * 100 : 0;

    // Conversion rate
    const conversionResult = await client.query(`
      SELECT 
        COUNT(CASE WHEN subscription_status = 'pro' THEN 1 END) as pro_users,
        COUNT(*) as total_users
      FROM users
    `);
    const proUsers = parseInt(conversionResult.rows[0].pro_users);
    const totalUsers = parseInt(conversionResult.rows[0].total_users);
    const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    return {
      growthRate: Math.round(growthRate * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      retentionRate: 0, // Simplified for now
      currentMonth,
      lastMonth,
      proUsers,
      totalUsers
    };

  } finally {
    client.release();
  }
}

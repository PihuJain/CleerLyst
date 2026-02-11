// Simple in-memory usage tracking (in production, use a database)

export interface UsageStats {
  userId: string;
  date: string;
  messagesCount: number;
  tokensUsed: number;
  conversationsCount: number;
  lastActivity: Date;
}

// In-memory storage (replace with database in production)
const usageStore = new Map<string, UsageStats>();

export function getUserUsageKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${userId}-${today}`;
}

export function getUsageStats(userId: string): UsageStats {
  const key = getUserUsageKey(userId);
  const existing = usageStore.get(key);
  
  if (existing) {
    return existing;
  }

  // Create new stats for today
  const newStats: UsageStats = {
    userId,
    date: new Date().toISOString().split('T')[0],
    messagesCount: 0,
    tokensUsed: 0,
    conversationsCount: 0,
    lastActivity: new Date(),
  };

  usageStore.set(key, newStats);
  return newStats;
}

export function updateUsageStats(
  userId: string, 
  update: Partial<Pick<UsageStats, 'messagesCount' | 'tokensUsed' | 'conversationsCount'>>
): UsageStats {
  const key = getUserUsageKey(userId);
  const current = getUsageStats(userId);
  
  const updated: UsageStats = {
    ...current,
    messagesCount: current.messagesCount + (update.messagesCount || 0),
    tokensUsed: current.tokensUsed + (update.tokensUsed || 0),
    conversationsCount: current.conversationsCount + (update.conversationsCount || 0),
    lastActivity: new Date(),
  };

  usageStore.set(key, updated);
  return updated;
}

export function incrementMessageCount(userId: string, tokensUsed: number = 0): UsageStats {
  return updateUsageStats(userId, {
    messagesCount: 1,
    tokensUsed,
  });
}

export function incrementConversationCount(userId: string): UsageStats {
  return updateUsageStats(userId, {
    conversationsCount: 1,
  });
}

// Usage limits (can be configured per user/plan)
export interface UsageLimits {
  dailyMessages: number;
  dailyTokens: number;
  conversationsPerDay: number;
}

export const DEFAULT_LIMITS: UsageLimits = {
  dailyMessages: 100,
  dailyTokens: 10000,
  conversationsPerDay: Infinity,
};

export function checkUsageLimits(userId: string, limits: UsageLimits = DEFAULT_LIMITS): {
  canSendMessage: boolean;
  canStartConversation: boolean;
  remainingMessages: number;
  remainingTokens: number;
  remainingConversations: number;
} {
  const stats = getUsageStats(userId);
  
  return {
    canSendMessage: stats.messagesCount < limits.dailyMessages && stats.tokensUsed < limits.dailyTokens,
    canStartConversation: stats.conversationsCount < limits.conversationsPerDay,
    remainingMessages: Math.max(0, limits.dailyMessages - stats.messagesCount),
    remainingTokens: Math.max(0, limits.dailyTokens - stats.tokensUsed),
    remainingConversations: limits.conversationsPerDay === Infinity 
      ? Infinity 
      : Math.max(0, limits.conversationsPerDay - stats.conversationsCount),
  };
}

// API endpoint to get usage stats
export function formatUsageForAPI(userId: string) {
  const stats = getUsageStats(userId);
  const limits = DEFAULT_LIMITS;
  const checks = checkUsageLimits(userId, limits);
  
  return {
    today: {
      messages: stats.messagesCount,
      tokens: stats.tokensUsed,
      conversations: stats.conversationsCount,
    },
    limits: {
      messages: limits.dailyMessages,
      tokens: limits.dailyTokens,
      conversations: limits.conversationsPerDay,
    },
    remaining: {
      messages: checks.remainingMessages,
      tokens: checks.remainingTokens,
      conversations: checks.remainingConversations,
    },
    canUse: {
      sendMessage: checks.canSendMessage,
      startConversation: checks.canStartConversation,
    },
    lastActivity: stats.lastActivity,
  };
}

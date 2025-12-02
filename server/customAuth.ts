import session from "express-session";
import connectPg from "connect-pg-simple";
import type { RequestHandler, Request } from "express";
import { db } from "./db";
import { users, type ApiKey } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);
    
    if (!user || user.isAdmin !== 'true') {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// API Key authentication middleware for external integrations
export const isApiKeyAuthenticated: RequestHandler = async (req, res, next) => {
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  
  if (!apiKeyHeader) {
    return res.status(401).json({ 
      error: "API key required",
      message: "Please provide an API key in the X-API-Key header"
    });
  }
  
  try {
    const result = await storage.validateApiKey(apiKeyHeader);
    
    if (!result.valid || !result.apiKey) {
      return res.status(401).json({ 
        error: "Invalid API key",
        message: result.error || "The provided API key is not valid"
      });
    }
    
    // Attach the API key to the request for scope checking
    req.apiKey = result.apiKey;
    
    // Update last used timestamp (don't await to avoid slowing down the request)
    storage.updateApiKeyLastUsed(result.apiKey.id).catch(console.error);
    
    next();
  } catch (error) {
    console.error("API key validation error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to validate API key"
    });
  }
};

// Middleware to check if API key has required scope
export const requireScope = (scope: string): RequestHandler => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ 
        error: "API key required",
        message: "This endpoint requires API key authentication"
      });
    }
    
    if (!req.apiKey.scopes || !req.apiKey.scopes.includes(scope)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        message: `This endpoint requires the '${scope}' scope`
      });
    }
    
    next();
  };
};

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes, preWarmTeeTimeCache } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./storage";
import { startAlertScheduler } from "./inbox-alerts";

const app = express();

// Enable gzip/brotli compression for all responses
app.use(compression());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Health check endpoint - responds immediately for Cloud Run
// Must be registered BEFORE any middleware that might delay response
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Register routes first (without waiting for seeding)
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error("Express error handler:", err);
    
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Seed database AFTER server starts listening (non-blocking)
    seedDatabase()
      .then(() => {
        log("Database seeding completed");
        // Pre-warm tee time cache for faster first load (Google SEO)
        setTimeout(() => {
          preWarmTeeTimeCache().catch(err => 
            console.error("Cache pre-warm failed:", err)
          );
        }, 2000); // Wait 2 seconds for server to stabilize
      })
      .catch((err) => console.error("Database seeding failed:", err));
    
    // Alert scheduler disabled - too many emails being sent
    // startAlertScheduler();
  });
})();

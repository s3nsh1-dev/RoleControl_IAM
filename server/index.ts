import app from "./src/app.ts";
import env from "@/utils/envHelper.ts";

const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\nServer is running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION! Shutting down gracefully...");
  console.error(reason);
  server.close(() => {
    process.exit(1);
  });
});

const gracefulShutdown = (signal: string) => {
  console.log(`\n[${signal}] signal received. Stopping server gracefully...`);

  server.close((err?: Error) => {
    if (err) {
      console.error("Error while closing HTTP server:", err);
      process.exit(1);
    }
    console.log("HTTP server closed.");

    // TODO: Add database connection closure here when implemented
    // e.g., await db.disconnect();

    console.log("Process completely terminated.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down.",
    );
    process.exit(1);
  }, 10000).unref();
};

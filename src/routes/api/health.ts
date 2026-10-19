import { createFileRoute } from "@tanstack/react-router";
import { configError } from "../../server/auth.server";
import { ping } from "../../server/db.server";

// For Docker's health check and the deploy job: answers 200 only when sign-in is configured and the database opens.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        const problem = configError();
        if (problem) return new Response(problem, { status: 500 });
        ping();
        return Response.json({ ok: true });
      },
    },
  },
});

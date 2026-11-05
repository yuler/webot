import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/todos")({
  beforeLoad: () => {
    throw redirect({ to: "/console/todos" });
  },
  component: () => null,
});

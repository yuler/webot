import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchMe } from "@/lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const me = await fetchMe();
    throw redirect({ to: me ? "/console" : "/login" });
  },
});

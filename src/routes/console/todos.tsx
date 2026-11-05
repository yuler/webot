import { createFileRoute } from "@tanstack/react-router";
import { TodosPanel } from "@/components/TodosPanel";

export const Route = createFileRoute("/console/todos")({
  component: ConsoleTodosPage,
});

function ConsoleTodosPage() {
  return <TodosPanel headingId="console-todos-heading" />;
}

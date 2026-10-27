import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { desc, count, eq, isNull, and, or, sql } from "drizzle-orm";

function parseArgs() {
  const args = process.argv.slice(2);
  let page = 1;
  let limit = 20;
  let all = false;
  let json = false;
  let userQuery: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--page" && args[i + 1]) {
      page = Math.max(1, parseInt(args[++i], 10) || 1);
    } else if (arg === "--limit" && args[i + 1]) {
      limit = Math.max(1, parseInt(args[++i], 10) || 20);
    } else if (arg === "--all") {
      all = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--user" && args[i + 1]) {
      userQuery = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: bun run list-messages.ts [options]

Options:
  --limit <number>   Number of messages per page (default: 20)
  --page <number>    Page number (default: 1)
  --user <id|email>  Filter by user ID or user email
  --all              Include soft-deleted messages
  --json             Output raw JSON instead of formatted table
  --help, -h         Show this help message
      `.trim());
      process.exit(0);
    }
  }

  return { page, limit, all, json, userQuery };
}

async function main() {
  const { page, limit, all, json, userQuery } = parseArgs();
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];

  if (!all) {
    conditions.push(isNull(messages.deletedAt));
  }

  if (userQuery) {
    conditions.push(
      or(
        eq(messages.userId, userQuery),
        eq(users.email, userQuery)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query total count
  const [{ totalCount }] = await db
    .select({ totalCount: count() })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(whereClause);

  // Query paginated messages
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      userId: messages.userId,
      userEmail: users.email,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(whereClause)
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (json) {
    console.log(
      JSON.stringify(
        {
          total: totalCount,
          page,
          limit,
          totalPages,
          count: rows.length,
          data: rows,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`\n📬 Messages List (${rows.length} of ${totalCount} records, Page ${page}/${totalPages})`);
  console.log(`--------------------------------------------------------------------------------`);

  if (rows.length === 0) {
    console.log("No messages found.");
    return;
  }

  const tableData = rows.map((r) => {
    // Truncate long content for clean table display
    const cleanContent = r.content.replace(/[\r\n]+/g, " ");
    const previewContent =
      cleanContent.length > 50 ? `${cleanContent.slice(0, 47)}...` : cleanContent;

    return {
      ID: r.id.length > 12 ? `${r.id.slice(0, 8)}...` : r.id,
      Role: r.role,
      User: r.userEmail || (r.userId.length > 10 ? `${r.userId.slice(0, 8)}...` : r.userId),
      Content: previewContent,
      CreatedAt: r.createdAt,
      ...(all ? { Deleted: r.deletedAt ? "Yes" : "No" } : {}),
    };
  });

  console.table(tableData);
  console.log(`Tip: Use --json for full content, or --page ${page + 1} for next page.\n`);
}

main().catch((err) => {
  console.error("Error running list-messages snippet:", err);
  process.exit(1);
});

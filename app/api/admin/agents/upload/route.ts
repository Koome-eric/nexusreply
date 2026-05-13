import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function isAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  return u?.role === "admin";
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const agentId = formData.get("agentId") as string | null;
    const mode = (formData.get("mode") as string) || "append"; // append | replace

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!agentId) return NextResponse.json({ error: "No agentId provided" }, { status: 400 });

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) return NextResponse.json({ error: "CSV is empty or invalid" }, { status: 400 });

    // Get current agent
    const agent = await prisma.globalAgentTemplate.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // Extract Q&A pairs or prompt additions from CSV
    // Expected columns: question, answer OR scenario, response OR rule
    const promptAdditions: string[] = [];
    const objections: string[] = [];
    const faqs: string[] = [];
    const rules: string[] = [];

    for (const row of rows) {
      const keys = Object.keys(row).map(k => k.toLowerCase());

      // Q&A / FAQ pairs
      if (keys.includes("question") && keys.includes("answer")) {
        faqs.push(`Q: ${row["question"] || row["Question"]}\nA: ${row["answer"] || row["Answer"]}`);
      }
      // Objection handling
      else if (keys.includes("objection") && keys.includes("response")) {
        objections.push(`Objection: "${row["objection"] || row["Objection"]}"\nResponse: "${row["response"] || row["Response"]}"`);
      }
      // Scenario pairs
      else if (keys.includes("scenario") && keys.includes("response")) {
        promptAdditions.push(`Scenario: ${row["scenario"] || row["Scenario"]}\nResponse approach: ${row["response"] || row["Response"]}`);
      }
      // Raw rules
      else if (keys.includes("rule")) {
        rules.push(`- ${row["rule"] || row["Rule"]}`);
      }
    }

    // Build additions block to append to system prompt
    let additionBlock = "\n\n---\n# TRAINING DATA (CSV IMPORT)\n";

    if (faqs.length > 0) {
      additionBlock += "\n## FREQUENTLY ASKED QUESTIONS\n" + faqs.join("\n\n");
    }
    if (objections.length > 0) {
      additionBlock += "\n\n## OBJECTION HANDLING\n" + objections.join("\n\n");
    }
    if (promptAdditions.length > 0) {
      additionBlock += "\n\n## SCENARIOS\n" + promptAdditions.join("\n\n");
    }
    if (rules.length > 0) {
      additionBlock += "\n\n## ADDITIONAL RULES\n" + rules.join("\n");
    }

    // Update the agent
    let newPrompt: string;
    if (mode === "replace") {
      // Remove old training block if exists, add new one
      const base = agent.systemPrompt.replace(/\n\n---\n# TRAINING DATA[\s\S]*$/, "");
      newPrompt = base + additionBlock;
    } else {
      // Append mode — add to existing training block
      const hasBlock = agent.systemPrompt.includes("# TRAINING DATA");
      if (hasBlock) {
        newPrompt = agent.systemPrompt + "\n\n" + additionBlock.replace("# TRAINING DATA (CSV IMPORT)\n", "");
      } else {
        newPrompt = agent.systemPrompt + additionBlock;
      }
    }

    const updated = await prisma.globalAgentTemplate.update({
      where: { id: agentId },
      data: {
        systemPrompt: newPrompt,
        version: { increment: 1 },
        trainingNotes: agent.trainingNotes
          ? `${agent.trainingNotes}\n[CSV Import ${new Date().toISOString().slice(0, 10)}: ${rows.length} rows, mode=${mode}]`
          : `[CSV Import ${new Date().toISOString().slice(0, 10)}: ${rows.length} rows, mode=${mode}]`,
      },
    });

    return NextResponse.json({
      success: true,
      rowsProcessed: rows.length,
      faqsAdded: faqs.length,
      objectionsAdded: objections.length,
      scenariosAdded: promptAdditions.length,
      rulesAdded: rules.length,
      newVersion: updated.version,
    });
  } catch (err) {
    console.error("CSV upload error:", err);
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 });
  }
}

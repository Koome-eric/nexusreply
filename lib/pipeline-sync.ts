import { prisma } from "./db";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// Maps internal stages to GHL pipeline stage names
const STAGE_MAP = [
  { internal: "NEW", name: "New Lead", position: 0 },
  { internal: "ENGAGED", name: "Engaged", position: 1 },
  { internal: "QUALIFIED", name: "Qualified", position: 2 },
  { internal: "BOOKING", name: "Booking", position: 3 },
  { internal: "CLOSING", name: "Closing", position: 4 },
  { internal: "WON", name: "Won 💰", position: 5 },
  { internal: "LOST", name: "Lost", position: 6 },
  { internal: "NURTURE", name: "Nurture", position: 7 },
];

export async function createOrConnectGHLPipeline(
  locationId: string,
  ghlLocationId: string,
  accessToken: string
): Promise<{ success: boolean; pipelineId?: string; error?: string }> {
  try {
    // Check if already synced
    const existing = await prisma.gHLPipelineSync.findUnique({ where: { locationId } });
    if (existing) return { success: true, pipelineId: existing.ghlPipelineId };

    // Fetch existing pipelines to avoid duplicates
    const listRes = await fetch(`${GHL_BASE}/opportunities/pipelines/?locationId=${ghlLocationId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Version: GHL_VERSION },
    });

    let pipelineId: string | null = null;
    let stageMap: Record<string, string> = {};

    if (listRes.ok) {
      const listData = await listRes.json();
      const pipelines = listData.pipelines || [];
      const existing = pipelines.find((p: { name: string }) =>
        p.name === "AI Sales System" || p.name === "NexusReply"
      );
      if (existing) {
        pipelineId = existing.id;
        // Build stage map from existing pipeline
        for (const stage of existing.stages || []) {
          const internal = STAGE_MAP.find(
            (s) => s.name.toLowerCase() === stage.name.toLowerCase()
          );
          if (internal) stageMap[internal.internal] = stage.id;
        }
      }
    }

    // Create pipeline if not found
    if (!pipelineId) {
      const createRes = await fetch(`${GHL_BASE}/opportunities/pipelines/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: ghlLocationId,
          name: "AI Sales System",
          stages: STAGE_MAP.map((s) => ({ name: s.name, position: s.position })),
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error("[PipelineSync] Create failed:", err);
        return { success: false, error: err };
      }

      const createData = await createRes.json();
      const pipeline = createData.pipeline || createData;
      pipelineId = pipeline.id;

      // Map stage IDs
      for (const ghlStage of pipeline.stages || []) {
        const internal = STAGE_MAP.find(
          (s) => s.name.toLowerCase() === ghlStage.name.toLowerCase()
        );
        if (internal) stageMap[internal.internal] = ghlStage.id;
      }
    }

    if (!pipelineId) return { success: false, error: "Could not get pipeline ID" };

    // Save sync record
    await prisma.gHLPipelineSync.create({
      data: { locationId, ghlPipelineId: pipelineId, ghlStageMap: stageMap },
    });

    console.log("[PipelineSync] Pipeline synced:", pipelineId);
    return { success: true, pipelineId };
  } catch (err) {
    console.error("[PipelineSync] Error:", err);
    return { success: false, error: String(err) };
  }
}

// Move a contact to a GHL pipeline stage
export async function syncLeadToGHLPipeline(
  locationId: string,
  contactId: string,
  stage: string,
  accessToken: string,
  contactName?: string
) {
  try {
    const sync = await prisma.gHLPipelineSync.findUnique({ where: { locationId } });
    if (!sync?.syncEnabled) return;

    const stageMap = sync.ghlStageMap as Record<string, string>;
    const ghlStageId = stageMap[stage];
    if (!ghlStageId) return;

    // Check for existing opportunity
    const oppRes = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${contactId}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Version: GHL_VERSION } }
    );

    let opportunityId: string | null = null;
    if (oppRes.ok) {
      const oppData = await oppRes.json();
      const opps = oppData.opportunities || [];
      const existing = opps.find(
        (o: { pipelineId: string }) => o.pipelineId === sync.ghlPipelineId
      );
      if (existing) opportunityId = existing.id;
    }

    if (opportunityId) {
      // Update existing opportunity stage
      await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pipelineStageId: ghlStageId }),
      });
    } else {
      // Create new opportunity
      await fetch(`${GHL_BASE}/opportunities/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pipelineId: sync.ghlPipelineId,
          pipelineStageId: ghlStageId,
          contactId,
          name: contactName || "AI Lead",
          status: stage === "WON" ? "won" : stage === "LOST" ? "lost" : "open",
        }),
      });
    }
  } catch (err) {
    console.error("[PipelineSync] syncLeadToGHLPipeline error:", err);
  }
}

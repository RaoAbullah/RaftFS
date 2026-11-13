import { ChildProcess, fork } from "node:child_process";
import * as path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export interface ClusterNodeInfo {
  index: number;
  clientPort: number;
  raftPort: number;
  address: string;
}

export class RaftCluster {
  nodesMap: Map<number, { child: ChildProcess | null; clientPort: number; raftPort: number }> = new Map();
  dashboardApp: express.Express = express();
  dashboardPort: number = 3000;

  constructor(initialNodes: number = 3) {
    console.log("=============================================================");
    console.log("🚀 Initializing Raft Distributed Document Storage Cluster");
    console.log(`   Initial Nodes: ${initialNodes}`);
    console.log("=============================================================");

    for (let i = 0; i < initialNodes; i++) {
      this.nodesMap.set(i, {
        child: null,
        clientPort: 5000 + i,
        raftPort: 7000 + i,
      });
    }

    // Launch initial nodes
    for (let i = 0; i < initialNodes; i++) {
      this.spawnNode(i);
    }

    this.setupDashboardServer();
  }

  private getServerConfigs() {
    const list: { index: number; address: string; port: number; clientPort: number }[] = [];
    for (const [idx, info] of this.nodesMap.entries()) {
      list.push({
        index: idx,
        address: `http://localhost:${info.raftPort}`,
        port: info.raftPort,
        clientPort: info.clientPort,
      });
    }
    return list;
  }

  private async broadcastMembershipUpdate() {
    const servers = this.getServerConfigs();
    for (const [idx, info] of this.nodesMap.entries()) {
      if (!info.child) continue;
      try {
        await fetch(`http://localhost:${info.clientPort}/api/cluster/update-members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ servers }),
          signal: AbortSignal.timeout(600),
        });
      } catch {
        // Node might be booting up or offline
      }
    }
  }

  spawnNode(index: number): boolean {
    const info = this.nodesMap.get(index);
    if (!info) return false;

    if (info.child) {
      console.log(`[Cluster Orchestrator] Node ${index} is already running.`);
      return true;
    }

    const raftAddresses = Array.from(this.nodesMap.values()).map((n) => `http://localhost:${n.raftPort}`);

    const child = fork(
      path.join(__dirname, "start-node.ts"),
      [info.clientPort.toString(), index.toString(), raftAddresses.join(",")],
      {
        execArgv: ["-r", "ts-node/register"],
        stdio: "inherit",
      }
    );

    child.on("exit", (code) => {
      console.log(`⚠️ [Cluster Orchestrator] Node ${index} process exited with code ${code}`);
      const current = this.nodesMap.get(index);
      if (current) current.child = null;
    });

    info.child = child;
    console.log(`✅ [Cluster Orchestrator] Node ${index} spawned (Client: ${info.clientPort}, Raft: ${info.raftPort})`);

    // Give node time to open express port, then broadcast updated membership with retries
    setTimeout(() => {
      this.broadcastMembershipUpdate();
    }, 500);
    setTimeout(() => {
      this.broadcastMembershipUpdate();
    }, 1200);

    return true;
  }

  killNode(index: number): boolean {
    const info = this.nodesMap.get(index);
    if (info && info.child) {
      console.log(`🛑 [Chaos Monkey] Killing Node ${index}...`);
      info.child.kill("SIGKILL");
      info.child = null;
      return true;
    }
    return false;
  }

  addNode(): { index: number; clientPort: number; raftPort: number } {
    let newIndex = 0;
    while (this.nodesMap.has(newIndex)) {
      newIndex++;
    }

    const clientPort = 5000 + newIndex;
    const raftPort = 7000 + newIndex;

    this.nodesMap.set(newIndex, {
      child: null,
      clientPort,
      raftPort,
    });

    console.log(`➕ [Dynamic Scaling] Adding Node ${newIndex} to cluster...`);
    this.spawnNode(newIndex);
    this.broadcastMembershipUpdate();
    setTimeout(() => this.broadcastMembershipUpdate(), 600);
    setTimeout(() => this.broadcastMembershipUpdate(), 1400);

    return { index: newIndex, clientPort, raftPort };
  }

  removeNode(index: number): boolean {
    if (this.nodesMap.size <= 1) {
      console.warn(`[Dynamic Scaling] Cannot remove Node ${index}: cluster must retain at least 1 node.`);
      return false;
    }

    const info = this.nodesMap.get(index);
    if (!info) return false;

    console.log(`➖ [Dynamic Scaling] Removing Node ${index} from cluster...`);
    if (info.child) {
      info.child.kill("SIGKILL");
      info.child = null;
    }

    this.nodesMap.delete(index);
    this.broadcastMembershipUpdate();
    return true;
  }

  private setupDashboardServer() {
    this.dashboardApp.use(cors());
    this.dashboardApp.use(express.json({ limit: "50mb" }));
    this.dashboardApp.use(express.static(path.join(__dirname, "..", "public")));

    // 1. Cluster Status Aggregator
    this.dashboardApp.get("/api/cluster/status", async (_req, res) => {
      const nodeEntries = Array.from(this.nodesMap.entries());

      const statuses = await Promise.all(
        nodeEntries.map(async ([index, info]) => {
          const isProcessRunning = !!info.child;
          if (!isProcessRunning) {
            return {
              nodeIndex: index,
              clientPort: info.clientPort,
              raftPort: info.raftPort,
              state: "Offline",
              isAlive: false,
              storageStats: { docCount: 0, totalSizeBytes: 0 },
            };
          }

          try {
            const resp = await fetch(`http://localhost:${info.clientPort}/api/status`, {
              signal: AbortSignal.timeout(1000),
            });
            if (resp.ok) {
              const data = await resp.json();
              return { ...data, isAlive: true };
            }
          } catch {
            // Node failed to reply
          }

          return {
            nodeIndex: index,
            clientPort: info.clientPort,
            raftPort: info.raftPort,
            state: "Unreachable",
            isAlive: false,
            storageStats: { docCount: 0, totalSizeBytes: 0 },
          };
        })
      );

      const leader = statuses.find((s) => s.state === "Leader");

      res.json({
        totalNodes: this.nodesMap.size,
        activeNodes: statuses.filter((s) => s.isAlive).length,
        leaderId: leader ? leader.nodeIndex : null,
        nodes: statuses,
      });
    });

    // 2. Dynamic Scaling: Add a Node
    this.dashboardApp.post("/api/cluster/scale/add", (_req, res) => {
      const newNode = this.addNode();
      res.json({ success: true, message: `Node ${newNode.index} added and spawned`, node: newNode });
    });

    // 3. Dynamic Scaling: Remove a Node
    this.dashboardApp.post("/api/cluster/scale/remove", (req, res) => {
      let index = Number(req.body.index);
      if (isNaN(index)) {
        // If no index given, remove highest index
        const keys = Array.from(this.nodesMap.keys()).sort((a, b) => b - a);
        index = keys[0];
      }

      const success = this.removeNode(index);
      if (success) {
        res.json({ success: true, message: `Node ${index} removed from cluster` });
      } else {
        res.status(400).json({ error: `Cannot remove Node ${index}. Minimum 1 node required.` });
      }
    });

    // 4. Transparent Document Upload (Automatically routed to Leader)
    this.dashboardApp.post("/api/cluster/upload", upload.single("file"), async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      // Find active leader
      let leaderPort: number | null = null;
      for (const [_, info] of this.nodesMap.entries()) {
        if (!info.child) continue;
        try {
          const statusRes = await fetch(`http://localhost:${info.clientPort}/api/status`, {
            signal: AbortSignal.timeout(800),
          });
          if (statusRes.ok) {
            const status = (await statusRes.json()) as { state: string };
            if (status.state === "Leader") {
              leaderPort = info.clientPort;
              break;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!leaderPort) {
        res.status(503).json({
          error: "NO_LEADER_AVAILABLE",
          message: "No active leader in cluster to coordinate quorum. Please revive nodes.",
        });
        return;
      }

      try {
        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append("file", blob, req.file.originalname);

        const leaderUploadRes = await fetch(`http://localhost:${leaderPort}/api/documents/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await leaderUploadRes.json();
        res.status(leaderUploadRes.status).json(data);
      } catch (err: any) {
        res.status(500).json({ error: "Failed to forward upload to Leader", details: err?.message });
      }
    });

    // 5. Cluster Document Listing (Queries Leader first, or aggregates unique docs)
    this.dashboardApp.get("/api/cluster/documents", async (_req, res) => {
      // 1. Try to find active Leader first
      for (const [_, info] of this.nodesMap.entries()) {
        if (!info.child) continue;
        try {
          const statusRes = await fetch(`http://localhost:${info.clientPort}/api/status`, {
            signal: AbortSignal.timeout(600),
          });
          if (statusRes.ok) {
            const st = await statusRes.json();
            if (st.state === "Leader") {
              const docRes = await fetch(`http://localhost:${info.clientPort}/api/documents`, {
                signal: AbortSignal.timeout(800),
              });
              if (docRes.ok) {
                const data = await docRes.json();
                res.json(data);
                return;
              }
            }
          }
        } catch {}
      }

      // 2. Fallback: Aggregate and deduplicate across all responding nodes
      const allDocsMap = new Map<string, any>();
      for (const [_, info] of this.nodesMap.entries()) {
        if (!info.child) continue;
        try {
          const resp = await fetch(`http://localhost:${info.clientPort}/api/documents`, {
            signal: AbortSignal.timeout(600),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.documents)) {
              data.documents.forEach((d: any) => allDocsMap.set(d.fileId, d));
            }
          }
        } catch {}
      }
      res.json({ documents: Array.from(allDocsMap.values()) });
    });

    // 6. Download document from any available node (Leader prioritized)
    this.dashboardApp.get("/api/cluster/download/:fileId", async (req, res) => {
      const fileId = req.params.fileId;
      
      // Try Leader first
      for (const [_, info] of this.nodesMap.entries()) {
        if (!info.child) continue;
        try {
          const statusRes = await fetch(`http://localhost:${info.clientPort}/api/status`, {
            signal: AbortSignal.timeout(600),
          });
          if (statusRes.ok) {
            const st = await statusRes.json();
            if (st.state === "Leader") {
              const resp = await fetch(`http://localhost:${info.clientPort}/api/documents/${fileId}`, {
                signal: AbortSignal.timeout(1500),
              });
              if (resp.ok) {
                const disposition = resp.headers.get("content-disposition");
                const contentType = resp.headers.get("content-type");
                if (disposition) res.setHeader("Content-Disposition", disposition);
                if (contentType) res.setHeader("Content-Type", contentType);
                const buffer = Buffer.from(await resp.arrayBuffer());
                res.send(buffer);
                return;
              }
            }
          }
        } catch {}
      }

      // Fallback: try any other running node
      for (const [_, info] of this.nodesMap.entries()) {
        if (!info.child) continue;
        try {
          const resp = await fetch(`http://localhost:${info.clientPort}/api/documents/${fileId}`, {
            signal: AbortSignal.timeout(1200),
          });
          if (resp.ok) {
            const disposition = resp.headers.get("content-disposition");
            const contentType = resp.headers.get("content-type");
            if (disposition) res.setHeader("Content-Disposition", disposition);
            if (contentType) res.setHeader("Content-Type", contentType);

            const buffer = Buffer.from(await resp.arrayBuffer());
            res.send(buffer);
            return;
          }
        } catch {
          // try next
        }
      }
      res.status(404).send("File not found on any active node");
    });

    // 7. Delete Document (Routed to Leader)
    this.dashboardApp.delete("/api/cluster/documents/:fileId", async (req, res) => {
      const fileId = req.params.fileId;
      for (const [_, info] of this.nodesMap.entries()) {
        if (!info.child) continue;
        try {
          const statusRes = await fetch(`http://localhost:${info.clientPort}/api/status`, {
            signal: AbortSignal.timeout(800),
          });
          if (statusRes.ok) {
            const s = (await statusRes.json()) as { state: string };
            if (s.state === "Leader") {
              const delRes = await fetch(`http://localhost:${info.clientPort}/api/documents/${fileId}`, {
                method: "DELETE",
              });
              const data = await delRes.json();
              res.status(delRes.status).json(data);
              return;
            }
          }
        } catch {
          // next
        }
      }
      res.status(503).json({ error: "Leader unavailable to coordinate deletion" });
    });

    // 8. Distributed MapReduce Search
    this.dashboardApp.get("/api/cluster/search", async (req, res) => {
      const q = (req.query.q as string) || "";
      const startTime = Date.now();

      // MAP STEP: Broadcast search to all active nodes in parallel
      const mapPromises = Array.from(this.nodesMap.entries()).map(async ([index, info]) => {
        if (!info.child) {
          return { nodeIndex: index, matches: [] };
        }
        try {
          const resp = await fetch(`http://localhost:${info.clientPort}/api/search?q=${encodeURIComponent(q)}`, {
            signal: AbortSignal.timeout(1500),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { matches: any[] };
            return { nodeIndex: index, matches: data.matches || [] };
          }
        } catch {
          // offline
        }
        return { nodeIndex: index, matches: [] };
      });

      const mapResults = await Promise.all(mapPromises);

      // REDUCE STEP: Aggregate and deduplicate matches
      const uniqueMatchesMap = new Map<string, any>();
      mapResults.forEach((resItem) => {
        resItem.matches.forEach((m: any) => {
          const key = `${m.fileId}_${m.line}`;
          if (!uniqueMatchesMap.has(key)) {
            uniqueMatchesMap.set(key, { ...m, verifiedOnNode: resItem.nodeIndex });
          }
        });
      });

      const durationMs = Date.now() - startTime;
      res.json({
        query: q,
        durationMs,
        participatingNodes: mapResults.map((r) => r.nodeIndex),
        totalMatches: uniqueMatchesMap.size,
        results: Array.from(uniqueMatchesMap.values()),
      });
    });

    // 9. Chaos Control: Kill a Node
    this.dashboardApp.post("/api/cluster/chaos/kill", (req, res) => {
      const index = Number(req.body.index);
      const success = this.killNode(index);
      res.json({ success, message: success ? `Node ${index} killed` : `Node ${index} was not running` });
    });

    // 10. Chaos Control: Revive a Node
    this.dashboardApp.post("/api/cluster/chaos/revive", (req, res) => {
      const index = Number(req.body.index);
      if (this.nodesMap.has(index)) {
        this.spawnNode(index);
        res.json({ success: true, message: `Node ${index} revived` });
      } else {
        res.status(400).json({ error: "Invalid node index" });
      }
    });

    // Start Dashboard Server
    this.dashboardApp.listen(this.dashboardPort, () => {
      console.log(`\n=============================================================`);
      console.log(`🌐 Web Visualizer & Dashboard is LIVE at:`);
      console.log(`   👉 http://localhost:${this.dashboardPort}`);
      console.log(`=============================================================\n`);
    });
  }
}

new RaftCluster(Number(process.argv[2] || "3"));

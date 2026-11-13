import express from "express";
import cors from "cors";
import multer from "multer";
import * as crypto from "node:crypto";
import { Store } from "./state-machine";
import { DocumentStore, DocumentMetadata, SearchMatch } from "./document-store";

export enum State {
  Follower = "Follower",
  Candidate = "Candidate",
  Leader = "Leader",
}

export interface ServerConfig {
  address: string;
  port: number;
  index: number;
  clientPort?: number;
}

export enum LogType {
  Beat = "Beat",
  Set = "Set",
  Del = "Del",
  DocUpload = "DocUpload",
  DocDelete = "DocDelete",
}

export interface LogEntry {
  type: LogType;
  args: string[];
  index: number;
  term: number;
}

interface AppendEntriesParams {
  term: number;
  leaderId: number;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
  leaderDocCount?: number;
}

interface RequestVoteParams {
  term: number;
  candidateId: number;
  lastLogIndex: number;
  lastLogTerm: number;
}

const APPEND_ENTRIES_PATH = "/append-entries";
const REQUEST_VOTE_PATH = "/request-vote";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max per file
});

export class RaftNode {
  state: State = State.Follower;
  currentTerm: number = 0;
  votedFor: number | null = null;
  leaderId: number | null = null;
  log: LogEntry[] = [];

  // volatile
  commitIndex: number = 0;
  lastApplied: number = 0;

  // for leader
  nextIndex: Record<number, number> = {};
  matchIndex: Record<number, number> = {};

  // internals
  private _index: number;
  private _servers: ServerConfig[];
  private _store: Store;
  private _docStore: DocumentStore;
  private _expressRaft: express.Express = express();
  private _expressClient: express.Express = express();
  private _portClient: number;
  private _raftPort: number;
  private _leaderElectionTimeout: NodeJS.Timeout | null = null;
  private _heartbeatTimeout: NodeJS.Timeout | null = null;
  private _isSyncing: boolean = false;

  // Chaos simulation
  private _simulatedLatencyMs: number = 0;

  constructor({
    port,
    index,
    servers,
  }: {
    port: number;
    index: number;
    servers: ServerConfig[];
  }) {
    this._index = index;
    this._servers = servers;
    this._portClient = port;
    const selfServer = servers.find((s) => s.index === index);
    this._raftPort = selfServer ? selfServer.port : 7000 + index;

    this.log.push({
      type: LogType.Beat,
      args: [],
      index: 0,
      term: this.currentTerm,
    });

    this._store = new Store();
    this._docStore = new DocumentStore(index);

    // Reconstruct in-memory log from persisted documents
    const existingDocs = this._docStore.listDocuments();
    for (const meta of existingDocs) {
      const doc = this._docStore.getDocument(meta.fileId);
      if (doc) {
        this.log.push({
          type: LogType.DocUpload,
          args: [meta.fileId, JSON.stringify(meta), doc.buffer.toString("base64")],
          index: this.log.length,
          term: this.currentTerm,
        });
      }
    }
    this.commitIndex = this.log.length - 1;
    this.lastApplied = this.commitIndex;

    this.setupRaftHandler();
    this._expressRaft.listen(this._raftPort, () => {
      this.logToConsole(`Started Raft consensus server on port ${this._raftPort}`);
      this.resetLeaderElectionTimeout();
    });

    this.setupClientHandler();
    this._expressClient.listen(this._portClient, () => {
      this.logToConsole(`Started Client API / Storage server on port ${this._portClient}`);
    });
  }

  public cleanup() {
    if (this._heartbeatTimeout) clearTimeout(this._heartbeatTimeout);
    if (this._leaderElectionTimeout) clearTimeout(this._leaderElectionTimeout);
  }

  private logToConsole(...args: unknown[]) {
    console.log(`[Node ${this._index} | ${this.state} | Term ${this.currentTerm}]:`, ...args);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Fast catch-up state synchronization from Leader
  private async syncFromLeader(leaderId: number) {
    if (this._isSyncing || this.state === State.Leader) return;
    this._isSyncing = true;
    try {
      const leaderConfig = this._servers.find((s) => s.index === leaderId);
      const clientPort = leaderConfig?.clientPort || (5000 + leaderId);
      const res = await fetch(`http://localhost:${clientPort}/api/documents/sync-all`, {
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          nodeIndex: number;
          docCount: number;
          documents: Array<{ meta: DocumentMetadata; contentBase64: string }>;
        };

        if (data && Array.isArray(data.documents)) {
          let addedCount = 0;
          for (const item of data.documents) {
            if (!item.meta || !item.contentBase64) continue;
            const existing = this._docStore.getDocument(item.meta.fileId);
            if (!existing) {
              this._docStore.saveDocument(item.meta, item.contentBase64);
              const alreadyInLog = this.log.some(
                (l) => l.type === LogType.DocUpload && l.args[0] === item.meta.fileId
              );
              if (!alreadyInLog) {
                this.log.push({
                  type: LogType.DocUpload,
                  args: [item.meta.fileId, JSON.stringify(item.meta), item.contentBase64],
                  index: this.log.length,
                  term: this.currentTerm,
                });
              }
              addedCount++;
            }
          }
          if (addedCount > 0) {
            this.commitIndex = this.log.length - 1;
            this.logToConsole(`🔄 Catch-up Sync: retrieved ${addedCount} documents from Leader (Node ${leaderId}). Total docs: ${this._docStore.listDocuments().length}`);
          }
        }
      }
    } catch {
      // Leader not yet ready or network busy
    } finally {
      this._isSyncing = false;
    }
  }

  private setupClientHandler() {
    this._expressClient.use(cors());
    this._expressClient.use(express.json({ limit: "50mb" }));

    // Status endpoint for dashboard
    this._expressClient.get("/api/status", (_req, res) => {
      const stats = this._docStore.getStorageStats();
      res.json({
        nodeIndex: this._index,
        state: this.state,
        currentTerm: this.currentTerm,
        votedFor: this.votedFor,
        leaderId: this.leaderId,
        commitIndex: this.commitIndex,
        logLength: this.log.length,
        clientPort: this._portClient,
        raftPort: this._raftPort,
        storageStats: stats,
        simulatedLatencyMs: this._simulatedLatencyMs,
        clusterSize: this._servers.length,
        isAlive: true,
      });
    });

    // Dynamic membership update endpoint
    this._expressClient.post("/api/cluster/update-members", (req, res) => {
      const { servers } = req.body as { servers: ServerConfig[] };
      if (Array.isArray(servers) && servers.length > 0) {
        this._servers = servers;
        this.logToConsole(`Updated membership list: ${servers.length} nodes registered.`);

        if (this.state === State.Leader) {
          for (const s of servers) {
            if (s.index !== this._index && this.nextIndex[s.index] === undefined) {
              this.nextIndex[s.index] = 1;
            }
          }
          this.heartbeat();
        } else if (this.leaderId !== null && this.leaderId !== this._index) {
          this.syncFromLeader(this.leaderId);
        }

        res.json({ success: true, count: servers.length });
      } else {
        res.status(400).json({ error: "Invalid servers list" });
      }
    });

    // Proactive full document sync for lagging / newly joined nodes
    this._expressClient.get("/api/documents/sync-all", (_req, res) => {
      const docs = this._docStore.listDocuments();
      const fullDocs = docs.map((meta) => {
        const doc = this._docStore.getDocument(meta.fileId);
        return {
          meta,
          contentBase64: doc ? doc.buffer.toString("base64") : "",
        };
      });
      res.json({
        nodeIndex: this._index,
        term: this.currentTerm,
        commitIndex: this.commitIndex,
        docCount: fullDocs.length,
        documents: fullDocs,
      });
    });

    // List documents stored on this node
    this._expressClient.get("/api/documents", (_req, res) => {
      const docs = this._docStore.listDocuments();
      res.json({
        nodeIndex: this._index,
        documents: docs,
      });
    });

    // Download document from this node
    this._expressClient.get("/api/documents/:fileId", (req, res) => {
      const fileId = req.params.fileId;
      const doc = this._docStore.getDocument(fileId);
      if (!doc) {
        res.status(404).json({ error: "Document not found on this node" });
        return;
      }

      res.setHeader("Content-Disposition", `attachment; filename="${doc.meta.fileName}"`);
      res.setHeader("Content-Type", doc.meta.mimeType || "application/octet-stream");
      res.send(doc.buffer);
    });

    // Verify document integrity
    this._expressClient.get("/api/documents/:fileId/integrity", (req, res) => {
      const check = this._docStore.verifyIntegrity(req.params.fileId);
      res.json(check);
    });

    // MapReduce Search (Map step on this node)
    this._expressClient.get("/api/search", (req, res) => {
      const query = (req.query.q as string) || "";
      const matches: SearchMatch[] = this._docStore.search(query);
      res.json({
        nodeIndex: this._index,
        query,
        matches,
      });
    });

    // Upload document endpoint (Forwarded to Leader or executed if Leader)
    this._expressClient.post("/api/documents/upload", upload.single("file"), async (req, res) => {
      if (this.state !== State.Leader) {
        const leaderConfig = this.leaderId !== null ? this._servers.find((s) => s.index === this.leaderId) : null;
        res.status(403).json({
          error: "NOT_LEADER",
          message: `Node ${this._index} is a follower. Write operations must go to the Leader.`,
          currentLeaderId: this.leaderId,
          leaderAddress: leaderConfig ? `http://localhost:${leaderConfig.clientPort || (5000 + (this.leaderId || 0))}` : null,
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const fileBuffer = req.file.buffer;
      const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      const fileId = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const contentBase64 = fileBuffer.toString("base64");

      const metadata: DocumentMetadata = {
        fileId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype || "application/octet-stream",
        size: req.file.size,
        sha256,
        uploadedAt: new Date().toISOString(),
        nodeIndex: this._index,
      };

      const entry: LogEntry = {
        type: LogType.DocUpload,
        args: [fileId, JSON.stringify(metadata), contentBase64],
        index: this.log.length,
        term: this.currentTerm,
      };

      this.logToConsole(`Leader received document: "${metadata.fileName}" (${metadata.size} bytes). Initiating Raft consensus...`);
      
      const quorumReached = await this.rpcAppendEntries([entry]);
      if (quorumReached) {
        this.log.push(entry);
        this.commitIndex = this.log.length - 1;
        this._docStore.saveDocument(metadata, contentBase64);
        this.logToConsole(`Quorum confirmed for "${metadata.fileName}". Successfully committed!`);
        res.json({
          success: true,
          message: "Document replicated across quorum and committed",
          document: metadata,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to achieve cluster consensus / quorum for document replication",
        });
      }
    });

    // Delete document (Replicated via Raft)
    this._expressClient.delete("/api/documents/:fileId", async (req, res) => {
      if (this.state !== State.Leader) {
        res.status(403).json({
          error: "NOT_LEADER",
          currentLeaderId: this.leaderId,
        });
        return;
      }

      const fileId = req.params.fileId;
      const entry: LogEntry = {
        type: LogType.DocDelete,
        args: [fileId],
        index: this.log.length,
        term: this.currentTerm,
      };

      const quorumReached = await this.rpcAppendEntries([entry]);
      if (quorumReached) {
        this.log.push(entry);
        this.commitIndex = this.log.length - 1;
        this._docStore.deleteDocument(fileId);
        res.json({ success: true, message: `Document ${fileId} deleted across cluster` });
      } else {
        res.status(500).json({ error: "Failed to replicate delete across cluster" });
      }
    });

    // Chaos toggle: inject artificial latency
    this._expressClient.post("/api/chaos/latency", (req, res) => {
      const ms = Number(req.body.ms || 0);
      this._simulatedLatencyMs = ms;
      this.logToConsole(`Simulated network latency set to ${ms}ms`);
      res.json({ simulatedLatencyMs: this._simulatedLatencyMs });
    });
  }

  private setupRaftHandler() {
    this._expressRaft.use(express.json({ limit: "50mb" }));

    this._expressRaft.post<{}, {}, AppendEntriesParams>(
      APPEND_ENTRIES_PATH,
      async (req, res) => {
        if (this._simulatedLatencyMs > 0) {
          await this.delay(this._simulatedLatencyMs);
        }
        const result = this.AppendEntries(req.body);
        res.send(result);
      }
    );

    this._expressRaft.post<{}, {}, RequestVoteParams>(
      REQUEST_VOTE_PATH,
      async (req, res) => {
        if (this._simulatedLatencyMs > 0) {
          await this.delay(this._simulatedLatencyMs);
        }
        const result = this.RequestVote(req.body);
        res.send(result);
      }
    );
  }

  private async heartbeat() {
    if (this.state !== State.Leader) return;

    if (this._heartbeatTimeout) clearTimeout(this._heartbeatTimeout);
    this._heartbeatTimeout = setTimeout(() => {
      this.heartbeat();
    }, 800);

    await this.rpcAppendEntries([], true);
  }

  private async rpcAppendEntries(newEntries: LogEntry[] = [], isHeartbeat: boolean = false): Promise<boolean> {
    if (this.state !== State.Leader) return false;

    const peers = this._servers.filter((s) => s.index !== this._index);
    let successVotes = 1; // Leader itself counts as 1 vote
    const currentDocCount = this._docStore.listDocuments().length;

    const promises = peers.map(async (s) => {
      try {
        const followerNextIdx = this.nextIndex[s.index] !== undefined ? this.nextIndex[s.index] : 1;
        
        let entriesToSend: LogEntry[];
        if (followerNextIdx < this.log.length) {
          // Follower is missing historical entries! Send all missing entries
          entriesToSend = this.log.slice(followerNextIdx);
          if (newEntries.length > 0) {
            entriesToSend = entriesToSend.concat(newEntries);
          }
        } else if (newEntries.length > 0) {
          entriesToSend = newEntries;
        } else {
          entriesToSend = [{
            type: LogType.Beat,
            args: [],
            index: this.log.length,
            term: this.currentTerm,
          }];
        }

        const prevLogIndex = Math.max(0, followerNextIdx - 1);
        const prevEntry = this.log[prevLogIndex];
        const prevLogTerm = prevEntry ? prevEntry.term : 0;

        const res = await fetch(s.address + APPEND_ENTRIES_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: this.currentTerm,
            leaderId: this._index,
            prevLogIndex,
            prevLogTerm,
            entries: entriesToSend,
            leaderCommit: this.commitIndex,
            leaderDocCount: currentDocCount,
          }),
          signal: AbortSignal.timeout(1500),
        });

        if (res.ok) {
          const data = (await res.json()) as { term: number; success: boolean };
          if (data && data.success) {
            successVotes++;
            this.nextIndex[s.index] = this.log.length + newEntries.length;
            this.matchIndex[s.index] = this.nextIndex[s.index] - 1;
          }
        }
      } catch {
        // Node unreachable / failed
      }
    });

    await Promise.all(promises);

    // Quorum condition: majority (e.g. > N/2)
    const majority = Math.floor(this._servers.length / 2) + 1;
    return successVotes >= majority;
  }

  private async rpcRequestVote(): Promise<boolean> {
    if (this.state !== State.Candidate) return false;

    const peers = this._servers.filter((s) => s.index !== this._index);
    let votesReceived = 1; // Votes for itself

    const promises = peers.map(async (s) => {
      try {
        const lastEntry = this.log[this.log.length - 1];
        const res = await fetch(s.address + REQUEST_VOTE_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: this.currentTerm,
            candidateId: this._index,
            lastLogIndex: this.log.length - 1,
            lastLogTerm: lastEntry ? lastEntry.term : 0,
          }),
          signal: AbortSignal.timeout(1200),
        });

        if (res.ok) {
          const data = (await res.json()) as { term: number; voteGranted: boolean };
          if (data && data.voteGranted) {
            votesReceived++;
          }
        }
      } catch {
        // Node offline
      }
    });

    await Promise.all(promises);
    const majority = Math.floor(this._servers.length / 2) + 1;
    return votesReceived >= majority;
  }

  private moveToLeader() {
    this.state = State.Leader;
    this.leaderId = this._index;
    if (this._leaderElectionTimeout) {
      clearTimeout(this._leaderElectionTimeout);
      this._leaderElectionTimeout = null;
    }
    this._servers.forEach((s) => {
      if (s.index !== this._index) {
        this.nextIndex[s.index] = 1;
        this.matchIndex[s.index] = 0;
      }
    });
    this.logToConsole(`🏆 Crowned as LEADER for Term ${this.currentTerm}! Starting heartbeats...`);
    this.heartbeat();
  }

  private async moveToCandidate() {
    this.state = State.Candidate;
    this.currentTerm++;
    this.votedFor = this._index;
    this.logToConsole(`Election timeout expired. Transitioned to CANDIDATE for Term ${this.currentTerm}. Requesting votes...`);

    const wonElection = await this.rpcRequestVote();
    if (wonElection && this.state === State.Candidate) {
      this.moveToLeader();
    } else {
      this.state = State.Follower;
      this.resetLeaderElectionTimeout();
      this.logToConsole(`Election inconclusive. Returned to FOLLOWER.`);
    }
  }

  private resetLeaderElectionTimeout() {
    if (this._leaderElectionTimeout) clearTimeout(this._leaderElectionTimeout);
    // Randomized election timeout between 1500ms and 3000ms
    const timeout = 1500 + Math.random() * 1500;
    this._leaderElectionTimeout = setTimeout(() => {
      this.moveToCandidate();
    }, timeout);
  }

  private AppendEntries({
    term,
    leaderId,
    entries,
    leaderCommit,
    leaderDocCount,
  }: AppendEntriesParams): { term: number; success: boolean } {
    if (term < this.currentTerm) {
      return { term: this.currentTerm, success: false };
    }

    if (term > this.currentTerm) {
      this.currentTerm = term;
      this.state = State.Follower;
      this.votedFor = null;
      if (this._heartbeatTimeout) {
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = null;
      }
    } else if (this.state === State.Candidate) {
      this.state = State.Follower;
    }

    this.leaderId = leaderId;
    this.resetLeaderElectionTimeout();

    const nonHeartbeatEntries = entries.filter((e) => e.type !== LogType.Beat);
    if (nonHeartbeatEntries.length > 0) {
      for (const entry of nonHeartbeatEntries) {
        if (entry.type === LogType.DocUpload) {
          const fileId = entry.args[0];
          const meta: DocumentMetadata = JSON.parse(entry.args[1]);
          const contentBase64 = entry.args[2];
          this._docStore.saveDocument(meta, contentBase64);
          
          const alreadyInLog = this.log.some(
            (l) => l.type === LogType.DocUpload && l.args[0] === fileId
          );
          if (!alreadyInLog) {
            this.log.push(entry);
          }
          this.logToConsole(`Replicated and saved document: ${meta.fileName} (id: ${fileId})`);
        } else if (entry.type === LogType.DocDelete) {
          const fileId = entry.args[0];
          this._docStore.deleteDocument(fileId);
          this.log.push(entry);
          this.logToConsole(`Replicated deletion of document: ${fileId}`);
        }
      }
      this.commitIndex = Math.min(leaderCommit, this.log.length - 1);
    } else {
      this.commitIndex = Math.min(leaderCommit, this.log.length - 1);
    }

    // Proactive check: if leader has more documents than us, trigger catch-up sync
    if (leaderDocCount !== undefined && leaderDocCount > this._docStore.listDocuments().length) {
      this.syncFromLeader(leaderId);
    }

    return { term: this.currentTerm, success: true };
  }

  private RequestVote({
    term,
    candidateId,
  }: RequestVoteParams): { term: number; voteGranted: boolean } {
    if (term < this.currentTerm) {
      return { term: this.currentTerm, voteGranted: false };
    }

    if (term > this.currentTerm) {
      this.currentTerm = term;
      this.state = State.Follower;
      this.votedFor = null;
    }

    if (this.votedFor === null || this.votedFor === candidateId) {
      this.votedFor = candidateId;
      this.resetLeaderElectionTimeout();
      this.logToConsole(`Voted YES for candidate Node ${candidateId} in Term ${term}`);
      return { term: this.currentTerm, voteGranted: true };
    }

    return { term: this.currentTerm, voteGranted: false };
  }
}

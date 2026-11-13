# 🌐 RaftFS: Distributed Document Storage & Consensus Cluster

A fault-tolerant, replicated distributed document storage system and distributed MapReduce search engine built on top of the **Raft Consensus Protocol**.

Designed for **Cloud & Distributed Computing** courses to demonstrate core theoretical and practical distributed systems concepts.

---

## 🌟 Key Distributed Computing Concepts Demonstrated

1. **Raft Distributed Consensus Algorithm:**
   * **Leader Election:** Heartbeat timeouts trigger automated election with randomized backoff (`1500ms - 3000ms`) preventing split-vote scenarios.
   * **Quorum Agreement:** Write operations must be acknowledged by a majority ($\lfloor N/2 \rfloor + 1$) before being committed.
   * **Log Replication:** AppendEntries RPCs keep follower state machines synchronized with the leader.
2. **Transparent Client Request Routing:**
   * File uploads sent to the cluster gateway are dynamically routed to whichever node holds the active leadership crown.
3. **Distributed MapReduce Full-Text Search:**
   * **Map Phase:** Search queries are broadcast in parallel across all healthy storage nodes.
   * **Reduce Phase:** Results from individual nodes are consolidated, deduplicated, and returned with latency metrics.
4. **Chaos Engineering & Self-Healing:**
   * Built-in chaos controls allow you to crash any node (`Ctrl+C` or the UI `Crash Node` button) and watch the cluster detect the dead leader, conduct an instant election, and continue serving traffic with zero data loss.
5. **Content-Addressable Storage & Cryptographic Verification:**
   * Files are stored alongside SHA-256 integrity hashes to detect file tampering or bit-rot across replicas.

---

## 🏗️ System Architecture

```
                                [ Web Browser / Client ]
                                           |
                                [ Cluster Orchestrator ]
                                   (Port :3000 Dashboard)
                                           |
                        +------------------+------------------+
                        | (Auto-routed to active Leader)      |
                        v                                     v
                 [ Node 0 ] ◄======= Raft Heartbeats =====► [ Node 1 ]
               Client: :5000                               Client: :5001
                Raft: :7000                                 Raft: :7001
                 Storage/0                                   Storage/1
                        ▲                                     ▲
                        ║               Raft RPCs             ║
                        ╚══════════════► [ Node 2 ] ◄═════════╝
                                       Client: :5002
                                        Raft: :7002
                                         Storage/2
```

---

## 🚀 Quick Start (Running on Your PC)

### Option 1: Double-click
Simply double-click the **`run.bat`** file inside `D:\CDC_Project\raft-node\`. It will start all nodes and open your browser automatically.

### Option 2: Command Line
```powershell
cd D:\CDC_Project\raft-node
npm start
```

Open your browser at: **`http://localhost:3000`**

---

## 🧪 Step-by-Step Live Demo for Presentation / Viva

Follow these steps to demonstrate your project to an evaluator or professor:

1. **Show Normal Operation:**
   * Open `http://localhost:3000`. Point out the active **Leader 👑** and the **Followers 🟢**.
   * Note the status: **"Quorum Active (3/3 Nodes Healthy)"**.
2. **Upload a Document:**
   * Drag-and-drop or select any file (PDF, TXT, DOCX, Code).
   * Click **Replicate to Cluster**.
   * Show that the file is physically committed inside all 3 node storage folders:
     * `D:\CDC_Project\raft-node\storage\node_0`
     * `D:\CDC_Project\raft-node\storage\node_1`
     * `D:\CDC_Project\raft-node\storage\node_2`
3. **Execute Distributed MapReduce Search:**
   * Type a word found in your document into the search bar.
   * Click **Run MapReduce**.
   * Explain how the query was mapped simultaneously to Nodes [0, 1, 2] and reduced into aggregated results with millisecond timing.
4. **Demonstrate Fault Tolerance (The Killer Feature):**
   * On the dashboard, find whichever node is the **Leader 👑**.
   * Click **🔥 Crash Node**.
   * Watch the live event log:
     1. Heartbeat stops.
     2. A follower node's election timer expires.
     3. It transitions to `Candidate`, requests votes, and is crowned the new `Leader` for the next Term!
   * Notice that the dashboard and downloads **still work 100% normally** because 2/3 nodes form a quorum!
5. **Demonstrate Self-Healing:**
   * Click **⚡ Revive Node**.
   * The node re-boots, reconnects to the cluster, accepts leader heartbeats, and re-enters the active topology seamlessly.

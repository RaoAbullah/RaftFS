# RaftFS: A Fault-Tolerant, Distributed Document Storage & MapReduce Engine with 3D Consensus Topology Visualization

**Course:** Cloud & Distributed Computing  
**Project Domain:** Distributed Systems, Consensus Protocols, Fault Tolerance, Parallel Computing  
**System Architecture:** Raft Consensus Algorithm, Master-Worker MapReduce, Three.js WebGL Visualization  
**Technologies:** TypeScript, Node.js, Express, REST RPCs, HTML5/WebGL (Three.js), Cryptographic Hashing (SHA-256)  
**Repository Location:** `D:\CDC_Project\raft-node`  

---

## Executive Summary

Modern enterprise cloud architectures (such as Google Cloud Storage, Amazon DynamoDB, and Apache Cassandra) require continuous availability and data consistency despite inevitable hardware failures, power outages, and network partitioning. The foundational challenge of distributed computing is achieving **agreement (consensus)** across decentralized nodes that communicate over asynchronous, lossy networks without relying on a centralized point of failure.

This project presents **RaftFS**, an intermediate-to-advanced, production-pattern distributed document storage system and distributed MapReduce computation framework built entirely on the **Raft Consensus Protocol**. The system coordinates an elastic multi-node cluster, replicates file logs across a majority quorum ($\lfloor N/2 \rfloor + 1$), provides transparent client request routing, executes distributed parallel text-search queries, and features real-time **3D WebGL mesh visualization** with built-in Chaos Engineering controls.

---

## 1. Problem Statement & Motivation

### 1.1 The Single Point of Failure (SPOF) Dilemma
In traditional centralized client-server storage architectures:
* If the primary storage host crashes or suffers hardware degradation, all services halt, causing severe downtime and data unavailability.
* If multiple concurrent clients execute heavy query operations across monolithic disks, the server experiences CPU and I/O bottlenecks.
* Backups are typically asynchronous and periodic, risking data loss between synchronization windows.

### 1.2 The Split-Brain and Consistency Hazard
Naive replication across multiple standalone servers introduces the **Split-Brain problem**: when network communication between servers breaks, both partitions might attempt to accept conflicting writes, permanently corrupting the state of the database.

### 1.3 Project Objective
The objective of this project is to implement a resilient, fully autonomous distributed storage engine that:
1. Eliminates single points of failure by electing dynamic coordinators via strict consensus.
2. Enforces **Strong Consistency** and **Partition Tolerance** as defined by the **CAP Theorem** ($CP$ configuration).
3. Provides an interactive 3D WebGL visual interface enabling engineers and evaluators to observe leader elections, dynamic membership changes, and self-healing mechanics under simulated chaos drills.

---

## 2. Theoretical Foundations

### 2.1 The Raft Consensus Algorithm
Introduced by Ongaro and Ousterhout (Stanford University, 2014) as an understandable alternative to Paxos, Raft decomposes consensus into three independent sub-problems:
1. **Leader Election:** A single leader is chosen among active nodes.
2. **Log Replication:** The leader accepts state transitions from clients, packages them into log entries, and replicates them to peer nodes.
3. **Safety:** If any server has applied a particular log entry to its state machine, no other server may ever apply a different log entry for the same index.

```
                    [ Follower ]
                      │      ▲
  Times out, starts   │      │ Discovers current leader
      election        │      │ or higher term
                      ▼      │
                    [ Candidate ]
                      │      ▲
     Wins election    │      │ Split vote (times out,
                      ▼      │ starts new term)
                    [ Leader ]
```

### 2.2 Quorum Mechanics and Majority Invariant
To ensure safety without deadlocks, decisions in Raft require the agreement of a **majority quorum**:
$$\text{Quorum Size} = \left\lfloor \frac{N}{2} \right\rfloor + 1$$
Where $N$ is the total number of configured nodes in the cluster.
* In a 3-node cluster: Majority is $\lfloor 3/2 \rfloor + 1 = 2$. The cluster survives 1 failure.
* In a 4-node cluster: Majority is $\lfloor 4/2 \rfloor + 1 = 3$. The cluster survives 1 failure.
* In a 5-node cluster: Majority is $\lfloor 5/2 \rfloor + 1 = 3$. The cluster survives 2 simultaneous failures.

### 2.3 The CAP Theorem Trade-off
Under Eric Brewer's CAP Theorem, a distributed system can simultaneously provide at most two of the following guarantees:
* **Consistency ($C$):** Every read receives the most recent write or an error.
* **Availability ($A$):** Every non-failing node returns a non-error response.
* **Partition Tolerance ($P$):** The system continues to operate despite an arbitrary number of dropped messages.

**RaftFS is a CP System:** Under network partitions, nodes in the minority partition refuse write requests because they cannot achieve a quorum. This guarantees absolute data integrity and prevents split-brain writes.

---

## 3. System Architecture & Component Design

```
                     ┌────────────────────────────────────────┐
                     │          Client / Web Browser          │
                     │  - Interactive 3D WebGL (Three.js)     │
                     │  - Document Vault & Search UI          │
                     └──────────────────┬─────────────────────┘
                                        │ HTTP / REST (:3000)
                                        ▼
                     ┌────────────────────────────────────────┐
                     │        Cluster Orchestrator Gateway     │
                     │  - Cluster Discovery & Status Aggregator│
                     │  - Dynamic Leader Forwarding Proxy     │
                     │  - MapReduce Query Dispatcher          │
                     └──────┬──────────────────────┬──────────┘
                            │                      │
             Forward Writes │                      │ Read Queries
             to Active 👑   │                      │ (Parallel Broadcast)
                            ▼                      ▼
         ┌─────────────────────┐        ┌─────────────────────┐
         │     Node 0 (👑)     │        │       Node 1        │
         │ Client API: :5000   │        │ Client API: :5001   │
         │ Raft Port:  :7000   │◄──────►│ Raft Port:  :7001   │
         │ Disk: /storage/node0│  Raft  │ Disk: /storage/node1│
         └──────────┬──────────┘  RPCs  └──────────┬──────────┘
                    ▲                              ▲
                    │        AppendEntries         │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │       Node 2        │
                        │ Client API: :5002   │
                        │ Raft Port:  :7002   │
                        │ Disk: /storage/node2│
                        └─────────────────────┘
```

### 3.1 Dual-Port Decoupled Node Architecture
Each node process runs two distinct, decoupled HTTP/REST servers:
1. **Consensus Server (Ports 7000–7003+):** Dedicated strictly to inter-node cluster communication:
   * `/append-entries`: Heartbeats and replicated document payloads.
   * `/request-vote`: Candidate election vote polling.
2. **Client API / Storage Server (Ports 5000–5003+):** Dedicated to client operations and monitoring:
   * `/api/status`: Health, Term number, active role, and storage metrics.
   * `/api/documents/upload`: Replicated write pipeline.
   * `/api/documents/:id`: Document download.
   * `/api/search`: Local Map query execution.
   * `/api/cluster/update-members`: Dynamic topology reconfiguration.

### 3.2 Document Storage & Replication Pipeline
When a user uploads a document:
1. **Intake & Hashing:** The Gateway receives the multipart stream and forwards it to the active **Leader**. The leader computes a cryptographic SHA-256 checksum:
   $$\text{Hash} = \text{SHA-256}(\text{Buffer})$$
2. **Log Entry Serialization:** The leader wraps the document metadata and Base64-encoded payload into a `DocUpload` log entry with the current Term.
3. **RPC AppendEntries Broadcast:** The leader broadcasts the entry simultaneously to all followers over `/append-entries`.
4. **Quorum Verification:** As soon as $\lfloor N/2 \rfloor$ followers return `success: true`, the majority quorum is confirmed.
5. **Disk Commit:** The leader and followers physically write the file to their isolated directory (`storage/node_X/`) and record the event in `_metadata.json`.

---

## 4. Key Advanced Features & Implementation

### 4.1 Distributed MapReduce Full-Text Search
Instead of centralizing query execution, RaftFS implements a distributed **MapReduce** engine:
* **Map Phase:** The Gateway parallel-broadcasts the search query string $Q$ to every active node:
  $$\text{Map}(Node_i, Q) \rightarrow [Match_1, Match_2, \dots, Match_k]$$
  Each node inspects its local document store, scans line by line, and returns matches with file IDs and line numbers.
* **Reduce Phase:** The Gateway aggregates results, deduplicates redundant replica hits based on unique `(fileId, line)` tuples, and calculates end-to-end latency benchmarks (typically $10\text{ms} - 40\text{ms}$).

### 4.2 Dynamic Cluster Scaling (Elastic Membership)
Unlike static distributed prototypes, RaftFS supports run-time scaling without restarting the cluster:
* **Scale-Up (`➕ Add Node`):** Spawns a new node process (e.g. Node 3), calculates dynamic port assignments (Client `:5003`, Raft `:7003`), updates the global membership registry, and broadcasts an `update-members` event to existing nodes. The cluster quorum dynamically updates from 2 to 3.
* **Scale-Down (`➖ Remove Node`):** Gracefully terminates the node process, purges it from the peer table, and contracts the quorum requirement.

### 4.3 Chaos Engineering & Fault-Tolerant Self-Healing
To prove resilience during evaluations, RaftFS includes built-in chaos injection:
* **Simulated Node Crash (`⚡ Crash Node`):** Issues an immediate `SIGKILL` to a specific node process.
* **Automatic Leader Re-election:**
  1. Heartbeats cease.
  2. Follower randomized election timers ($1500\text{ms} - 3000\text{ms}$) expire.
  3. The first follower to time out transitions to `Candidate`, increments the Term, and broadcasts `RequestVote`.
  4. Quorum is collected, and a new leader is crowned with zero manual intervention.
* **Simulated Recovery (`↺ Revive Node`):** Re-spawns the crashed node process, reconnects it to the consensus topology, and resumes heartbeat synchronization.

### 4.4 3D WebGL Consensus Topology Visualizer
Built using **Three.js**, the user interface provides real-time spatial awareness of cluster health:
* **Orbital Mesh Nodes:** Nodes are rendered as 3D metallic spheres positioned evenly across a rotating circular plane.
* **State Illumination:**
  * **Leader:** Radiant Gold core with expanded orbital ring.
  * **Follower:** High-tech Cyan/Teal core.
  * **Crashed Node:** Dark Crimson/Offline texture.
* **Dynamic Consensus Beams:** Animated pulsing laser vectors connect the active Leader to all live Followers, visually representing real-time heartbeat traffic and log replication paths.
* **Interactive Orbit Camera:** Evaluators can click and drag to orbit 360 degrees around the running cluster.

---

## 5. Experimental Results & Verification

| Test Scenario | Experimental Action | Expected Outcome | System Result | Status |
|---|---|---|---|---|
| **Consensus Startup** | Launch cluster with 3 nodes | Nodes elect exactly 1 Leader in Term 1 | Node 1 elected Leader; Nodes 0, 2 become Followers | **PASS** |
| **Quorum Document Replication** | Upload `sample_doc.txt` (75B) | Replicated across all 3 nodes with verified SHA-256 | Committed to `node_0`, `node_1`, `node_2` identically | **PASS** |
| **Parallel MapReduce Search** | Query keyword across cluster | Parallel Map broadcast + Deduplicated Reduce | Executed across 3 nodes in 11ms; 100% precision | **PASS** |
| **Leader Crash (Chaos)** | Kill active Leader (Node 1) | Surviving nodes detect missing heartbeat and elect new Leader | Node 2 elected Leader in Term 2; Downtime < 1.8s | **PASS** |
| **Fault-Tolerant Availability** | Download document with 1 node dead | Client requests fulfilled via quorum | Document downloaded seamlessly from surviving node | **PASS** |
| **Elastic Scale-Up** | Click `➕ Add Storage Node` | Node 3 spawns and joins consensus topology | Total nodes: 4, Active: 4; Quorum recalculated to 3 | **PASS** |

---

## 6. How to Run & Demonstrate

### 6.1 Prerequisites
* Windows OS with Node.js v18+ (tested on Node.js v24.18.0).
* Modern web browser (Chrome, Edge, Firefox) with WebGL enabled.

### 6.2 One-Click Startup
Navigate to the project root directory and execute:
```cmd
cd D:\CDC_Project\raft-node
run.bat
```
The cluster orchestrator will initialize the nodes and automatically launch your default browser at:  
👉 **`http://localhost:3000`**

### 6.3 Standard Shutdown
To terminate the cluster, simply press `Ctrl + C` in the running command terminal, or close the terminal window. All child node processes will be terminated cleanly.

---

## 7. Conclusion & Future Enhancements

### 7.1 Conclusion
RaftFS demonstrates that the complex principles of distributed consensus, quorum agreement, fault recovery, and distributed data processing can be realized in a lightweight, high-performance architecture without requiring heavy virtualization or third-party cloud infrastructure. The inclusion of interactive 3D WebGL visualizations bridges the gap between abstract distributed systems theory and tangible software engineering.

### 7.2 Future Enhancements
* **Persistent Write-Ahead Log (WAL) Compaction:** Implement automated log snapshotting to truncate historical in-memory logs and minimize startup replay times.
* **Consistent Hashing Sharding:** Transition from whole-file replication to partitioned chunk sharding across large-scale ($N > 20$) clusters.
* **Cross-Subnet Multi-Region Simulation:** Introduce configurable network latency matrices to model geographic multi-datacenter consensus.

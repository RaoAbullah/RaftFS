import { RaftNode } from "./node";

const port = Number(process.argv[2]);
const index = Number(process.argv[3]);
const servers = process.argv[4].split(",");

const node = new RaftNode({
  port,
  index,
  servers: servers.map((s, i) => {
    const p = Number(s.split(":")[2]);
    const derivedIndex = p >= 7000 ? p - 7000 : i;
    return {
      index: derivedIndex,
      address: s,
      port: p,
      clientPort: 5000 + derivedIndex,
    };
  }),
});

process.on("SIGTERM", () => {
  node.cleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  node.cleanup();
  process.exit(0);
});

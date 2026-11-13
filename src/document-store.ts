import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as zlib from "node:zlib";

export interface DocumentMetadata {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  nodeIndex: number;
}

export interface SearchMatch {
  fileId: string;
  fileName: string;
  matchSnippet: string;
  line: number;
}

export class DocumentStore {
  private nodeIndex: number;
  private storageDir: string;
  private metadataFile: string;
  private metadataMap: Map<string, DocumentMetadata> = new Map();

  constructor(nodeIndex: number) {
    this.nodeIndex = nodeIndex;
    this.storageDir = path.resolve(process.cwd(), "storage", `node_${nodeIndex}`);
    this.metadataFile = path.join(this.storageDir, "_metadata.json");

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.loadMetadata();
  }

  private loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const raw = fs.readFileSync(this.metadataFile, "utf-8");
        const list: DocumentMetadata[] = JSON.parse(raw);
        list.forEach((doc) => this.metadataMap.set(doc.fileId, doc));
      }
    } catch (err) {
      console.error(`[Node ${this.nodeIndex}] Failed to read metadata file:`, err);
    }
  }

  private saveMetadata() {
    try {
      const list = Array.from(this.metadataMap.values());
      fs.writeFileSync(this.metadataFile, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error(`[Node ${this.nodeIndex}] Failed to write metadata file:`, err);
    }
  }

  public saveDocument(meta: DocumentMetadata, contentBase64: string): boolean {
    try {
      const buffer = Buffer.from(contentBase64, "base64");
      const computedHash = crypto.createHash("sha256").update(buffer).digest("hex");

      if (computedHash !== meta.sha256) {
        console.warn(`[Node ${this.nodeIndex}] Checksum mismatch for ${meta.fileName}! Expected ${meta.sha256}, got ${computedHash}`);
      }

      const filePath = path.join(this.storageDir, meta.fileId);
      fs.writeFileSync(filePath, buffer);

      this.metadataMap.set(meta.fileId, meta);
      this.saveMetadata();
      console.log(`[Node ${this.nodeIndex}] Saved document: ${meta.fileName} (${meta.size} bytes)`);
      return true;
    } catch (err) {
      console.error(`[Node ${this.nodeIndex}] Error saving document:`, err);
      return false;
    }
  }

  public deleteDocument(fileId: string): boolean {
    try {
      const filePath = path.join(this.storageDir, fileId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.metadataMap.delete(fileId);
      this.saveMetadata();
      console.log(`[Node ${this.nodeIndex}] Deleted document ${fileId}`);
      return true;
    } catch (err) {
      console.error(`[Node ${this.nodeIndex}] Error deleting document:`, err);
      return false;
    }
  }

  public getDocument(fileId: string): { meta: DocumentMetadata; buffer: Buffer } | null {
    const meta = this.metadataMap.get(fileId);
    if (!meta) return null;

    const filePath = path.join(this.storageDir, fileId);
    if (!fs.existsSync(filePath)) return null;

    const buffer = fs.readFileSync(filePath);
    return { meta, buffer };
  }

  public listDocuments(): DocumentMetadata[] {
    return Array.from(this.metadataMap.values());
  }

  public verifyIntegrity(fileId: string): { intact: boolean; calculatedHash: string; expectedHash: string } {
    const meta = this.metadataMap.get(fileId);
    if (!meta) return { intact: false, calculatedHash: "", expectedHash: "" };

    const filePath = path.join(this.storageDir, fileId);
    if (!fs.existsSync(filePath)) return { intact: false, calculatedHash: "FILE_MISSING", expectedHash: meta.sha256 };

    const buffer = fs.readFileSync(filePath);
    const calculated = crypto.createHash("sha256").update(buffer).digest("hex");
    return {
      intact: calculated === meta.sha256,
      calculatedHash: calculated,
      expectedHash: meta.sha256,
    };
  }

  public search(query: string): SearchMatch[] {
    if (!query || query.trim() === "") return [];
    const qLower = query.toLowerCase().trim();
    const results: SearchMatch[] = [];

    for (const [fileId, meta] of this.metadataMap.entries()) {
      const filePath = path.join(this.storageDir, fileId);
      if (!fs.existsSync(filePath)) continue;

      let fileMatches = 0;

      // 1. Match in File Name
      if (meta.fileName.toLowerCase().includes(qLower)) {
        results.push({
          fileId,
          fileName: meta.fileName,
          matchSnippet: `Matched in File Name: "${meta.fileName}"`,
          line: 1,
        });
        fileMatches++;
      }

      try {
        const buffer = fs.readFileSync(filePath);
        
        // 2. Plain Text / Code / Markdown search
        const utf8Text = buffer.toString("utf-8");
        const lines = utf8Text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          if (lineText.toLowerCase().includes(qLower)) {
            results.push({
              fileId,
              fileName: meta.fileName,
              matchSnippet: lineText.trim().substring(0, 150),
              line: i + 1,
            });
            fileMatches++;
            if (fileMatches >= 5) break;
          }
        }

        // 3. If file is a PDF: scan uncompressed streams & binary text blocks
        if (fileMatches < 5 && meta.fileName.toLowerCase().endsWith(".pdf")) {
          const raw = buffer.toString("latin1");

          // Try decompressing PDF zlib streams
          const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
          let match: RegExpExecArray | null;
          let streamIndex = 0;
          while ((match = streamRegex.exec(raw)) !== null && fileMatches < 5) {
            streamIndex++;
            try {
              const decompressed = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("utf-8");
              if (decompressed.toLowerCase().includes(qLower)) {
                const streamLines = decompressed.split(/\r?\n/).filter((l) => l.toLowerCase().includes(qLower));
                results.push({
                  fileId,
                  fileName: meta.fileName,
                  matchSnippet: (streamLines[0] || decompressed).trim().substring(0, 150),
                  line: streamIndex,
                });
                fileMatches++;
              }
            } catch {
              // Ignore uncompressed or image stream
            }
          }

          // Fallback: extract human-readable words from PDF
          if (fileMatches === 0) {
            const words = raw.match(/[A-Za-z0-9_\-\. ]{3,}/g) || [];
            for (let i = 0; i < words.length; i++) {
              if (words[i].toLowerCase().includes(qLower)) {
                results.push({
                  fileId,
                  fileName: meta.fileName,
                  matchSnippet: `Extracted string: "${words[i].trim().substring(0, 120)}"`,
                  line: i + 1,
                });
                fileMatches++;
                if (fileMatches >= 5) break;
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Node ${this.nodeIndex}] Error scanning document ${meta.fileName}:`, err);
      }
    }

    return results;
  }

  public getStorageStats(): { docCount: number; totalSizeBytes: number; storagePath: string } {
    let totalSize = 0;
    for (const meta of this.metadataMap.values()) {
      totalSize += meta.size;
    }
    return {
      docCount: this.metadataMap.size,
      totalSizeBytes: totalSize,
      storagePath: this.storageDir,
    };
  }
}

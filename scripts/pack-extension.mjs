// Packs ./extension into public/digestbot-extension.zip (served at /digestbot-extension.zip).
// Runs before every build ("prebuild"). Minimal ZIP writer: deflate + CRC-32, no dependencies.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.join(import.meta.dirname, "..");
const src = path.join(root, "extension");
const dest = path.join(root, "public", "digestbot-extension.zip");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function listFiles(dir, base = "") {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]));
}

// Fixed timestamp (2026-01-01 00:00) so the archive is reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const locals = [];
const centrals = [];
let offset = 0;
for (const name of listFiles(src)) {
  const data = fs.readFileSync(path.join(src, name));
  const packed = zlib.deflateRawSync(data, { level: 9 });
  const nameBuf = Buffer.from(`digestbot-extension/${name}`, "utf8");
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, nameBuf, packed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // made by
  central.writeUInt16LE(20, 6); // needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, nameBuf);

  offset += local.length + nameBuf.length + packed.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(centrals.length / 2, 8);
end.writeUInt16LE(centrals.length / 2, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, Buffer.concat([...locals, ...centrals, end]));
const version = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8")).version;
console.log(`[pack-extension] v${version}: ${centrals.length / 2} files → public/digestbot-extension.zip (${fs.statSync(dest).size} bytes)`);

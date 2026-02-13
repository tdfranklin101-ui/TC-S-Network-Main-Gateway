'use strict';

const crypto = require('crypto');

/**
 * TC-S Network 3D Artifact Service
 * Parametric 3D model generation, SHA-256 hashing, validation, and Factory Mode management.
 * Uses only Node.js built-in modules — no external dependencies.
 * @module artifact3d-service
 */

// ============================================================================
// SECTION 1: STL Geometry Helpers
// ============================================================================

/**
 * Compute a face normal from three vertices (counter-clockwise winding).
 * @param {number[]} v0 - [x,y,z]
 * @param {number[]} v1 - [x,y,z]
 * @param {number[]} v2 - [x,y,z]
 * @returns {number[]} [nx, ny, nz]
 */
function computeNormal(v0, v1, v2) {
  const ux = v1[0] - v0[0], uy = v1[1] - v0[1], uz = v1[2] - v0[2];
  const vx = v2[0] - v0[0], vy = v2[1] - v0[1], vz = v2[2] - v0[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Generate triangles for an axis-aligned box.
 * @param {number} x - Origin X
 * @param {number} y - Origin Y
 * @param {number} z - Origin Z
 * @param {number} w - Width  (along X)
 * @param {number} d - Depth  (along Y)
 * @param {number} h - Height (along Z)
 * @returns {Array<{normal:number[], vertices:number[][]}>}
 */
function createBoxTriangles(x, y, z, w, d, h) {
  const x1 = x + w, y1 = y + d, z1 = z + h;
  const corners = [
    [x,  y,  z ],  // 0 - front-bottom-left
    [x1, y,  z ],  // 1 - front-bottom-right
    [x1, y1, z ],  // 2 - back-bottom-right
    [x,  y1, z ],  // 3 - back-bottom-left
    [x,  y,  z1],  // 4 - front-top-left
    [x1, y,  z1],  // 5 - front-top-right
    [x1, y1, z1],  // 6 - back-top-right
    [x,  y1, z1],  // 7 - back-top-left
  ];

  const faces = [
    [0, 1, 5, 4], // front  (−Y normal)
    [2, 3, 7, 6], // back   (+Y normal)
    [3, 0, 4, 7], // left   (−X normal)
    [1, 2, 6, 5], // right  (+X normal)
    [4, 5, 6, 7], // top    (+Z normal)
    [3, 2, 1, 0], // bottom (−Z normal)
  ];

  const triangles = [];
  for (const f of faces) {
    const v0 = corners[f[0]], v1 = corners[f[1]], v2 = corners[f[2]], v3 = corners[f[3]];
    const n1 = computeNormal(v0, v1, v2);
    triangles.push({ normal: n1, vertices: [v0, v1, v2] });
    const n2 = computeNormal(v0, v2, v3);
    triangles.push({ normal: n2, vertices: [v0, v2, v3] });
  }
  return triangles;
}

/**
 * Generate triangles for a cylinder (vertical, along Z axis).
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} z  - Base Z
 * @param {number} r  - Radius
 * @param {number} h  - Height
 * @param {number} [segments=16] - Number of radial segments
 * @returns {Array<{normal:number[], vertices:number[][]}>}
 */
function createCylinderTriangles(cx, cy, z, r, h, segments) {
  segments = segments || 16;
  const triangles = [];
  const topZ = z + h;

  for (let i = 0; i < segments; i++) {
    const a0 = (2 * Math.PI * i) / segments;
    const a1 = (2 * Math.PI * ((i + 1) % segments)) / segments;
    const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

    const bx0 = cx + r * cos0, by0 = cy + r * sin0;
    const bx1 = cx + r * cos1, by1 = cy + r * sin1;

    // Side quad (two triangles)
    const sb = [bx0, by0, z], st = [bx0, by0, topZ];
    const eb = [bx1, by1, z], et = [bx1, by1, topZ];
    const sn1 = computeNormal(sb, eb, et);
    triangles.push({ normal: sn1, vertices: [sb, eb, et] });
    const sn2 = computeNormal(sb, et, st);
    triangles.push({ normal: sn2, vertices: [sb, et, st] });

    // Top cap
    const tc = [cx, cy, topZ];
    const tn = computeNormal(tc, st, et);
    triangles.push({ normal: tn, vertices: [tc, st, et] });

    // Bottom cap
    const bc = [cx, cy, z];
    const bn = computeNormal(bc, eb, sb);
    triangles.push({ normal: bn, vertices: [bc, eb, sb] });
  }
  return triangles;
}

/**
 * Pack an array of triangles into a binary STL buffer.
 * @param {Array<{normal:number[], vertices:number[][]}>} triangles
 * @param {string} [headerText='TC-S Network 3D Artifact']
 * @returns {Buffer}
 */
function packSTL(triangles, headerText) {
  headerText = headerText || 'TC-S Network 3D Artifact';
  const triCount = triangles.length;
  const bufSize = 80 + 4 + triCount * 50;
  const buf = Buffer.alloc(bufSize);

  // 80-byte header
  const hdr = Buffer.alloc(80);
  hdr.write(headerText.substring(0, 80), 'ascii');
  hdr.copy(buf, 0);

  // Triangle count (uint32 LE)
  buf.writeUInt32LE(triCount, 80);

  let offset = 84;
  for (const tri of triangles) {
    // Normal
    buf.writeFloatLE(tri.normal[0], offset);      offset += 4;
    buf.writeFloatLE(tri.normal[1], offset);      offset += 4;
    buf.writeFloatLE(tri.normal[2], offset);      offset += 4;
    // Three vertices
    for (const v of tri.vertices) {
      buf.writeFloatLE(v[0], offset); offset += 4;
      buf.writeFloatLE(v[1], offset); offset += 4;
      buf.writeFloatLE(v[2], offset); offset += 4;
    }
    // Attribute byte count
    buf.writeUInt16LE(0, offset); offset += 2;
  }
  return buf;
}

// ============================================================================
// SECTION 2: SHA-256 Hashing
// ============================================================================

/**
 * Hash a buffer using SHA-256.
 * @param {Buffer} buffer
 * @returns {string} Hex-encoded hash
 */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ============================================================================
// SECTION 3: Template Registry
// ============================================================================

/**
 * Calculate Solar price from estimated print time.
 * @param {number} printMinutes
 * @param {number} [printerWatts=200]
 * @returns {number} Solar price
 */
function calcSolarPrice(printMinutes, printerWatts) {
  printerWatts = printerWatts || 200;
  const kwhFootprint = (printerWatts / 1000) * (printMinutes / 60);
  return parseFloat((kwhFootprint / 4913).toFixed(8));
}

/** @type {Object.<string, object>} */
const TEMPLATES = {};

function registerTemplate(t) {
  t.basePriceSolar = calcSolarPrice(t.estimatedPrintMinutes);
  t.kwhFootprint = parseFloat(((200 / 1000) * (t.estimatedPrintMinutes / 60)).toFixed(4));
  TEMPLATES[t.id] = t;
}

// ---- desk-caddy ----
registerTemplate({
  id: 'desk-caddy',
  name: 'Desk Caddy',
  description: 'Customizable pen and pencil holder with configurable compartments',
  category: 'Productivity',
  defaultParams: { width: 80, depth: 60, height: 100, compartments: 3, wallThickness: 2 },
  paramSchema: {
    width:         { min: 40,  max: 200, unit: 'mm' },
    depth:         { min: 30,  max: 150, unit: 'mm' },
    height:        { min: 50,  max: 200, unit: 'mm' },
    compartments:  { min: 1,   max: 6,   unit: 'count' },
    wallThickness: { min: 1,   max: 5,   unit: 'mm' },
  },
  estimatedPrintMinutes: 120,
  estimatedFilamentGrams: 35,
  tags: ['office', 'organizer', 'desk'],
  generate(p) {
    const tris = [];
    // Outer shell
    tris.push(...createBoxTriangles(0, 0, 0, p.width, p.depth, p.height));
    // Inner compartments (hollowed out by adding inverted boxes visually)
    const cw = (p.width - p.wallThickness * (p.compartments + 1)) / p.compartments;
    for (let i = 0; i < p.compartments; i++) {
      const cx = p.wallThickness + i * (cw + p.wallThickness);
      tris.push(...createBoxTriangles(cx, p.wallThickness, p.wallThickness, cw, p.depth - p.wallThickness * 2, p.height - p.wallThickness));
    }
    return tris;
  },
});

// ---- phone-stand ----
registerTemplate({
  id: 'phone-stand',
  name: 'Phone Stand',
  description: 'Adjustable angle phone and tablet stand',
  category: 'Productivity',
  defaultParams: { width: 80, depth: 90, height: 60, angle: 65, thickness: 3 },
  paramSchema: {
    width:     { min: 50,  max: 150, unit: 'mm' },
    depth:     { min: 60,  max: 140, unit: 'mm' },
    height:    { min: 30,  max: 120, unit: 'mm' },
    angle:     { min: 30,  max: 85,  unit: 'deg' },
    thickness: { min: 2,   max: 6,   unit: 'mm' },
  },
  estimatedPrintMinutes: 90,
  estimatedFilamentGrams: 28,
  tags: ['phone', 'tablet', 'stand', 'desk'],
  generate(p) {
    const tris = [];
    // Base plate
    tris.push(...createBoxTriangles(0, 0, 0, p.width, p.depth, p.thickness));
    // Back support angled (simplified as a vertical slab)
    tris.push(...createBoxTriangles(0, p.depth - p.thickness, p.thickness, p.width, p.thickness, p.height));
    // Front lip
    tris.push(...createBoxTriangles(0, 0, p.thickness, p.width, p.thickness, p.thickness * 3));
    return tris;
  },
});

// ---- cable-organizer ----
registerTemplate({
  id: 'cable-organizer',
  name: 'Cable Organizer',
  description: 'Cable management clips for desk organization',
  category: 'Productivity',
  defaultParams: { length: 60, width: 15, height: 12, slots: 3, slotWidth: 5 },
  paramSchema: {
    length:    { min: 30,  max: 120, unit: 'mm' },
    width:     { min: 10,  max: 30,  unit: 'mm' },
    height:    { min: 8,   max: 25,  unit: 'mm' },
    slots:     { min: 1,   max: 6,   unit: 'count' },
    slotWidth: { min: 3,   max: 10,  unit: 'mm' },
  },
  estimatedPrintMinutes: 30,
  estimatedFilamentGrams: 8,
  tags: ['cable', 'organizer', 'desk', 'clip'],
  generate(p) {
    const tris = [];
    // Base block
    tris.push(...createBoxTriangles(0, 0, 0, p.length, p.width, p.height));
    // Slot dividers as raised ridges
    const spacing = p.length / (p.slots + 1);
    for (let i = 1; i <= p.slots; i++) {
      const sx = i * spacing - p.slotWidth / 2;
      tris.push(...createBoxTriangles(sx, 0, p.height, p.slotWidth, p.width, p.height * 0.5));
    }
    return tris;
  },
});

// ---- nameplate ----
registerTemplate({
  id: 'nameplate',
  name: 'Nameplate',
  description: 'Desk nameplate with embossed text area',
  category: 'Productivity',
  defaultParams: { width: 150, depth: 30, height: 25, textHeight: 3, baseFillet: 2 },
  paramSchema: {
    width:      { min: 80,  max: 250, unit: 'mm' },
    depth:      { min: 20,  max: 60,  unit: 'mm' },
    height:     { min: 15,  max: 50,  unit: 'mm' },
    textHeight: { min: 1,   max: 8,   unit: 'mm' },
    baseFillet:  { min: 0,   max: 5,   unit: 'mm' },
  },
  estimatedPrintMinutes: 60,
  estimatedFilamentGrams: 18,
  tags: ['office', 'nameplate', 'desk', 'sign'],
  generate(p) {
    const tris = [];
    // Main body
    tris.push(...createBoxTriangles(0, 0, 0, p.width, p.depth, p.height));
    // Embossed text area (raised rectangle on front face)
    const margin = 10;
    tris.push(...createBoxTriangles(margin, -p.textHeight, p.height * 0.3, p.width - margin * 2, p.textHeight, p.height * 0.4));
    return tris;
  },
});

// ---- coaster ----
registerTemplate({
  id: 'coaster',
  name: 'Coaster',
  description: 'Drink coaster with pattern options',
  category: 'Home',
  defaultParams: { diameter: 90, height: 4, rimHeight: 2, rimWidth: 3, pattern: 0 },
  paramSchema: {
    diameter:  { min: 60,  max: 120, unit: 'mm' },
    height:    { min: 2,   max: 10,  unit: 'mm' },
    rimHeight: { min: 0,   max: 5,   unit: 'mm' },
    rimWidth:  { min: 1,   max: 6,   unit: 'mm' },
    pattern:   { min: 0,   max: 3,   unit: 'index' },
  },
  estimatedPrintMinutes: 45,
  estimatedFilamentGrams: 12,
  tags: ['coaster', 'home', 'kitchen', 'drink'],
  generate(p) {
    const tris = [];
    const r = p.diameter / 2;
    // Main disc
    tris.push(...createCylinderTriangles(r, r, 0, r, p.height, 24));
    // Rim ring (outer cylinder slightly taller)
    if (p.rimHeight > 0) {
      tris.push(...createCylinderTriangles(r, r, p.height, r, p.rimHeight, 24));
      tris.push(...createCylinderTriangles(r, r, p.height, r - p.rimWidth, p.rimHeight, 24));
    }
    return tris;
  },
});

// ---- wall-hook ----
registerTemplate({
  id: 'wall-hook',
  name: 'Wall Hook',
  description: 'Wall-mounted hook for coats, bags, or accessories',
  category: 'Home',
  defaultParams: { mountWidth: 30, mountHeight: 50, hookLength: 35, hookDrop: 20, thickness: 5 },
  paramSchema: {
    mountWidth:  { min: 20,  max: 60,  unit: 'mm' },
    mountHeight: { min: 30,  max: 80,  unit: 'mm' },
    hookLength:  { min: 20,  max: 60,  unit: 'mm' },
    hookDrop:    { min: 10,  max: 40,  unit: 'mm' },
    thickness:   { min: 3,   max: 10,  unit: 'mm' },
  },
  estimatedPrintMinutes: 40,
  estimatedFilamentGrams: 10,
  tags: ['hook', 'wall', 'home', 'hanger'],
  generate(p) {
    const tris = [];
    // Mount plate
    tris.push(...createBoxTriangles(0, 0, 0, p.mountWidth, p.thickness, p.mountHeight));
    // Hook arm (horizontal)
    tris.push(...createBoxTriangles(0, p.thickness, p.mountHeight - p.thickness, p.mountWidth, p.hookLength, p.thickness));
    // Hook drop (vertical tip)
    tris.push(...createBoxTriangles(0, p.thickness + p.hookLength - p.thickness, p.mountHeight - p.thickness - p.hookDrop, p.mountWidth, p.thickness, p.hookDrop));
    return tris;
  },
});

// ---- card-holder ----
registerTemplate({
  id: 'card-holder',
  name: 'Card Holder',
  description: 'Business card holder for desk display',
  category: 'Productivity',
  defaultParams: { width: 95, depth: 35, height: 30, slotWidth: 2, slotAngle: 15 },
  paramSchema: {
    width:     { min: 80,  max: 120, unit: 'mm' },
    depth:     { min: 25,  max: 60,  unit: 'mm' },
    height:    { min: 15,  max: 50,  unit: 'mm' },
    slotWidth: { min: 1,   max: 5,   unit: 'mm' },
    slotAngle: { min: 5,   max: 30,  unit: 'deg' },
  },
  estimatedPrintMinutes: 35,
  estimatedFilamentGrams: 9,
  tags: ['card', 'business', 'holder', 'desk'],
  generate(p) {
    const tris = [];
    // Base slab
    tris.push(...createBoxTriangles(0, 0, 0, p.width, p.depth, 3));
    // Back support wall
    tris.push(...createBoxTriangles(0, p.depth - 3, 3, p.width, 3, p.height));
    // Front lip
    tris.push(...createBoxTriangles(0, 0, 3, p.width, 3, p.height * 0.3));
    return tris;
  },
});

// ---- planter ----
registerTemplate({
  id: 'planter',
  name: 'Planter',
  description: 'Small desk planter or pot for succulents',
  category: 'Home',
  defaultParams: { diameter: 70, height: 60, wallThickness: 3, drainHoles: 3 },
  paramSchema: {
    diameter:      { min: 40,  max: 150, unit: 'mm' },
    height:        { min: 30,  max: 120, unit: 'mm' },
    wallThickness: { min: 2,   max: 6,   unit: 'mm' },
    drainHoles:    { min: 0,   max: 6,   unit: 'count' },
  },
  estimatedPrintMinutes: 75,
  estimatedFilamentGrams: 22,
  tags: ['planter', 'pot', 'succulent', 'desk', 'garden'],
  generate(p) {
    const tris = [];
    const r = p.diameter / 2;
    // Outer cylinder
    tris.push(...createCylinderTriangles(r, r, 0, r, p.height, 24));
    // Inner cylinder (hollow)
    tris.push(...createCylinderTriangles(r, r, p.wallThickness, r - p.wallThickness, p.height - p.wallThickness, 24));
    return tris;
  },
});

// ---- bookmark ----
registerTemplate({
  id: 'bookmark',
  name: 'Bookmark',
  description: '3D printed bookmark with decorative top',
  category: 'Accessories',
  defaultParams: { width: 25, length: 120, thickness: 1.5, topWidth: 35, topHeight: 30 },
  paramSchema: {
    width:     { min: 15,  max: 40,  unit: 'mm' },
    length:    { min: 80,  max: 180, unit: 'mm' },
    thickness: { min: 0.8, max: 3,   unit: 'mm' },
    topWidth:  { min: 20,  max: 60,  unit: 'mm' },
    topHeight: { min: 15,  max: 50,  unit: 'mm' },
  },
  estimatedPrintMinutes: 20,
  estimatedFilamentGrams: 4,
  tags: ['bookmark', 'reading', 'book', 'accessory'],
  generate(p) {
    const tris = [];
    // Main blade
    const offsetX = (p.topWidth - p.width) / 2;
    tris.push(...createBoxTriangles(offsetX, 0, 0, p.width, p.length, p.thickness));
    // Decorative top
    tris.push(...createBoxTriangles(0, p.length, 0, p.topWidth, p.topHeight, p.thickness * 2));
    return tris;
  },
});

// ---- keychain ----
registerTemplate({
  id: 'keychain',
  name: 'Keychain',
  description: 'Custom keychain tag with ring hole',
  category: 'Accessories',
  defaultParams: { width: 40, height: 25, thickness: 3, ringDiameter: 8, cornerRadius: 3 },
  paramSchema: {
    width:         { min: 25,  max: 80,  unit: 'mm' },
    height:        { min: 15,  max: 50,  unit: 'mm' },
    thickness:     { min: 2,   max: 6,   unit: 'mm' },
    ringDiameter:  { min: 5,   max: 15,  unit: 'mm' },
    cornerRadius:  { min: 0,   max: 8,   unit: 'mm' },
  },
  estimatedPrintMinutes: 15,
  estimatedFilamentGrams: 3,
  tags: ['keychain', 'key', 'tag', 'accessory', 'custom'],
  generate(p) {
    const tris = [];
    // Main body
    tris.push(...createBoxTriangles(0, 0, 0, p.width, p.height, p.thickness));
    // Ring hole area (cylinder representing the ring loop)
    const ringR = p.ringDiameter / 2;
    tris.push(...createCylinderTriangles(p.width + ringR + 1, p.height / 2, 0, ringR, p.thickness, 12));
    return tris;
  },
});

// ============================================================================
// SECTION 4: Param Validation
// ============================================================================

/**
 * Validate params against a template's paramSchema, clamping to valid ranges.
 * @param {object} params - User-supplied params
 * @param {object} schema - Template paramSchema
 * @param {object} defaults - Template defaultParams
 * @returns {{validated: object, warnings: string[]}}
 */
function validateParams(params, schema, defaults) {
  const validated = {};
  const warnings = [];
  for (const key of Object.keys(schema)) {
    let val = params[key] !== undefined ? Number(params[key]) : defaults[key];
    const s = schema[key];
    if (isNaN(val)) {
      val = defaults[key];
      warnings.push(`Parameter '${key}' was not a number — using default ${defaults[key]}`);
    }
    if (val < s.min) { warnings.push(`Parameter '${key}' clamped from ${val} to min ${s.min}`); val = s.min; }
    if (val > s.max) { warnings.push(`Parameter '${key}' clamped from ${val} to max ${s.max}`); val = s.max; }
    validated[key] = val;
  }
  return { validated, warnings };
}

// ============================================================================
// SECTION 5: STL Generation Pipeline
// ============================================================================

/**
 * Generate a binary STL buffer from a template and params.
 * @param {string} templateId
 * @param {object} [params={}]
 * @returns {{ buffer: Buffer, triangleCount: number, boundingBox: {x:number,y:number,z:number}, warnings: string[] }}
 */
function generateSTL(templateId, params) {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const { validated, warnings } = validateParams(params || {}, template.paramSchema, template.defaultParams);

  const triangles = template.generate(validated);

  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const tri of triangles) {
    for (const v of tri.vertices) {
      if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
    }
  }

  const headerText = `TC-S Network 3D Artifact - ${template.name}`;
  const buffer = packSTL(triangles, headerText);

  return {
    buffer,
    triangleCount: triangles.length,
    boundingBox: {
      x: parseFloat((maxX - minX).toFixed(2)),
      y: parseFloat((maxY - minY).toFixed(2)),
      z: parseFloat((maxZ - minZ).toFixed(2)),
    },
    warnings,
  };
}

// ============================================================================
// SECTION 6: Validation Pipeline
// ============================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_DIMENSION = 300; // mm
const MAX_TRIANGLES = 500000;

/**
 * Validate a generated STL artifact.
 * @param {Buffer} stlBuffer
 * @param {{x:number,y:number,z:number}} boundingBox
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateArtifact3d(stlBuffer, boundingBox) {
  const errors = [];
  const warnings = [];

  if (!stlBuffer || stlBuffer.length === 0) {
    errors.push('STL buffer is empty or null');
    return { valid: false, errors, warnings };
  }

  if (stlBuffer.length > MAX_FILE_SIZE) {
    errors.push(`File size ${(stlBuffer.length / 1024 / 1024).toFixed(2)} MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }

  // Read triangle count from buffer
  if (stlBuffer.length >= 84) {
    const triCount = stlBuffer.readUInt32LE(80);
    if (triCount > MAX_TRIANGLES) {
      errors.push(`Triangle count ${triCount} exceeds maximum ${MAX_TRIANGLES}`);
    }
    if (triCount === 0) {
      warnings.push('STL contains zero triangles');
    }
    const expectedSize = 84 + triCount * 50;
    if (stlBuffer.length !== expectedSize) {
      warnings.push(`STL size mismatch: expected ${expectedSize} bytes for ${triCount} triangles, got ${stlBuffer.length}`);
    }
  }

  if (boundingBox) {
    if (boundingBox.x > MAX_DIMENSION) errors.push(`X dimension ${boundingBox.x}mm exceeds max ${MAX_DIMENSION}mm`);
    if (boundingBox.y > MAX_DIMENSION) errors.push(`Y dimension ${boundingBox.y}mm exceeds max ${MAX_DIMENSION}mm`);
    if (boundingBox.z > MAX_DIMENSION) errors.push(`Z dimension ${boundingBox.z}mm exceeds max ${MAX_DIMENSION}mm`);
    if (boundingBox.x <= 0 || boundingBox.y <= 0 || boundingBox.z <= 0) {
      warnings.push('One or more bounding box dimensions are zero or negative');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// SECTION 7: Print Guide Generation
// ============================================================================

/**
 * Generate a markdown print guide for a 3D artifact.
 * @param {object} template
 * @param {object} params - Validated params
 * @param {string} stlHash - SHA-256 hash of the STL buffer
 * @returns {string} Markdown print guide
 */
function generatePrintGuide(template, params, stlHash) {
  const printTime = template.estimatedPrintMinutes;
  const filament = template.estimatedFilamentGrams;
  const priceSolar = template.basePriceSolar;

  return `# TC-S Network — 3D Artifact Print Guide

## ${template.name}
**Version:** 1.0  
**Template ID:** \`${template.id}\`  
**Category:** ${template.category}  
**Description:** ${template.description}

---

## Parameters Used
${Object.entries(params).map(([k, v]) => `- **${k}:** ${v} ${template.paramSchema[k] ? template.paramSchema[k].unit : ''}`).join('\n')}

---

## Recommended Print Settings
| Setting | Value |
|---------|-------|
| Layer Height | 0.2 mm |
| Infill | 20% |
| Supports | ${['wall-hook', 'phone-stand'].includes(template.id) ? 'Yes — required for overhangs' : 'No'} |
| Brim | ${['keychain', 'bookmark'].includes(template.id) ? 'Recommended (small footprint)' : 'Optional'} |
| Nozzle Temp | 200–210 °C (PLA) |
| Bed Temp | 60 °C |

## Material Recommendations
- **PLA** — Best for most prints. Biodegradable, easy to print.
- **PETG** — Use for items needing heat resistance (coasters, planters).
- **TPU** — Flexible option for cable organizers.

## Estimates
- **Print Time:** ~${printTime} minutes (${(printTime / 60).toFixed(1)} hours)
- **Filament:** ~${filament} g
- **Energy Footprint:** ${template.kwhFootprint} kWh

## Solar Pricing
- **Base Price:** ${priceSolar} Solar (S)
- **Energy Basis:** 1 Solar = 4,913 kWh
- **Manufacturing kWh:** ${template.kwhFootprint}

## Verification
\`\`\`
SHA-256 (STL): ${stlHash}
\`\`\`
Verify your downloaded STL file matches this hash to ensure integrity.

---

*Generated by TC-S Network Artifact3D Service*  
*${new Date().toISOString()}*
`;
}

// ============================================================================
// SECTION 8: One-Line Transaction Parser
// ============================================================================

/**
 * Parse a one-liner transaction string into a structured object.
 * @param {string} line
 * @returns {{ action: string, title: string, priceSolar: number, includes: string[], destination: string }|null}
 */
function parseOneLiner(line) {
  if (!line || typeof line !== 'string') return null;

  const normalized = line.trim();

  // Detect action
  let action = null;
  const lower = normalized.toLowerCase();
  if (lower.startsWith('mint')) action = 'mint';
  else if (lower.startsWith('buy')) action = 'buy';
  else if (lower.startsWith('print')) action = 'print';
  else if (lower.startsWith('list')) action = 'list';
  else return null;

  // Extract title (text inside single or double quotes)
  const titleMatch = normalized.match(/['"]([^'"]+)['"]/);
  const title = titleMatch ? titleMatch[1] : null;

  // Extract price (number followed by "Solar")
  const priceMatch = normalized.match(/([\d.]+)\s*Solar/i);
  const priceSolar = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // Extract includes (text after "includes")
  const includesMatch = normalized.match(/includes?\s+(.+?)(?:\s*[—–-]\s*|$)/i);
  let includes = [];
  if (includesMatch) {
    includes = includesMatch[1]
      .split(/\s*[+&,]\s*/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  // Extract destination (text after "to" near end, or after "deliver ... to")
  const destMatch = normalized.match(/(?:publish\s+to|deliver\s+.*?to|send\s+to)\s+(.+?)$/i);
  const destination = destMatch ? destMatch[1].trim() : 'market';

  return { action, title, priceSolar, includes, destination };
}

// ============================================================================
// SECTION 9: Factory Mode Functions
// ============================================================================

const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars I/O/0/1

/**
 * Generate a 6-character alphanumeric pickup code.
 * @returns {string}
 */
function generatePickupCode() {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
  }
  return code;
}

/**
 * Generate a QR data string (URL) for a pickup code.
 * @param {string} pickupCode
 * @param {string} eventId
 * @param {string} artifactTitle
 * @returns {string}
 */
function generatePickupQR(pickupCode, eventId, artifactTitle) {
  const encodedTitle = encodeURIComponent(artifactTitle || 'Artifact');
  return `https://thecurrentsee.org/factory/pickup?code=${pickupCode}&event=${encodeURIComponent(eventId || '')}&title=${encodedTitle}`;
}

/** @type {Map<string, object[]>} In-memory printer registry keyed by eventId */
const printerRegistry = new Map();

/**
 * Find an available printer for a given event and requirements.
 * @param {string} eventId
 * @param {{ maxVolume?: number, material?: string }} [requirements={}]
 * @returns {object|null}
 */
function findAvailablePrinter(eventId, requirements) {
  const printers = printerRegistry.get(eventId);
  if (!printers || printers.length === 0) return null;

  requirements = requirements || {};
  for (const printer of printers) {
    if (printer.status !== 'idle') continue;
    if (requirements.maxVolume && printer.buildVolume < requirements.maxVolume) continue;
    if (requirements.material && !printer.materials.includes(requirements.material)) continue;
    return printer;
  }
  return null;
}

/**
 * Estimate print time for a template and params (in minutes).
 * @param {string} templateId
 * @param {object} [params={}]
 * @returns {number}
 */
function estimatePrintTime(templateId, params) {
  const template = TEMPLATES[templateId];
  if (!template) return 0;

  const { validated } = validateParams(params || {}, template.paramSchema, template.defaultParams);

  // Scale estimate based on volume ratio vs defaults
  const defaultVol = Object.values(template.defaultParams).reduce((a, b) => a * (typeof b === 'number' ? b : 1), 1);
  const actualVol = Object.values(validated).reduce((a, b) => a * (typeof b === 'number' ? b : 1), 1);
  const ratio = defaultVol > 0 ? actualVol / defaultVol : 1;

  return Math.round(template.estimatedPrintMinutes * Math.pow(ratio, 1 / 3));
}

// ============================================================================
// SECTION 10: Main Pipeline
// ============================================================================

/**
 * Full artifact generation pipeline: STL + hash + validate + print guide.
 * @param {string} templateId
 * @param {object} [params={}]
 * @returns {{ stlBuffer: Buffer, stlHash: string, printGuideText: string, printGuideHash: string, triangleCount: number, boundingBox: {x:number,y:number,z:number}, validation: object, template: object, params: object, priceSolar: number, kwhFootprint: number }}
 */
function generateArtifact3d(templateId, params) {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  // Generate STL
  const stlResult = generateSTL(templateId, params || {});

  // Hash
  const stlHash = hashBuffer(stlResult.buffer);

  // Validate
  const validation = validateArtifact3d(stlResult.buffer, stlResult.boundingBox);

  // Validated params for guide
  const { validated } = validateParams(params || {}, template.paramSchema, template.defaultParams);

  // Print guide
  const printGuideText = generatePrintGuide(template, validated, stlHash);
  const printGuideHash = hashBuffer(Buffer.from(printGuideText, 'utf-8'));

  return {
    stlBuffer: stlResult.buffer,
    stlHash,
    printGuideText,
    printGuideHash,
    triangleCount: stlResult.triangleCount,
    boundingBox: stlResult.boundingBox,
    validation,
    template: {
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
    },
    params: validated,
    priceSolar: template.basePriceSolar,
    kwhFootprint: template.kwhFootprint,
    warnings: stlResult.warnings,
  };
}

// ============================================================================
// SECTION 11: Template Registry Accessors
// ============================================================================

/**
 * Get all registered templates (without generate functions).
 * @returns {object[]}
 */
function getTemplates() {
  return Object.values(TEMPLATES).map(t => {
    const { generate, ...meta } = t;
    return meta;
  });
}

/**
 * Get a single template by ID (without generate function).
 * @param {string} id
 * @returns {object|null}
 */
function getTemplate(id) {
  const t = TEMPLATES[id];
  if (!t) return null;
  const { generate, ...meta } = t;
  return meta;
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  getTemplates,
  getTemplate,
  generateArtifact3d,
  generateSTL,
  validateArtifact3d,
  hashBuffer,
  parseOneLiner,
  generatePickupCode,
  generatePickupQR,
  findAvailablePrinter,
  estimatePrintTime,
  generatePrintGuide,
  createBoxTriangles,
  createCylinderTriangles,
  packSTL,
  printerRegistry,
};

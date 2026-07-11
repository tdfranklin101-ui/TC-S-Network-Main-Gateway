const OpenAI = require('openai');
const cloudStorage = require('./cloud-storage');
const coldStorage = require('./cold-storage');
const crypto = require('crypto');

const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';

const GENESIS_TYPES = {
  'music':            { output: 'audio',  ext: '.mp3', mime: 'audio/mpeg',    ttsModel: 'tts-1-hd', voice: 'nova' },
  'songs':            { output: 'audio',  ext: '.mp3', mime: 'audio/mpeg',    ttsModel: 'tts-1-hd', voice: 'nova' },
  'audio & music':    { output: 'audio',  ext: '.mp3', mime: 'audio/mpeg',    ttsModel: 'tts-1-hd', voice: 'nova' },
  'audio':            { output: 'audio',  ext: '.mp3', mime: 'audio/mpeg',    ttsModel: 'tts-1-hd', voice: 'nova' },
  'video':            { output: 'audio',  ext: '.mp3', mime: 'audio/mpeg',    ttsModel: 'tts-1-hd', voice: 'shimmer' },
  'videos':           { output: 'audio',  ext: '.mp3', mime: 'audio/mpeg',    ttsModel: 'tts-1-hd', voice: 'shimmer' },
  'writing':          { output: 'html',   ext: '.html', mime: 'text/html' },
  'docs':             { output: 'html',   ext: '.html', mime: 'text/html' },
  'education':        { output: 'html',   ext: '.html', mime: 'text/html' },
  'culture':          { output: 'html',   ext: '.html', mime: 'text/html' },
  'art':              { output: 'html',   ext: '.html', mime: 'text/html' },
  'photo':            { output: 'html',   ext: '.html', mime: 'text/html' },
  'digital art':      { output: 'html',   ext: '.html', mime: 'text/html' },
  'creative & media': { output: 'html',   ext: '.html', mime: 'text/html' },
  'software':         { output: 'text',   ext: '.js',   mime: 'application/javascript' },
  'ai tools':         { output: 'text',   ext: '.json', mime: 'application/json' },
  'ai create':        { output: 'text',   ext: '.json', mime: 'application/json' },
  'games':            { output: 'html',   ext: '.html', mime: 'text/html' },
  'utilities':        { output: 'text',   ext: '.js',   mime: 'application/javascript' },
  'computronium':     { output: 'text',   ext: '.json', mime: 'application/json' },
  'basic needs':      { output: 'text',   ext: '.txt',  mime: 'text/plain' },
  'rent':             { output: 'text',   ext: '.txt',  mime: 'text/plain' },
  'energy':           { output: 'text',   ext: '.json', mime: 'application/json' },
  'productivity':     { output: 'html',   ext: '.html', mime: 'text/html' },
  '3d printing':      { output: 'text',   ext: '.json', mime: 'application/json' }
};

class ArtifactGenesisService {
  constructor(pool) {
    this.pool = pool;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  _getGenesisType(category) {
    if (!category) return null;
    const cat = category.toLowerCase().trim();
    if (GENESIS_TYPES[cat]) return GENESIS_TYPES[cat];
    for (const [key, val] of Object.entries(GENESIS_TYPES)) {
      if (cat.includes(key)) return val;
    }
    return { output: 'text', ext: '.txt', mime: 'text/plain' };
  }

  async generateFromDNA(artifactId) {
    try {
      console.log('🧬 [Genesis] Materializing artifact:', artifactId);

      const result = await this.pool.query(
        'SELECT id, title, description, category, content_body, content_format, file_type FROM artifacts WHERE id = $1',
        [artifactId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Artifact not found' };
      }

      const artifact = result.rows[0];

      // The DNA (content_body) may live in cold storage as a `cold://` pointer.
      // Resolve it to the real blueprint before feeding it to the generators —
      // otherwise the pointer string itself would be sent to the AI.
      if (coldStorage.isColdPointer(artifact.content_body)) {
        const resolvedDNA = await coldStorage.resolveContentBody(artifact.content_body);
        if (resolvedDNA == null) {
          return { success: false, error: 'Artifact DNA is unavailable from cold storage' };
        }
        artifact.content_body = resolvedDNA;
      }

      const genesisType = this._getGenesisType(artifact.category);

      if (!genesisType) {
        return { success: false, error: 'No genesis type for category: ' + artifact.category };
      }

      console.log(`🧬 [Genesis] Category "${artifact.category}" → output type: ${genesisType.output} (${genesisType.ext})`);

      let buffer, ext, mime;

      switch (genesisType.output) {
        case 'audio':
          ({ buffer, ext, mime } = await this._generateAudio(artifact, genesisType));
          break;
        case 'html':
          ({ buffer, ext, mime } = await this._generateHTML(artifact));
          break;
        case 'text':
          ({ buffer, ext, mime } = await this._generateText(artifact, genesisType));
          break;
        default:
          ({ buffer, ext, mime } = await this._generateText(artifact, genesisType));
      }

      const masterKey = `${PRIVATE_DIR}/master/${artifactId}_master${ext}`;
      const tradeKey = `${PRIVATE_DIR}/trade/${artifactId}_trade${ext}`;

      await cloudStorage.uploadFromBuffer(masterKey, buffer);
      console.log('🧬 [Genesis] Master uploaded:', masterKey, `(${buffer.length} bytes)`);

      await cloudStorage.uploadFromBuffer(tradeKey, buffer);

      const masterCloudUrl = `cloud://${masterKey}`;
      const tradeCloudUrl = `cloud://${tradeKey}`;
      const streamingUrl = genesisType.output === 'audio' ? masterCloudUrl : null;

      await this.pool.query(
        `UPDATE artifacts SET
          master_file_url = $1,
          trade_file_url = $2,
          streaming_url = COALESCE($3, streaming_url),
          processing_status = 'complete',
          file_type = $4
        WHERE id = $5`,
        [masterCloudUrl, tradeCloudUrl, streamingUrl, mime, artifactId]
      );

      console.log(`🧬 [Genesis] Complete: "${artifact.title}" → ${genesisType.output} (${buffer.length} bytes)`);

      return {
        success: true,
        outputType: genesisType.output,
        cloudUrl: masterCloudUrl,
        cloudKey: masterKey,
        fileSize: buffer.length,
        mimeType: mime,
        extension: ext
      };
    } catch (err) {
      console.error('🧬 [Genesis] generateFromDNA error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async _generateAudio(artifact, genesisType) {
    const script = this._buildAudioScript(artifact);
    console.log('🧬 [Genesis] TTS script length:', script.length);

    const mp3Response = await this.openai.audio.speech.create({
      model: genesisType.ttsModel || 'tts-1-hd',
      voice: genesisType.voice || 'nova',
      input: script,
      response_format: 'mp3'
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    return { buffer, ext: '.mp3', mime: 'audio/mpeg' };
  }

  async _generateHTML(artifact) {
    const { title, description, category, content_body } = artifact;

    let dnaData = this._parseDNA(content_body);
    const prompt = this._buildHTMLPrompt(title, description, category, content_body, dnaData);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are a product designer for the TC-S Network marketplace. Generate a complete, self-contained HTML file that IS the deliverable product. The HTML should be beautiful, interactive, and production-ready. Use inline CSS and JavaScript. The design should use a dark theme (#0a0a0a background, white text, cyan (#00ffff) accents, neon green (#39FF14) highlights). Include the TC-S Network branding subtly. The HTML must be a complete standalone file with <!DOCTYPE html>. Do NOT use any external dependencies or CDNs. Output ONLY the HTML — no markdown fences, no explanation.` },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.8
    });

    let html = completion.choices[0]?.message?.content || '';
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${this._escapeHtml(title)}</title><style>body{background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{color:#00ffff}h2{color:#39FF14}a{color:#00ffff}pre{background:#111;padding:16px;border-radius:8px;overflow-x:auto;border:1px solid #333}</style></head><body><h1>${this._escapeHtml(title)}</h1><div>${html}</div><footer style="margin-top:40px;padding-top:20px;border-top:1px solid #333;font-size:12px;color:#666">TC-S Network Artifact — ${this._escapeHtml(category)}</footer></body></html>`;
    }

    const buffer = Buffer.from(html, 'utf-8');
    return { buffer, ext: '.html', mime: 'text/html' };
  }

  async _generateText(artifact, genesisType) {
    const { title, description, category, content_body } = artifact;

    let dnaData = this._parseDNA(content_body);
    const ext = genesisType.ext || '.txt';
    const isJSON = ext === '.json';
    const isJS = ext === '.js';

    let systemPrompt;
    if (isJSON) {
      systemPrompt = `You are a data architect for the TC-S Network. Generate a complete, production-ready JSON document that IS the deliverable product. The JSON should be rich, detailed, and immediately usable. Include metadata, specifications, configurations, or data tables as appropriate for the category "${category}". Output ONLY valid JSON — no markdown fences, no explanation.`;
    } else if (isJS) {
      systemPrompt = `You are a software engineer for the TC-S Network. Generate a complete, production-ready Node.js module that IS the deliverable product. Include JSDoc comments, exports, error handling, and example usage. The code should be immediately runnable. Output ONLY JavaScript code — no markdown fences, no explanation.`;
    } else {
      systemPrompt = `You are a content specialist for the TC-S Network. Generate a complete, production-ready text document that IS the deliverable product. Make it rich, detailed, and immediately useful for the category "${category}". Output the content directly — no markdown fences.`;
    }

    const userPrompt = `Create a complete "${category}" product titled "${title}".\n\nDescription: ${description || 'No description'}\n\nDNA/Blueprint:\n${content_body ? content_body.substring(0, 3000) : 'Generate based on the title and category.'}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.7
    });

    let content = completion.choices[0]?.message?.content || '';
    content = content.replace(/^```\w*\n?/i, '').replace(/\n?```$/i, '').trim();

    if (isJSON) {
      try { JSON.parse(content); } catch {
        content = JSON.stringify({ title, category, description, generated: new Date().toISOString(), content: content }, null, 2);
      }
    }

    const buffer = Buffer.from(content, 'utf-8');
    return { buffer, ext, mime: genesisType.mime || 'text/plain' };
  }

  async generateTeaser(artifactId) {
    try {
      console.log('🧬 [Genesis] Generating teaser for artifact:', artifactId);

      const result = await this.pool.query(
        'SELECT id, title, description, category, content_body FROM artifacts WHERE id = $1',
        [artifactId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Artifact not found' };
      }

      const artifact = result.rows[0];
      const script = this._buildTeaserScript(artifact);
      console.log('🧬 [Genesis] Teaser script length:', script.length);

      const mp3Response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: script,
        response_format: 'mp3'
      });

      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      const filename = `${artifactId}_teaser.mp3`;
      const previewUpload = await cloudStorage.uploadPreviewFile(artifactId, filename, buffer);
      const previewUrl = `cloud://${previewUpload.key}`;

      await this.pool.query(
        'UPDATE artifacts SET preview_file_url = $1 WHERE id = $2',
        [previewUrl, artifactId]
      );

      console.log('🧬 [Genesis] Teaser ready:', previewUpload.key);

      return {
        success: true,
        previewUrl: previewUpload.url,
        previewKey: previewUpload.key
      };
    } catch (err) {
      console.error('🧬 [Genesis] generateTeaser error:', err.message);
      return { success: false, error: err.message };
    }
  }

  _parseDNA(content_body) {
    if (!content_body) return null;
    try {
      const trimmed = content_body.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed);
      }
    } catch {}
    return null;
  }

  _buildAudioScript(artifact) {
    const { title, description, category, content_body } = artifact;
    const dnaData = this._parseDNA(content_body);
    const cat = (category || '').toLowerCase();

    if (cat.includes('video')) {
      return this._buildVideoNarration(title, description, dnaData);
    }

    let script = `Presenting: ${title}. `;

    if (dnaData) {
      if (dnaData.tempo) script += `Tempo: ${dnaData.tempo} beats per minute. `;
      if (dnaData.key) script += `Key: ${dnaData.key}. `;
      if (dnaData.instruments) {
        const instruments = Array.isArray(dnaData.instruments)
          ? dnaData.instruments.map(i => typeof i === 'string' ? i : i.name || i.instrument).join(', ')
          : String(dnaData.instruments);
        script += `Featuring: ${instruments}. `;
      }
      if (dnaData.sections || dnaData.arrangement || dnaData.movements || dnaData.structure) {
        const sections = dnaData.sections || dnaData.arrangement || dnaData.movements || dnaData.structure;
        if (Array.isArray(sections)) {
          script += `${sections.length} movements. `;
          sections.slice(0, 4).forEach((s) => {
            const sName = typeof s === 'string' ? s : (s.name || s.section || s.title || '');
            if (sName) script += `${sName}. `;
          });
        }
      }
      if (dnaData.mood || dnaData.style || dnaData.genre) {
        script += `Style: ${dnaData.mood || dnaData.style || dnaData.genre}. `;
      }
      if (dnaData.effects || dnaData.effects_chain) {
        const fx = dnaData.effects || dnaData.effects_chain;
        if (Array.isArray(fx)) {
          script += `Production: ${fx.slice(0, 3).map(e => typeof e === 'string' ? e : e.name || e.type).join(', ')}. `;
        }
      }
    }

    if (description) script += description.substring(0, 600);
    return script.substring(0, 4000);
  }

  _buildVideoNarration(title, description, dnaData) {
    let script = `Presenting: ${title}. `;

    if (dnaData) {
      if (dnaData.shots || dnaData.scenes) {
        const items = dnaData.shots || dnaData.scenes;
        if (Array.isArray(items)) {
          script += `A ${items.length}-scene production. `;
          items.slice(0, 4).forEach((s, i) => {
            const desc = typeof s === 'string' ? s : (s.description || s.scene || s.name || '');
            if (desc) script += `Scene ${i + 1}: ${desc}. `;
          });
        }
      }
      if (dnaData.style || dnaData.genre) script += `Genre: ${dnaData.style || dnaData.genre}. `;
      if (dnaData.duration) script += `Runtime: ${dnaData.duration}. `;
    }

    if (description) script += description.substring(0, 600);
    return script.substring(0, 4000);
  }

  _buildHTMLPrompt(title, description, category, content_body, dnaData) {
    const cat = (category || '').toLowerCase();
    let prompt = `Create a complete HTML product for "${title}" in the "${category}" category.\n\n`;

    if (cat.includes('writing') || cat.includes('docs') || cat.includes('education')) {
      prompt += `This should be a beautifully formatted document/article/guide. Include headings, styled paragraphs, pull quotes, and visual hierarchy.\n`;
    } else if (cat.includes('art') || cat.includes('photo') || cat.includes('digital art')) {
      prompt += `This should be an interactive art piece or visual gallery using CSS art, SVG, canvas, or generative visuals. Make it visually stunning.\n`;
    } else if (cat.includes('games')) {
      prompt += `This should be a playable mini-game or interactive experience using HTML5 Canvas or DOM manipulation. Include controls and scoring.\n`;
    } else if (cat.includes('culture')) {
      prompt += `This should be a cultural experience — a storytelling piece, interactive timeline, or heritage showcase with rich visuals.\n`;
    } else if (cat.includes('creative')) {
      prompt += `This should be an interactive creative tool or showcase — something the buyer can explore and interact with.\n`;
    } else {
      prompt += `This should be a useful, interactive HTML application or document appropriate for the "${category}" category.\n`;
    }

    prompt += `\nDescription: ${description || 'No description provided'}\n`;
    if (content_body) {
      prompt += `\nBlueprint/DNA data:\n${content_body.substring(0, 2500)}\n`;
    }

    return prompt;
  }

  _buildTeaserScript(artifact) {
    const { title, description, category } = artifact;
    const cat = (category || '').toLowerCase();
    const genesisType = this._getGenesisType(category);
    const outputLabel = genesisType ? genesisType.output : 'content';

    let teaser = `${title}. `;

    if (cat.includes('music') || cat.includes('songs') || cat.includes('audio')) {
      teaser += description ? description.substring(0, 150) : 'A unique musical composition.';
      teaser += ' Purchase to materialize the full audio from this DNA.';
    } else if (cat.includes('video')) {
      teaser += description ? description.substring(0, 150) : 'A cinematic production blueprint.';
      teaser += ' Purchase to materialize the full narrated production from this DNA.';
    } else if (outputLabel === 'html') {
      teaser += description ? description.substring(0, 150) : `A ${category} experience.`;
      teaser += ' Purchase to materialize the full interactive product.';
    } else {
      teaser += description ? description.substring(0, 150) : `A ${category} artifact.`;
      teaser += ' Purchase to materialize the complete deliverable.';
    }

    return teaser.substring(0, 500);
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async hasGeneratedFile(artifactId) {
    try {
      const result = await this.pool.query(
        'SELECT master_file_url, trade_file_url FROM artifacts WHERE id = $1',
        [artifactId]
      );
      if (result.rows.length === 0) return false;
      const row = result.rows[0];
      return !!(row.master_file_url && row.master_file_url.startsWith('cloud://'));
    } catch (err) {
      console.error('🧬 [Genesis] hasGeneratedFile error:', err.message);
      return false;
    }
  }

  async hasTeaserPreview(artifactId) {
    try {
      const result = await this.pool.query(
        'SELECT preview_file_url FROM artifacts WHERE id = $1',
        [artifactId]
      );
      if (result.rows.length === 0) return false;
      const row = result.rows[0];
      return !!(row.preview_file_url && (row.preview_file_url.includes('teaser') || row.preview_file_url.startsWith('cloud://')));
    } catch (err) {
      console.error('🧬 [Genesis] hasTeaserPreview error:', err.message);
      return false;
    }
  }
}

module.exports = ArtifactGenesisService;

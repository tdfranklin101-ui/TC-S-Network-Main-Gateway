const { OpenAI } = require('openai');
const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY
});

let objStorage;
try {
  objStorage = new Client();
} catch (err) {
  console.warn('[AI-Creation-Engine] Object storage unavailable, using local filesystem:', err.message);
  objStorage = null;
}

const BUDGET = {
  maxDalleImages: 15,
  maxTtsAudio: 10,
  maxGpt4oTexts: 30,
  maxPikaVideos: 3,
  dalleUsed: 0,
  ttsUsed: 0,
  gpt4oUsed: 0,
  pikaUsed: 0
};

function resetBudget() {
  BUDGET.dalleUsed = 0;
  BUDGET.ttsUsed = 0;
  BUDGET.gpt4oUsed = 0;
  BUDGET.pikaUsed = 0;
  console.log('[AI-Creation-Engine] Budget counters reset');
}

function getBudgetStatus() {
  return {
    dalle: { used: BUDGET.dalleUsed, max: BUDGET.maxDalleImages, remaining: BUDGET.maxDalleImages - BUDGET.dalleUsed },
    tts: { used: BUDGET.ttsUsed, max: BUDGET.maxTtsAudio, remaining: BUDGET.maxTtsAudio - BUDGET.ttsUsed },
    gpt4o: { used: BUDGET.gpt4oUsed, max: BUDGET.maxGpt4oTexts, remaining: BUDGET.maxGpt4oTexts - BUDGET.gpt4oUsed },
    pika: { used: BUDGET.pikaUsed, max: BUDGET.maxPikaVideos, remaining: BUDGET.maxPikaVideos - BUDGET.pikaUsed }
  };
}

const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

function pickVoice() {
  return TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)];
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function uniqueFilename(title, ext) {
  const slug = slugify(title);
  const hash = crypto.randomBytes(4).toString('hex');
  return `${slug}-${hash}${ext}`;
}

function getCategoryConfig(category) {
  const cat = (category || '').toLowerCase().trim();
  const configs = {
    art: { method: 'dalle', promptPrefix: 'Create a vibrant digital artwork depicting', promptSuffix: 'Style: modern digital art, colorful, detailed, high quality.', ext: '.png', fileType: 'image/png', previewType: 'image' },
    photo: { method: 'dalle', promptPrefix: 'Create a stunning photorealistic image of', promptSuffix: 'Style: professional photography, sharp detail, natural lighting.', ext: '.png', fileType: 'image/png', previewType: 'image' },
    culture: { method: 'dalle', promptPrefix: 'Create an artistic cultural illustration of', promptSuffix: 'Style: rich cultural aesthetic, detailed, meaningful symbolism.', ext: '.png', fileType: 'image/png', previewType: 'image' },
    'basic needs': { method: 'dalle', promptPrefix: 'Create a clean infographic icon representing', promptSuffix: 'Style: minimalist icon design, clean lines, informative.', ext: '.png', fileType: 'image/png', previewType: 'image' },
    writing: { method: 'gpt4o', systemPrompt: 'You are a talented creative writer. Write engaging, original content. Output only the final piece with no meta-commentary.', userPromptPrefix: 'Write a creative piece titled', ext: '.txt', fileType: 'text/plain', previewType: 'text' },
    docs: { method: 'gpt4o', systemPrompt: 'You are a technical documentation expert. Write clear, comprehensive technical documents. Output only the document content.', userPromptPrefix: 'Write a detailed technical document about', ext: '.txt', fileType: 'text/plain', previewType: 'text' },
    software: { method: 'gpt4o', systemPrompt: 'You are an expert software engineer. Write complete, working, well-commented code. Output only the code with no markdown fences.', userPromptPrefix: 'Write a complete, working implementation of', ext: '.js', fileType: 'application/javascript', previewType: 'code' },
    'ai tools': { method: 'gpt4o', systemPrompt: 'You are an AI tools developer. Write a complete, working AI utility script in JavaScript. Include helpful comments. Output only the code with no markdown fences.', userPromptPrefix: 'Create an AI tool script for', ext: '.js', fileType: 'application/javascript', previewType: 'code' },
    games: { method: 'gpt4o', systemPrompt: 'You are a game developer. Write a complete, playable text-based game or interactive game concept in JavaScript. Include comments. Output only the code with no markdown fences.', userPromptPrefix: 'Create a game called', ext: '.js', fileType: 'application/javascript', previewType: 'code' },
    computronium: { method: 'gpt4o', systemPrompt: 'You are a compute optimization specialist. Write a practical optimization or benchmarking script in JavaScript. Include comments. Output only the code with no markdown fences.', userPromptPrefix: 'Create a compute optimization script for', ext: '.js', fileType: 'application/javascript', previewType: 'code' },
    utilities: { method: 'gpt4o', systemPrompt: 'You are a utility tool developer. Write a complete, useful utility tool in JavaScript. Include comments. Output only the code with no markdown fences.', userPromptPrefix: 'Create a utility tool for', ext: '.js', fileType: 'application/javascript', previewType: 'code' },
    energy: { method: 'gpt4o', systemPrompt: 'You are an energy systems analyst. Write a comprehensive energy analysis report or create an energy analysis tool. Output only the content.', userPromptPrefix: 'Create an energy analysis for', ext: '.txt', fileType: 'text/plain', previewType: 'text' },
    rent: { method: 'gpt4o', systemPrompt: 'You are a real estate and housing expert. Write professional rental agreements, housing guides, or tenant resources. Output only the document content.', userPromptPrefix: 'Create a rental/housing document about', ext: '.txt', fileType: 'text/plain', previewType: 'text' },
    music: { method: 'tts', ext: '.mp3', fileType: 'audio/mpeg', previewType: 'audio' },
    video: { method: 'video', ext: '.png', fileType: 'image/png', previewType: 'image' },
    'ai create': { method: 'video', ext: '.png', fileType: 'image/png', previewType: 'image' }
  };

  return configs[cat] || { method: 'gpt4o', systemPrompt: 'You are a helpful content creator. Generate high-quality content based on the request. Output only the content.', userPromptPrefix: 'Create content about', ext: '.txt', fileType: 'text/plain', previewType: 'text' };
}

async function saveFile(categorySlug, filename, buffer) {
  const storagePath = `public/ecosystem-artifacts/${categorySlug}/${filename}`;

  if (objStorage) {
    try {
      await objStorage.uploadFromBytes(storagePath, buffer);
      try {
        const url = await objStorage.getSignedDownloadUrl(storagePath);
        return { url, size: buffer.length };
      } catch (urlErr) {
        return { url: `/${storagePath}`, size: buffer.length };
      }
    } catch (err) {
      console.warn('[AI-Creation-Engine] Object storage upload failed, falling back to local:', err.message);
    }
  }

  const localDir = path.join(__dirname, 'public', 'ecosystem-artifacts', categorySlug);
  fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, filename);
  fs.writeFileSync(localPath, buffer);
  return { url: `/ecosystem-artifacts/${categorySlug}/${filename}`, size: buffer.length };
}

async function generateWithDalle(title, description, config, agentName) {
  if (BUDGET.dalleUsed >= BUDGET.maxDalleImages) {
    return { success: false, error: 'DALL-E budget exhausted', creationMethod: 'budget_exceeded' };
  }

  try {
    const prompt = `${config.promptPrefix} "${title}". ${description || ''}. ${config.promptSuffix} Created for the TC-S Network marketplace.`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.substring(0, 4000),
      n: 1,
      size: '1024x1024',
      quality: 'standard'
    });

    BUDGET.dalleUsed++;
    const imageUrl = response.data[0].url;

    const fetch = (await import('node-fetch')).default;
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error(`Failed to download generated image: ${imgResponse.status}`);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const filename = uniqueFilename(title, config.ext);

    console.log(`[AI-Creation-Engine] DALL-E generated: ${filename} (${imgBuffer.length} bytes) by ${agentName}`);

    return {
      success: true,
      fileBuffer: imgBuffer,
      filename: filename,
      fileType: config.fileType,
      fileSize: imgBuffer.length,
      previewType: config.previewType,
      creationMethod: 'dalle-3'
    };
  } catch (err) {
    console.error(`[AI-Creation-Engine] DALL-E error:`, err.message);
    return { success: false, error: err.message, creationMethod: 'failed' };
  }
}

async function generateWithGpt4o(title, description, config, agentName) {
  if (BUDGET.gpt4oUsed >= BUDGET.maxGpt4oTexts) {
    return { success: false, error: 'GPT-4o budget exhausted', creationMethod: 'budget_exceeded' };
  }

  try {
    const userContent = `${config.userPromptPrefix} "${title}". ${description || 'Make it detailed and high quality.'}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 2000,
      temperature: 0.8
    });

    BUDGET.gpt4oUsed++;
    let content = response.choices[0].message.content;

    if (config.ext === '.js' || config.ext === '.py') {
      content = content.replace(/^```(?:javascript|js|python|py)?\n?/gm, '').replace(/\n?```$/gm, '').trim();
    }

    const textBuffer = Buffer.from(content, 'utf-8');
    const filename = uniqueFilename(title, config.ext);

    console.log(`[AI-Creation-Engine] GPT-4o generated: ${filename} (${textBuffer.length} bytes) by ${agentName}`);

    return {
      success: true,
      fileBuffer: textBuffer,
      filename: filename,
      fileType: config.fileType,
      fileSize: textBuffer.length,
      previewType: config.previewType,
      creationMethod: 'gpt-4o'
    };
  } catch (err) {
    console.error(`[AI-Creation-Engine] GPT-4o error:`, err.message);
    return { success: false, error: err.message, creationMethod: 'failed' };
  }
}

async function generateWithTts(title, description, config, agentName) {
  if (BUDGET.ttsUsed >= BUDGET.maxTtsAudio) {
    return { success: false, error: 'TTS budget exhausted', creationMethod: 'budget_exceeded' };
  }

  try {
    let spokenText;
    if (BUDGET.gpt4oUsed < BUDGET.maxGpt4oTexts) {
      try {
        const scriptResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a creative spoken-word poet and narrator. Write a compelling spoken-word piece, poem, or musical narration. Keep it between 100-300 words for optimal audio length. Output only the text to be spoken.' },
            { role: 'user', content: `Create a spoken-word piece inspired by "${title}". ${description || 'Make it evocative and powerful.'}` }
          ],
          max_tokens: 500,
          temperature: 0.9
        });
        BUDGET.gpt4oUsed++;
        spokenText = scriptResponse.choices[0].message.content;
      } catch (scriptErr) {
        console.warn('[AI-Creation-Engine] Script generation failed, using title/description:', scriptErr.message);
        spokenText = `${title}. ${description || 'A creation for the TC-S Network marketplace.'}`;
      }
    } else {
      spokenText = `${title}. ${description || 'A creation for the TC-S Network marketplace.'}`;
    }

    const voice = pickVoice();
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: spokenText.substring(0, 4096)
    });

    BUDGET.ttsUsed++;
    const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());

    const filename = uniqueFilename(title, '.mp3');

    console.log(`[AI-Creation-Engine] TTS generated: ${filename} (${audioBuffer.length} bytes, voice: ${voice}) by ${agentName}`);

    return {
      success: true,
      fileBuffer: audioBuffer,
      filename: filename,
      fileType: 'audio/mpeg',
      fileSize: audioBuffer.length,
      previewType: 'audio',
      creationMethod: 'tts-1'
    };
  } catch (err) {
    console.error(`[AI-Creation-Engine] TTS error:`, err.message);
    return { success: false, error: err.message, creationMethod: 'failed' };
  }
}

async function generateVideo(title, description, config, agentName) {
  const dalleConfig = {
    promptPrefix: 'Create a cinematic video thumbnail or key frame for',
    promptSuffix: 'Style: cinematic, widescreen composition, dramatic lighting, film-quality.',
    ext: '.png',
    fileType: 'image/png',
    previewType: 'image'
  };
  const result = await generateWithDalle(title, description, dalleConfig, agentName);
  if (result.success) {
    result.creationMethod = 'dalle-3-video-thumbnail';
  }
  return result;
}

async function generateArtifactContent(category, title, description, agentName) {
  const startTime = Date.now();
  const cat = (category || '').toLowerCase().trim();

  console.log(`[AI-Creation-Engine] Generating: "${title}" [${cat}] for ${agentName}`);

  if (!process.env.OPENAI_API_KEY && !process.env.NEW_OPENAI_API_KEY) {
    return { success: false, error: 'No OpenAI API key configured', creationMethod: 'failed' };
  }

  const config = getCategoryConfig(cat);
  let result;

  switch (config.method) {
    case 'dalle':
      result = await generateWithDalle(title, description, config, agentName);
      // Alternative route: if DALL-E budget exhausted, generate a text description instead
      if (!result.success && result.creationMethod === 'budget_exceeded') {
        console.log(`[AI-Creation-Engine] 🔄 DALL-E budget exhausted, routing ${agentName} to GPT-4o text alternative`);
        const altConfig = getCategoryConfig('writing');
        altConfig.systemPrompt = `You are a creative writer. Write a vivid, detailed description of the visual artwork "${title}". Describe colors, composition, style, and mood as if you are writing for an art catalog.`;
        altConfig.userPromptPrefix = 'Write a rich visual description and art analysis for';
        result = await generateWithGpt4o(title, description, altConfig, agentName);
        if (result.success) result.creationMethod = 'gpt4o-art-description';
      }
      break;
    case 'gpt4o':
      result = await generateWithGpt4o(title, description, config, agentName);
      break;
    case 'tts':
      result = await generateWithTts(title, description, config, agentName);
      // Alternative route: if TTS budget exhausted, generate lyrics/text instead
      if (!result.success && result.creationMethod === 'budget_exceeded') {
        console.log(`[AI-Creation-Engine] 🔄 TTS budget exhausted, routing ${agentName} to GPT-4o lyrics alternative`);
        const altConfig = getCategoryConfig('writing');
        altConfig.systemPrompt = `You are a songwriter and music creator. Write original song lyrics and composition notes for "${title}". Include verse, chorus, and bridge structure with chord progressions.`;
        altConfig.userPromptPrefix = 'Write original song lyrics and composition notes for';
        result = await generateWithGpt4o(title, description, altConfig, agentName);
        if (result.success) result.creationMethod = 'gpt4o-lyrics-alt';
      }
      break;
    case 'video':
      result = await generateVideo(title, description, config, agentName);
      break;
    default:
      result = await generateWithGpt4o(title, description, config, agentName);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[AI-Creation-Engine] Result: ${result.success ? 'SUCCESS' : 'FAILED'} (${elapsed}ms) method=${result.creationMethod}`);

  return result;
}

function getFileExtension(category) {
  const config = getCategoryConfig(category);
  return config.ext || '.txt';
}

module.exports = {
  generateArtifactContent,
  resetBudget,
  getBudgetStatus,
  getFileExtension,
  BUDGET
};

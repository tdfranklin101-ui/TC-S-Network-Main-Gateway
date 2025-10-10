const { MarketCategories } = require('../lib/categories');
const { artifacts } = require('../lib/artifacts');
const KidSolarVoice = require('../server/kid-solar-voice');
const multer = require('multer');
const path = require('path');

const conversationStore = new Map();

const CONVERSATION_TIMEOUT = 60 * 60 * 1000;
const MAX_CONVERSATION_LENGTH = 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'text/plain', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

function getConversation(conversationId) {
  if (!conversationStore.has(conversationId)) {
    conversationStore.set(conversationId, {
      messages: [],
      lastActivity: Date.now()
    });
  } else {
    const conv = conversationStore.get(conversationId);
    conv.lastActivity = Date.now();
  }
  
  return conversationStore.get(conversationId);
}

function addToConversation(conversationId, role, content, type = 'text') {
  const conversation = getConversation(conversationId);
  
  conversation.messages.push({
    role,
    content,
    type,
    timestamp: Date.now()
  });
  
  if (conversation.messages.length > MAX_CONVERSATION_LENGTH) {
    conversation.messages = conversation.messages.slice(-MAX_CONVERSATION_LENGTH);
  }
  
  return conversation.messages;
}

function getConversationHistory(conversationId) {
  const conversation = getConversation(conversationId);
  return conversation.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

function cleanupOldConversations() {
  const now = Date.now();
  for (const [id, conv] of conversationStore.entries()) {
    if (now - conv.lastActivity > CONVERSATION_TIMEOUT) {
      conversationStore.delete(id);
    }
  }
}

setInterval(cleanupOldConversations, 10 * 60 * 1000);

async function handleMultipartRequest(req, res) {
  const multerMiddleware = upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);
  
  multerMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: err.message 
      }));
      return;
    }

    try {
      const conversationId = req.body.conversationId || `conv_${Date.now()}`;
      const memberId = req.body.memberId || 'anonymous';
      const memberContext = {
        name: req.body.memberName || 'Member',
        username: req.body.memberUsername || req.body.memberName || 'Member',
        totalSolar: parseFloat(req.body.memberBalance || '0'),
        memberSince: req.body.memberSince || 'Unknown'
      };
      const text = req.body.text || '';
      
      const kidSolar = new KidSolarVoice();
      const conversationHistory = getConversationHistory(conversationId);
      
      let response;
      let transcript = null;
      let audioUrl = null;

      if (req.files && req.files.audio && req.files.audio[0]) {
        const audioFile = req.files.audio[0];
        const audioBuffer = audioFile.buffer;
        
        transcript = await kidSolar.transcribeAudio(audioBuffer, 'webm');
        addToConversation(conversationId, 'user', transcript, 'voice');
        
        response = await kidSolar.processVoiceCommand(
          transcript, 
          memberId, 
          memberContext, 
          conversationHistory
        );
        
        addToConversation(conversationId, 'assistant', response.text, 'voice');
        
        const audioResponse = await kidSolar.textToSpeech(response.text);
        const audioBase64 = audioResponse.toString('base64');
        audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
        
      } else if (req.files && req.files.image && req.files.image[0]) {
        const imageFile = req.files.image[0];
        const imageBuffer = imageFile.buffer;
        const prompt = text || 'What do you see in this image?';
        
        addToConversation(conversationId, 'user', `[Image: ${imageFile.originalname}] ${prompt}`, 'image');
        
        const fileData = {
          buffer: imageBuffer,
          fileName: imageFile.originalname,
          fileType: imageFile.mimetype
        };
        
        const uploadKeywords = ['upload', 'sell', 'marketplace', 'list'];
        const isUploadIntent = uploadKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        );
        
        if (isUploadIntent) {
          response = await kidSolar.processVoiceCommand(
            prompt,
            memberId,
            memberContext,
            conversationHistory,
            fileData
          );
        } else {
          response = await kidSolar.processImageWithVision(
            imageBuffer,
            prompt,
            conversationHistory
          );
        }
        
        addToConversation(conversationId, 'assistant', response.text, 'image');
        
      } else if (req.files && req.files.file && req.files.file[0]) {
        const fileAttachment = req.files.file[0];
        const fileBuffer = fileAttachment.buffer;
        const fileName = fileAttachment.originalname;
        const prompt = text || 'Please analyze this file';
        
        addToConversation(conversationId, 'user', `[File: ${fileName}] ${prompt}`, 'file');
        
        const fileData = {
          buffer: fileBuffer,
          fileName: fileName,
          fileType: fileAttachment.mimetype
        };
        
        const uploadKeywords = ['upload', 'sell', 'marketplace', 'list'];
        const isUploadIntent = uploadKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        );
        
        if (isUploadIntent) {
          response = await kidSolar.processVoiceCommand(
            prompt,
            memberId,
            memberContext,
            conversationHistory,
            fileData
          );
        } else {
          response = await kidSolar.processFileText(
            fileBuffer,
            fileName,
            prompt,
            conversationHistory
          );
        }
        
        addToConversation(conversationId, 'assistant', response.text, 'file');
        
      } else if (text) {
        addToConversation(conversationId, 'user', text, 'text');
        
        response = await kidSolar.processVoiceCommand(
          text,
          memberId,
          memberContext,
          conversationHistory
        );
        
        addToConversation(conversationId, 'assistant', response.text, 'text');
        
        const audioResponse = await kidSolar.textToSpeech(response.text);
        const audioBase64 = audioResponse.toString('base64');
        audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
        
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'No input provided. Send text, audio, image, or file.' 
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        response: response.text,
        transcript,
        audioUrl,
        conversationId,
        intent: response.intent,
        functionCalled: response.functionCalled,
        functionArgs: response.functionArgs,
        functionData: response.data
      }));

    } catch (error) {
      console.error('Error processing multipart request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }));
    }
  });
}

async function handleJsonRequest(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      
      const conversationId = data.conversationId || `conv_${Date.now()}`;
      const memberId = data.memberId || 'anonymous';
      const memberContext = {
        name: data.memberName || data.memberUsername || 'Member',
        username: data.memberUsername || data.memberName || 'Member',
        totalSolar: parseFloat(data.memberBalance || '0'),
        memberSince: data.memberSince || 'Unknown'
      };
      const text = data.text || data.message || '';
      const imageBase64 = data.imageBase64;
      
      if (!text && !imageBase64) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'No text or image provided' 
        }));
        return;
      }

      const kidSolar = new KidSolarVoice();
      const conversationHistory = getConversationHistory(conversationId);
      
      let response;

      if (imageBase64) {
        const prompt = text || 'What do you see in this image?';
        addToConversation(conversationId, 'user', `[Image] ${prompt}`, 'image');
        
        response = await kidSolar.processImageWithVision(
          imageBase64,
          prompt,
          conversationHistory
        );
        
        addToConversation(conversationId, 'assistant', response.text, 'image');
        
      } else {
        addToConversation(conversationId, 'user', text, 'text');
        
        response = await kidSolar.processVoiceCommand(
          text,
          memberId,
          memberContext,
          conversationHistory
        );
        
        addToConversation(conversationId, 'assistant', response.text, 'text');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        response: response.text,
        conversationId,
        intent: response.intent,
        functionCalled: response.functionCalled,
        functionArgs: response.functionArgs,
        functionData: response.data
      }));

    } catch (error) {
      console.error('Error processing JSON request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }));
    }
  });
}

module.exports = function(req, res, pathname) {
  if (pathname === '/market/categories') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MarketCategories));
    return true;
  }
  
  const artifactMatch = pathname.match(/^\/market\/artifacts\/(.+)$/);
  if (artifactMatch) {
    const category = artifactMatch[1];
    const filtered = artifacts.filter(a => a.category === category);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
    return true;
  }

  if (pathname === '/api/kid-solar/voice' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      handleMultipartRequest(req, res);
    } else if (contentType.includes('application/json')) {
      handleJsonRequest(req, res);
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Unsupported content type. Use multipart/form-data or application/json' 
      }));
    }
    return true;
  }
  
  return false;
};

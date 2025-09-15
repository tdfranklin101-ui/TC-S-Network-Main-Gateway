/**
 * OpenAI-Powered Dynamic Seed Rotation System
 * Automatically rotates Value-for-Value seeds across HTML pages every 24 hours
 * to keep SEO content fresh and organic while maintaining The Current-See's philosophy
 */

const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const cheerio = require('cheerio');
const openaiService = require('../openai-service');
const seedDatabase = require('./seed-database');

class SeedRotator {
  constructor() {
    this.rotationLog = [];
    this.lastRotationTime = null;
    this.isRotating = false;
    this.logFile = path.join(__dirname, '../logs/seed-rotation.log');
    this.backupDir = path.join(__dirname, '../backups/seed-rotation');
    
    // Performance and feature flags from environment
    this.config = {
      // Rotation frequency (in days)
      rotationInterval: parseInt(process.env.SEED_ROTATION_INTERVAL_DAYS) || 3,
      
      // Maximum targets to modify per file
      maxTargetsPerFile: parseInt(process.env.SEED_MAX_TARGETS_PER_FILE) || 5,
      
      // Enable/disable OpenAI for rotation planning
      useOpenAI: process.env.SEED_USE_OPENAI !== 'false',
      
      // Enable/disable automatic scheduling
      enableScheduling: process.env.ENABLE_SEED_ROTATION_SCHEDULING !== 'false',
      
      // Dry run mode for testing
      dryRun: process.env.SEED_ROTATION_DRY_RUN === 'true',
      
      // Stagger rotations across files
      enableStaggering: process.env.SEED_ENABLE_STAGGERING !== 'false',
      
      // Maximum HTML files to process in one rotation
      maxFilesPerRotation: parseInt(process.env.SEED_MAX_FILES_PER_ROTATION) || 10
    };
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load previous rotation state if available
    this.loadRotationState();
    
    console.log('🌱 Seed Rotation System initialized with performance optimizations');
    console.log(`🔧 Configuration: ${this.config.rotationInterval}-day intervals, ${this.config.dryRun ? 'DRY RUN' : 'LIVE'} mode`);
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Load previous rotation state from file
   */
  loadRotationState() {
    const stateFile = path.join(__dirname, '../data/seed-rotation-state.json');
    try {
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        this.lastRotationTime = state.lastRotationTime ? new Date(state.lastRotationTime) : null;
        this.rotationLog = state.rotationLog || [];
        console.log(`📄 Loaded rotation state. Last rotation: ${this.lastRotationTime}`);
      }
    } catch (error) {
      console.error('⚠️ Failed to load rotation state:', error.message);
    }
  }

  /**
   * Save current rotation state to file
   */
  saveRotationState() {
    const stateFile = path.join(__dirname, '../data/seed-rotation-state.json');
    const dataDir = path.dirname(stateFile);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    try {
      const state = {
        lastRotationTime: this.lastRotationTime,
        rotationLog: this.rotationLog.slice(-50) // Keep last 50 entries
      };
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('⚠️ Failed to save rotation state:', error.message);
    }
  }

  /**
   * Log rotation activity
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    console.log(`🌱 ${logEntry}`);
    
    // Add to rotation log
    this.rotationLog.push({
      timestamp,
      level,
      message
    });
    
    // Write to log file
    try {
      fs.appendFileSync(this.logFile, logEntry + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Create backup of HTML files before rotation
   */
  createBackup(filePaths) {
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubdir = path.join(this.backupDir, backupTimestamp);
    
    if (!fs.existsSync(backupSubdir)) {
      fs.mkdirSync(backupSubdir, { recursive: true });
    }
    
    filePaths.forEach(filePath => {
      try {
        const fileName = path.basename(filePath);
        const backupPath = path.join(backupSubdir, fileName);
        fs.copyFileSync(filePath, backupPath);
      } catch (error) {
        this.log(`Failed to backup ${filePath}: ${error.message}`, 'ERROR');
      }
    });
    
    this.log(`Created backup at ${backupSubdir}`);
    return backupSubdir;
  }

  /**
   * Use OpenAI to intelligently select and place seeds with comprehensive validation
   */
  async generateRotationPlan(targetLocations, availableSeeds) {
    // Input validation
    if (!this.validateInputs(targetLocations, availableSeeds)) {
      this.log('Invalid inputs for rotation plan generation', 'ERROR');
      return this.generateFallbackRotationPlan(targetLocations, availableSeeds);
    }

    try {
      if (!openaiService.hasValidApiKey || !openaiService.hasValidApiKey()) {
        this.log('OpenAI API key not available, using fallback rotation logic', 'WARN');
        return this.generateFallbackRotationPlan(targetLocations, availableSeeds);
      }

      const prompt = `
You are an expert SEO content strategist for The Current-See, a revolutionary solar-powered global basic income platform. Your task is to create an intelligent seed rotation plan.

AVAILABLE SEEDS:
${availableSeeds.map((seed, i) => `${i + 1}. "${seed}"`).join('\n')}

TARGET LOCATIONS:
${targetLocations.map((loc, i) => `${i + 1}. ${loc.type} in ${loc.file} (current: "${loc.current}")`).join('\n')}

REQUIREMENTS:
1. Assign exactly one seed to each target location
2. Ensure seeds match the context and purpose of each location type
3. Avoid repetitive patterns that might appear artificial to search engines
4. Maintain The Current-See's philosophical consistency
5. Optimize for SEO while keeping content natural and meaningful

SEED PLACEMENT GUIDELINES:
- Meta descriptions: Use concise, keyword-rich seeds
- Tooltips: Use human-empowering, explanatory seeds  
- HTML comments: Use deep philosophical or systemic truth seeds
- Alt text: Use accessible, descriptive seeds
- Title variations: Use value-proposition seeds

Respond with JSON in this exact format:
{
  "rotation_plan": [
    {
      "target_index": 0,
      "seed_index": 5,
      "reasoning": "Brief explanation for this placement"
    }
  ],
  "rotation_strategy": "Overall strategy description",
  "seo_considerations": "SEO optimization notes"
}
`;

      const response = await openaiService.getEnergyAssistantResponse(prompt);
      
      if (!response || typeof response !== 'string' || response.trim().length === 0) {
        throw new Error('Empty or invalid response from OpenAI');
      }
      
      // Try to parse as JSON, fallback if needed
      let plan;
      try {
        plan = JSON.parse(response);
      } catch (parseError) {
        this.log(`OpenAI response parsing failed: ${parseError.message}`, 'WARN');
        return this.generateFallbackRotationPlan(targetLocations, availableSeeds);
      }

      // Validate the rotation plan structure
      if (!this.validateRotationPlan(plan, targetLocations, availableSeeds)) {
        this.log('Generated rotation plan failed validation, using fallback', 'WARN');
        return this.generateFallbackRotationPlan(targetLocations, availableSeeds);
      }
      
      this.log(`✅ Generated valid AI rotation plan with ${plan.rotation_plan?.length || 0} assignments`);
      return plan;
      
    } catch (error) {
      this.log(`❌ OpenAI rotation planning failed: ${error.message}`, 'ERROR');
      return this.generateFallbackRotationPlan(targetLocations, availableSeeds);
    }
  }

  /**
   * Validate inputs for rotation plan generation
   */
  validateInputs(targetLocations, availableSeeds) {
    if (!Array.isArray(targetLocations)) {
      this.log('Target locations must be an array', 'ERROR');
      return false;
    }

    if (!Array.isArray(availableSeeds)) {
      this.log('Available seeds must be an array', 'ERROR');
      return false;
    }

    if (targetLocations.length === 0) {
      this.log('No target locations provided', 'ERROR');
      return false;
    }

    if (availableSeeds.length === 0) {
      this.log('No available seeds provided', 'ERROR');
      return false;
    }

    // Validate target location structure
    for (let i = 0; i < targetLocations.length; i++) {
      const target = targetLocations[i];
      if (!target || typeof target !== 'object') {
        this.log(`Invalid target at index ${i}: not an object`, 'ERROR');
        return false;
      }
      
      if (!target.type || typeof target.type !== 'string') {
        this.log(`Invalid target at index ${i}: missing or invalid type`, 'ERROR');
        return false;
      }
      
      if (!target.file || typeof target.file !== 'string') {
        this.log(`Invalid target at index ${i}: missing or invalid file`, 'ERROR');
        return false;
      }
    }

    // Validate seeds are strings
    for (let i = 0; i < availableSeeds.length; i++) {
      if (typeof availableSeeds[i] !== 'string' || availableSeeds[i].trim().length === 0) {
        this.log(`Invalid seed at index ${i}: must be non-empty string`, 'ERROR');
        return false;
      }
    }

    return true;
  }

  /**
   * Validate rotation plan structure and bounds
   */
  validateRotationPlan(plan, targetLocations, availableSeeds) {
    if (!plan || typeof plan !== 'object') {
      this.log('Rotation plan is not an object', 'ERROR');
      return false;
    }

    if (!Array.isArray(plan.rotation_plan)) {
      this.log('Rotation plan missing rotation_plan array', 'ERROR');
      return false;
    }

    // Validate each assignment in the plan
    for (let i = 0; i < plan.rotation_plan.length; i++) {
      const assignment = plan.rotation_plan[i];
      
      if (!assignment || typeof assignment !== 'object') {
        this.log(`Assignment ${i} is not an object`, 'ERROR');
        return false;
      }

      // Validate target_index bounds
      if (typeof assignment.target_index !== 'number') {
        this.log(`Assignment ${i} target_index is not a number`, 'ERROR');
        return false;
      }

      if (assignment.target_index < 0 || assignment.target_index >= targetLocations.length) {
        this.log(`Assignment ${i} target_index ${assignment.target_index} out of bounds (0-${targetLocations.length-1})`, 'ERROR');
        return false;
      }

      // Validate seed_index bounds
      if (typeof assignment.seed_index !== 'number') {
        this.log(`Assignment ${i} seed_index is not a number`, 'ERROR');
        return false;
      }

      if (assignment.seed_index < 0 || assignment.seed_index >= availableSeeds.length) {
        this.log(`Assignment ${i} seed_index ${assignment.seed_index} out of bounds (0-${availableSeeds.length-1})`, 'ERROR');
        return false;
      }

      // Optional: validate reasoning is present and reasonable
      if (assignment.reasoning && typeof assignment.reasoning !== 'string') {
        this.log(`Assignment ${i} reasoning must be a string if provided`, 'WARN');
      }
    }

    this.log(`✅ Rotation plan validation passed: ${plan.rotation_plan.length} valid assignments`);
    return true;
  }

  /**
   * Fallback rotation logic when OpenAI is not available
   */
  generateFallbackRotationPlan(targetLocations, availableSeeds) {
    const plan = {
      rotation_plan: [],
      rotation_strategy: "Fallback intelligent rotation using category-based matching",
      seo_considerations: "Distributing seeds to avoid patterns while maintaining relevance"
    };

    // Create smart assignments based on target type
    targetLocations.forEach((location, targetIndex) => {
      const suitableSeeds = seedDatabase.getSeedsForTarget(location.type);
      const availableSuitableSeeds = suitableSeeds.filter(seed => 
        availableSeeds.includes(seed)
      );
      
      let selectedSeedIndex;
      if (availableSuitableSeeds.length > 0) {
        const randomSeed = availableSuitableSeeds[
          Math.floor(Math.random() * availableSuitableSeeds.length)
        ];
        selectedSeedIndex = availableSeeds.indexOf(randomSeed);
      } else {
        // Fallback to any available seed
        selectedSeedIndex = Math.floor(Math.random() * availableSeeds.length);
      }
      
      plan.rotation_plan.push({
        target_index: targetIndex,
        seed_index: selectedSeedIndex,
        reasoning: `Matched ${location.type} with appropriate seed category`
      });
    });

    return plan;
  }

  /**
   * Parse HTML files to find seed target locations - SAFE VERSION using cheerio
   */
  parseHTMLForTargets(filePath) {
    const targets = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      const $ = cheerio.load(content, { 
        xmlMode: false,
        decodeEntities: false,
        normalizeWhitespace: false,
        recognizeSelfClosing: true,
        lowerCaseAttributeNames: false
      });
      
      // Find meta descriptions
      $('meta[name="description"]').each((i, elem) => {
        const $elem = $(elem);
        const currentContent = $elem.attr('content');
        if (currentContent && currentContent.trim()) {
          targets.push({
            type: 'meta_description',
            file: fileName,
            current: currentContent,
            element: elem,
            selector: 'meta[name="description"]',
            attribute: 'content'
          });
        }
      });

      // Find meta keywords
      $('meta[name="keywords"]').each((i, elem) => {
        const $elem = $(elem);
        const currentContent = $elem.attr('content');
        if (currentContent && currentContent.trim()) {
          targets.push({
            type: 'meta_keywords',
            file: fileName,
            current: currentContent,
            element: elem,
            selector: 'meta[name="keywords"]',
            attribute: 'content'
          });
        }
      });

      // Find title attributes (tooltips) - limit to 3 per file
      let titleCount = 0;
      $('[title]').each((i, elem) => {
        if (titleCount >= 3) return false; // Stop after 3
        
        const $elem = $(elem);
        const currentTitle = $elem.attr('title');
        if (currentTitle && currentTitle.trim() && currentTitle.length > 5) { // Only meaningful titles
          targets.push({
            type: 'tooltip',
            file: fileName,
            current: currentTitle,
            element: elem,
            attribute: 'title',
            selector: $elem.prop('tagName').toLowerCase() + (elem.attribs.id ? `#${elem.attribs.id}` : '')
          });
          titleCount++;
        }
      });

      // Find HTML comments containing seeds keywords
      const html = $.html();
      const commentRegex = /<!--\s*(.*?(?:Seeds?|value-for-value|solar|energy|basic income).*?)\s*-->/gi;
      let match;
      let commentIndex = 0;
      while ((match = commentRegex.exec(html)) !== null && commentIndex < 2) { // Limit comments
        targets.push({
          type: 'html_comment',
          file: fileName,
          current: match[1].trim(),
          commentIndex: commentIndex,
          fullComment: match[0]
        });
        commentIndex++;
      }

      // Find alt text with current seeds keywords
      $('img[alt]').each((i, elem) => {
        const $elem = $(elem);
        const altText = $elem.attr('alt');
        if (altText && /(?:Seeds?|value-for-value|solar|energy|basic income)/i.test(altText)) {
          targets.push({
            type: 'alt_text',
            file: fileName,
            current: altText,
            element: elem,
            selector: 'img',
            attribute: 'alt'
          });
        }
      });

      this.log(`Safe parsing found ${targets.length} targets in ${fileName}`);

    } catch (error) {
      this.log(`Failed to safely parse ${filePath}: ${error.message}`, 'ERROR');
    }
    
    return targets;
  }

  /**
   * Apply rotation plan to HTML files - SAFE VERSION with atomic operations
   */
  applyRotationPlan(rotationPlan, targetLocations, selectedSeeds) {
    const fileUpdates = new Map();
    
    // Group updates by file
    rotationPlan.rotation_plan.forEach(assignment => {
      const target = targetLocations[assignment.target_index];
      const newSeed = selectedSeeds[assignment.seed_index];
      
      if (!fileUpdates.has(target.file)) {
        fileUpdates.set(target.file, []);
      }
      
      fileUpdates.get(target.file).push({
        target,
        newSeed,
        reasoning: assignment.reasoning
      });
    });

    // Apply updates to each file using atomic operations
    fileUpdates.forEach((updates, fileName) => {
      this.applyFileUpdatesAtomically(fileName, updates);
    });
  }

  /**
   * Apply updates to a single file atomically using temp file + rename
   */
  applyFileUpdatesAtomically(fileName, updates) {
    const filePath = path.join(__dirname, '../public', fileName);
    const tempFilePath = filePath + '.tmp.' + Date.now();
    
    try {
      // Read original file
      const originalContent = fs.readFileSync(filePath, 'utf8');
      
      // Load with cheerio for safe manipulation
      const $ = cheerio.load(originalContent, { 
        xmlMode: false,
        decodeEntities: false,
        normalizeWhitespace: false,
        recognizeSelfClosing: true,
        lowerCaseAttributeNames: false
      });
      
      let updateCount = 0;
      let html = originalContent;
      
      // Apply updates safely
      updates.forEach(update => {
        const { target, newSeed, reasoning } = update;
        
        try {
          switch (target.type) {
            case 'meta_description':
              $('meta[name="description"]').attr('content', newSeed);
              updateCount++;
              this.log(`Updated meta description in ${fileName}: "${target.current}" → "${newSeed}" (${reasoning})`);
              break;
              
            case 'meta_keywords':
              $('meta[name="keywords"]').attr('content', newSeed);
              updateCount++;
              this.log(`Updated meta keywords in ${fileName}: "${target.current}" → "${newSeed}" (${reasoning})`);
              break;
              
            case 'tooltip':
              if (target.element && target.element.attribs) {
                $(target.element).attr('title', newSeed);
                updateCount++;
                this.log(`Updated tooltip in ${fileName}: "${target.current}" → "${newSeed}" (${reasoning})`);
              }
              break;
              
            case 'html_comment':
              // For comments, replace in the raw HTML since cheerio doesn't handle them well
              const oldComment = target.fullComment;
              const newComment = `<!-- ${newSeed} -->`;
              html = html.replace(oldComment, newComment);
              updateCount++;
              this.log(`Updated HTML comment in ${fileName}: "${target.current}" → "${newSeed}" (${reasoning})`);
              break;
              
            case 'alt_text':
              if (target.element && target.element.attribs) {
                $(target.element).attr('alt', newSeed);
                updateCount++;
                this.log(`Updated alt text in ${fileName}: "${target.current}" → "${newSeed}" (${reasoning})`);
              }
              break;
              
            default:
              this.log(`Skipping unknown target type: ${target.type}`, 'WARN');
          }
        } catch (updateError) {
          this.log(`Failed to apply update to ${target.type} in ${fileName}: ${updateError.message}`, 'ERROR');
        }
      });
      
      // Get the final HTML content
      let finalContent;
      const hasCommentUpdates = updates.some(update => update.target.type === 'html_comment');
      if (hasCommentUpdates) {
        // Use the modified raw HTML for comment changes
        finalContent = html;
      } else {
        // Use cheerio's output for DOM changes
        finalContent = $.html();
      }
      
      // Validate the output isn't broken
      if (!this.validateHTMLOutput(finalContent, originalContent)) {
        throw new Error('HTML validation failed - output appears corrupted');
      }
      
      // Write to temp file first (atomic operation)
      fs.writeFileSync(tempFilePath, finalContent, 'utf8');
      
      // Verify temp file was written correctly
      const tempContent = fs.readFileSync(tempFilePath, 'utf8');
      if (tempContent !== finalContent) {
        throw new Error('Temp file verification failed');
      }
      
      // Atomic rename (most OS file systems guarantee this is atomic)
      fs.renameSync(tempFilePath, filePath);
      
      this.log(`✅ Atomically applied ${updateCount} updates to ${fileName}`);
      
    } catch (error) {
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        this.log(`Failed to cleanup temp file ${tempFilePath}: ${cleanupError.message}`, 'ERROR');
      }
      
      this.log(`❌ Failed to atomically update ${fileName}: ${error.message}`, 'ERROR');
      throw error; // Re-throw to trigger rollback if needed
    }
  }

  /**
   * Validate HTML output to ensure it's not corrupted
   */
  validateHTMLOutput(newContent, originalContent) {
    try {
      // Basic validation checks
      if (!newContent || newContent.trim().length === 0) {
        this.log('HTML validation failed: empty content', 'ERROR');
        return false;
      }
      
      // Check that essential HTML structure is preserved
      const hasDoctype = /<!DOCTYPE\s+html/i.test(newContent);
      const hasHtmlTag = /<html[\s>]/i.test(newContent);
      const hasHead = /<head[\s>]/i.test(newContent);
      const hasBody = /<body[\s>]/i.test(newContent);
      
      const originalHasDoctype = /<!DOCTYPE\s+html/i.test(originalContent);
      const originalHasHtmlTag = /<html[\s>]/i.test(originalContent);
      const originalHasHead = /<head[\s>]/i.test(originalContent);
      const originalHasBody = /<body[\s>]/i.test(originalContent);
      
      // Ensure critical structure wasn't removed
      if (originalHasDoctype && !hasDoctype) {
        this.log('HTML validation failed: DOCTYPE removed', 'ERROR');
        return false;
      }
      
      if (originalHasHtmlTag && !hasHtmlTag) {
        this.log('HTML validation failed: HTML tag removed', 'ERROR');
        return false;
      }
      
      if (originalHasHead && !hasHead) {
        this.log('HTML validation failed: HEAD tag removed', 'ERROR');
        return false;
      }
      
      if (originalHasBody && !hasBody) {
        this.log('HTML validation failed: BODY tag removed', 'ERROR');
        return false;
      }
      
      // Check that content isn't drastically shorter (possible corruption)
      if (newContent.length < originalContent.length * 0.8) {
        this.log(`HTML validation failed: content too short (${newContent.length} vs ${originalContent.length})`, 'ERROR');
        return false;
      }
      
      this.log('HTML validation passed');
      return true;
      
    } catch (validationError) {
      this.log(`HTML validation error: ${validationError.message}`, 'ERROR');
      return false;
    }
  }

  /**
   * Perform the main seed rotation process
   */
  async performRotation() {
    if (this.isRotating) {
      this.log('Rotation already in progress, skipping...', 'WARN');
      return false;
    }

    this.isRotating = true;
    this.log('🚀 Starting seed rotation process');

    try {
      // Get list of HTML files to process
      const publicDir = path.join(__dirname, '../public');
      const htmlFiles = fs.readdirSync(publicDir)
        .filter(file => file.endsWith('.html'))
        .map(file => path.join(publicDir, file));

      if (htmlFiles.length === 0) {
        this.log('No HTML files found for rotation', 'WARN');
        return false;
      }

      // Create backup
      const backupPath = this.createBackup(htmlFiles);

      // Parse all HTML files for target locations
      const allTargets = [];
      htmlFiles.forEach(filePath => {
        const targets = this.parseHTMLForTargets(filePath);
        allTargets.push(...targets);
      });

      if (allTargets.length === 0) {
        this.log('No seed target locations found in HTML files', 'WARN');
        return false;
      }

      this.log(`Found ${allTargets.length} seed target locations across ${htmlFiles.length} files`);

      // Get available seeds for rotation
      const availableSeeds = seedDatabase.getRandomSeeds(allTargets.length + 5); // Get a few extra for variety

      // Generate rotation plan using OpenAI
      const rotationPlan = await this.generateRotationPlan(allTargets, availableSeeds);

      if (!rotationPlan || !rotationPlan.rotation_plan) {
        this.log('Failed to generate rotation plan', 'ERROR');
        return false;
      }

      // Apply the rotation plan
      this.applyRotationPlan(rotationPlan, allTargets, availableSeeds);

      // Update rotation state
      this.lastRotationTime = new Date();
      this.saveRotationState();

      this.log(`✅ Seed rotation completed successfully. Strategy: ${rotationPlan.rotation_strategy}`);
      return true;

    } catch (error) {
      this.log(`❌ Seed rotation failed: ${error.message}`, 'ERROR');
      return false;
    } finally {
      this.isRotating = false;
    }
  }

  /**
   * Schedule automatic rotations every 3 days for stability
   */
  scheduleRotations() {
    try {
      // Schedule to run based on configured interval at 3:00 AM for better stability and SEO
      const cronExpression = `0 3 */${this.config.rotationInterval} * *`;
      const job = schedule.scheduleJob(cronExpression, async () => {
        this.log('🕒 Scheduled rotation starting (3-day interval)...');
        
        try {
          // Add safety check before rotation
          if (this.isRotating) {
            this.log('Skipping scheduled rotation - already in progress', 'WARN');
            return;
          }
          
          // Check if last rotation was too recent (prevent overlapping)
          if (this.lastRotationTime) {
            const timeSinceLastRotation = Date.now() - new Date(this.lastRotationTime).getTime();
            const daysSinceLastRotation = timeSinceLastRotation / (1000 * 60 * 60 * 24);
            
            if (daysSinceLastRotation < 2.5) {
              this.log(`Skipping scheduled rotation - last rotation was ${daysSinceLastRotation.toFixed(1)} days ago`, 'INFO');
              return;
            }
          }
          
          const result = await this.performRotation();
          
          if (result) {
            this.log('✅ Scheduled rotation completed successfully');
          } else {
            this.log('❌ Scheduled rotation failed', 'ERROR');
          }
          
        } catch (rotationError) {
          this.log(`❌ Scheduled rotation error: ${rotationError.message}`, 'ERROR');
        }
      });

      if (job) {
        this.log('📅 Scheduled rotations every 3 days at 3:00 AM for stability');
        this.scheduledJob = job;
        return job;
      } else {
        throw new Error('Failed to create scheduled job');
      }
      
    } catch (error) {
      this.log(`❌ Failed to schedule rotations: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Cancel scheduled rotations
   */
  cancelScheduledRotations() {
    if (this.scheduledJob) {
      this.scheduledJob.cancel();
      this.scheduledJob = null;
      this.log('📅 Cancelled scheduled rotations');
      return true;
    }
    return false;
  }

  /**
   * Manually trigger a rotation (for testing or immediate needs)
   */
  async triggerRotation() {
    this.log('🔧 Manual rotation triggered');
    return await this.performRotation();
  }

  /**
   * Get rotation status and statistics
   */
  getStatus() {
    return {
      lastRotationTime: this.lastRotationTime,
      isRotating: this.isRotating,
      rotationCount: this.rotationLog.filter(entry => 
        entry.message.includes('rotation completed successfully')
      ).length,
      recentLogs: this.rotationLog.slice(-10),
      availableSeedCount: seedDatabase.getAllSeeds().length
    };
  }

  /**
   * Restore from backup (emergency function)
   */
  restoreFromBackup(backupTimestamp) {
    const backupPath = path.join(this.backupDir, backupTimestamp);
    
    if (!fs.existsSync(backupPath)) {
      this.log(`Backup not found: ${backupTimestamp}`, 'ERROR');
      return false;
    }

    try {
      const backupFiles = fs.readdirSync(backupPath);
      const publicDir = path.join(__dirname, '../public');
      
      let restoredCount = 0;
      backupFiles.forEach(fileName => {
        const backupFilePath = path.join(backupPath, fileName);
        const targetFilePath = path.join(publicDir, fileName);
        
        if (fileName.endsWith('.html')) {
          fs.copyFileSync(backupFilePath, targetFilePath);
          restoredCount++;
        }
      });
      
      this.log(`✅ Restored ${restoredCount} files from backup ${backupTimestamp}`);
      return true;
      
    } catch (error) {
      this.log(`❌ Failed to restore from backup: ${error.message}`, 'ERROR');
      return false;
    }
  }
}

module.exports = SeedRotator;
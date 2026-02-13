'use strict';

const PRINT3D_KEYWORDS = {
  'stl': 3, '3d print': 3, '3d model': 3, 'fabricate': 3, 'filament': 3, 'fdm': 3, 'sla': 3, 'resin': 3,
  'stand': 2, 'caddy': 2, 'holder': 2, 'hook': 2, 'bracket': 2, 'mount': 2, 'organizer': 2, 'planter': 2,
  'coaster': 2, 'figurine': 2, 'gear': 2, 'clip': 2, 'case': 2, 'enclosure': 2, 'housing': 2, 'knob': 2,
  'handle': 2, 'tool': 2, 'jig': 2, 'fixture': 2,
  'custom': 1, 'prototype': 1, 'maker': 1, 'build': 1, 'physical': 1, 'object': 1, 'thing': 1, 'part': 1, 'piece': 1
};

const PRINT2D_KEYWORDS = {
  'print': 3, 'printer': 3, 'paper': 3, 'label': 3, 'sticker': 3, 'poster': 3, 'flyer': 3, 'brochure': 3, 'pamphlet': 3,
  'certificate': 2, 'diploma': 2, 'voucher': 2, 'ticket': 2, 'receipt': 2, 'invoice': 2, 'card': 2,
  'business card': 2, 'badge': 2, 'id card': 2, 'pass': 2, 'coupon': 2, 'menu': 2, 'sign': 2, 'banner': 2,
  'document': 1, 'report': 1, 'letter': 1, 'form': 1, 'worksheet': 1, 'handout': 1, 'guide': 1, 'manual': 1, 'instruction': 1
};

const FILE_TYPE_KEYWORDS = {
  audio: {
    keywords: { 'song': 1, 'music': 1, 'beat': 1, 'track': 1, 'audio': 1, 'mp3': 1, 'wav': 1, 'remix': 1, 'instrumental': 1, 'podcast': 1 },
    type: 'audio',
    format: 'MP3'
  },
  video: {
    keywords: { 'video': 1, 'movie': 1, 'film': 1, 'clip': 1, 'animation': 1, 'mp4': 1, 'stream': 1 },
    type: 'video',
    format: 'MP4'
  },
  image: {
    keywords: { 'photo': 1, 'image': 1, 'picture': 1, 'art': 1, 'drawing': 1, 'illustration': 1, 'png': 1, 'jpg': 1, 'graphic': 1 },
    type: 'image',
    format: 'PNG'
  },
  document: {
    keywords: { 'pdf': 1, 'doc': 1, 'ebook': 1, 'book': 1, 'article': 1, 'essay': 1, 'thesis': 1, 'paper': 1, 'writing': 1 },
    type: 'document',
    format: 'PDF'
  },
  software: {
    keywords: { 'software': 1, 'app': 1, 'application': 1, 'code': 1, 'program': 1, 'script': 1, 'plugin': 1, 'extension': 1 },
    type: 'software',
    format: 'ZIP'
  },
  data: {
    keywords: { 'data': 1, 'dataset': 1, 'api': 1, 'json': 1, 'csv': 1, 'spreadsheet': 1 },
    type: 'data',
    format: 'JSON'
  }
};

const CATEGORY_DEFAULTS = {
  'Songs':        { fileType: 'audio',    format: 'MP3',  print3d: false, print2d: false },
  'Music':        { fileType: 'audio',    format: 'MP3',  print3d: false, print2d: false },
  'Videos':       { fileType: 'video',    format: 'MP4',  print3d: false, print2d: false },
  'Video':        { fileType: 'video',    format: 'MP4',  print3d: false, print2d: false },
  'Art':          { fileType: 'image',    format: 'PNG',  print3d: false, print2d: false },
  'Photo':        { fileType: 'image',    format: 'JPEG', print3d: false, print2d: false },
  'Writing':      { fileType: 'document', format: 'PDF',  print3d: false, print2d: false },
  'Docs':         { fileType: 'document', format: 'PDF',  print3d: false, print2d: false },
  'Education':    { fileType: 'document', format: 'PDF',  print3d: false, print2d: false },
  'Software':     { fileType: 'software', format: 'ZIP',  print3d: false, print2d: false },
  'AI Tools':     { fileType: 'software', format: 'ZIP',  print3d: false, print2d: false },
  'AI Create':    { fileType: 'software', format: 'ZIP',  print3d: false, print2d: false },
  'Games':        { fileType: 'software', format: 'ZIP',  print3d: false, print2d: false },
  'Utilities':    { fileType: 'software', format: 'ZIP',  print3d: false, print2d: false },
  '3D Printing':  { fileType: null,       format: null,   print3d: true,  print2d: false },
  'Computronium': { fileType: 'data',     format: 'JSON', print3d: false, print2d: false },
  'Energy':       { fileType: 'data',     format: 'JSON', print3d: false, print2d: false },
  'Basic Needs':  { fileType: 'document', format: 'PDF',  print3d: false, print2d: true  },
  'Rent':         { fileType: 'document', format: 'PDF',  print3d: false, print2d: true  },
  'Culture':      { fileType: 'document', format: 'PDF',  print3d: false, print2d: false }
};

function scoreKeywords(query, keywordMap) {
  let score = 0;
  const matched = [];
  const sortedKeys = Object.keys(keywordMap).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeys) {
    if (query.includes(keyword)) {
      score += keywordMap[keyword];
      matched.push(keyword);
    }
  }
  return { score, matched };
}

function inferDeliverables(query, options) {
  options = options || {};
  const normalizedQuery = (query || '').toLowerCase().trim();
  const category = options.category || '';
  const fileType = options.fileType || '';
  const forceprint = options.forceprint === true;

  const reasons = [];
  let print3dScore = 0;
  let print2dScore = 0;
  let bestFileType = null;
  let bestFileFormat = null;
  let bestFileScore = 0;
  let totalPossibleScore = 0;

  const print3dResult = scoreKeywords(normalizedQuery, PRINT3D_KEYWORDS);
  print3dScore = print3dResult.score;
  if (print3dResult.matched.length > 0) {
    reasons.push('3D keywords matched: ' + print3dResult.matched.join(', '));
  }

  const print2dResult = scoreKeywords(normalizedQuery, PRINT2D_KEYWORDS);
  print2dScore = print2dResult.score;
  if (print2dResult.matched.length > 0) {
    reasons.push('2D keywords matched: ' + print2dResult.matched.join(', '));
  }

  const fileScores = {};
  for (const key of Object.keys(FILE_TYPE_KEYWORDS)) {
    const ftDef = FILE_TYPE_KEYWORDS[key];
    const result = scoreKeywords(normalizedQuery, ftDef.keywords);
    fileScores[key] = result;
    if (result.score > bestFileScore) {
      bestFileScore = result.score;
      bestFileType = ftDef.type;
      bestFileFormat = ftDef.format;
    }
    if (result.matched.length > 0) {
      reasons.push(key + ' keywords matched: ' + result.matched.join(', '));
    }
  }

  if (fileType) {
    const ft = fileType.toLowerCase();
    for (const key of Object.keys(FILE_TYPE_KEYWORDS)) {
      const ftDef = FILE_TYPE_KEYWORDS[key];
      if (ftDef.type === ft || key === ft) {
        bestFileType = ftDef.type;
        bestFileFormat = ftDef.format;
        if (bestFileScore < 1) bestFileScore = 1;
        reasons.push('File type provided via options: ' + ft);
        break;
      }
    }
  }

  let print3d = print3dScore >= 2;
  let print2d = print2dScore >= 2;
  let filePresent = bestFileScore >= 1;

  const catDefaults = CATEGORY_DEFAULTS[category];
  if (catDefaults) {
    if (!filePresent && catDefaults.fileType) {
      bestFileType = catDefaults.fileType;
      bestFileFormat = catDefaults.format;
      filePresent = true;
      reasons.push('Category fallback applied: ' + category + ' → ' + catDefaults.fileType);
    }
    if (!print3d && catDefaults.print3d) {
      print3d = true;
      reasons.push('Category fallback applied: ' + category + ' → 3D print');
    }
    if (!print2d && catDefaults.print2d) {
      print2d = true;
      reasons.push('Category fallback applied: ' + category + ' → 2D print');
    }
  }

  let humanOverride = false;
  if (forceprint) {
    print2d = true;
    humanOverride = true;
    reasons.push('Human override: forced 2D print');
  }

  if (!filePresent && !print3d && !print2d && !catDefaults) {
    reasons.push('No strong keyword or category match; defaulting to context-only');
  }

  const deliverables = ['Context & Metadata'];
  if (filePresent && bestFileType) {
    const formatLabels = {
      audio: 'Audio File (' + (bestFileFormat || 'MP3') + ')',
      video: 'Video File (' + (bestFileFormat || 'MP4') + ')',
      image: 'Image File (' + (bestFileFormat || 'PNG') + ')',
      document: 'Document (' + (bestFileFormat || 'PDF') + ')',
      software: 'Software Package (' + (bestFileFormat || 'ZIP') + ')',
      data: 'Data File (' + (bestFileFormat || 'JSON') + ')'
    };
    deliverables.push(formatLabels[bestFileType] || 'Digital File');
  }
  if (print3d) {
    deliverables.push('3D Printer File (STL)');
  }
  if (print2d) {
    deliverables.push('2D Print Job');
  }

  const allScores = [print3dScore, print2dScore, bestFileScore];
  const maxScore = Math.max.apply(null, allScores);
  for (const key of Object.keys(PRINT3D_KEYWORDS)) {
    totalPossibleScore += PRINT3D_KEYWORDS[key];
  }
  let confidence = totalPossibleScore > 0 ? maxScore / totalPossibleScore : 0;
  if (confidence > 1) confidence = 1;
  confidence = parseFloat(confidence.toFixed(4));

  return {
    context: true,
    file: {
      present: filePresent,
      type: bestFileType || 'none',
      format: bestFileFormat || 'none'
    },
    print3d: print3d,
    print2d: print2d,
    humanOverride: humanOverride,
    category: category || 'unknown',
    confidence: confidence,
    reasoning: reasons.join('; ') || 'No matches found',
    deliverables: deliverables
  };
}

function getDeliverableLabel(matrix) {
  if (!matrix) return '📥 Digital File';

  const parts = [];

  if (matrix.file && matrix.file.present) {
    var typeLabels = {
      audio: '🎵 Audio',
      video: '🎬 Video',
      image: '🖼️ Image',
      document: '📄 Document',
      software: '💻 Software',
      data: '📊 Data'
    };
    parts.push(typeLabels[matrix.file.type] || '📥 Digital File');
  }

  if (matrix.print3d) {
    parts.push('🖨️ 3D');
  }

  if (matrix.print2d) {
    parts.push('📄 2D');
  }

  if (parts.length === 0) {
    return '📥 Digital File';
  }

  return parts.join(' + ');
}

module.exports = { inferDeliverables, getDeliverableLabel };

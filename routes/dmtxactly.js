const { Pool, neonConfig } = require('@neondatabase/serverless');
const wpc = require('../lib/wpc.js');
const crypto = require('crypto');

neonConfig.webSocketConstructor = require('ws');
neonConfig.fetch = require('node-fetch');
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PREGENERATED_IMAGES = {
  'hexagonal-tessellation': [
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1024&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1024&q=80',
    'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=1024&q=80'
  ],
  'penrose-tiling': [
    'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=1024&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024&q=80',
    'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1024&q=80'
  ],
  'voronoi-cells': [
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1024&q=80',
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1024&q=80',
    'https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?w=1024&q=80'
  ],
  'islamic-geometric': [
    'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?w=1024&q=80',
    'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=1024&q=80',
    'https://images.unsplash.com/photo-1609619385002-f40f1df85b87?w=1024&q=80'
  ],
  'fractal-mandelbrot': [
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1024&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024&q=80',
    'https://images.unsplash.com/photo-1614850715649-1d0106293bd1?w=1024&q=80'
  ],
  'escher-transformation': [
    'https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d?w=1024&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1024&q=80',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1024&q=80'
  ],
  'custom': [
    'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=1024&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1024&q=80',
    'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1024&q=80',
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1024&q=80',
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1024&q=80'
  ]
};

const DMTXACTLY_PATTERNS = [
  {
    id: 'hexagonal-tessellation',
    name: 'Hexagonal Tessellation',
    description: 'Classic honeycomb pattern with customizable colors and scale',
    geometry: 'hexagon',
    energyProfile: { model: 'diffusion', resolution: 1024, powerWatts: 300, seconds: 15 }
  },
  {
    id: 'penrose-tiling',
    name: 'Penrose Tiling',
    description: 'Aperiodic tiling with five-fold symmetry, mathematically precise',
    geometry: 'penrose',
    energyProfile: { model: 'diffusion', resolution: 1024, powerWatts: 350, seconds: 20 }
  },
  {
    id: 'voronoi-cells',
    name: 'Voronoi Cells',
    description: 'Organic cellular patterns based on Voronoi diagrams',
    geometry: 'voronoi',
    energyProfile: { model: 'diffusion', resolution: 1024, powerWatts: 280, seconds: 12 }
  },
  {
    id: 'islamic-geometric',
    name: 'Islamic Geometric Art',
    description: 'Traditional Islamic star patterns with intricate symmetry',
    geometry: 'islamic',
    energyProfile: { model: 'diffusion', resolution: 1024, powerWatts: 400, seconds: 25 }
  },
  {
    id: 'fractal-mandelbrot',
    name: 'Fractal Mandelbrot',
    description: 'Deep zoom into the Mandelbrot set with custom color palettes',
    geometry: 'fractal',
    energyProfile: { model: 'diffusion', resolution: 2048, powerWatts: 500, seconds: 45 }
  },
  {
    id: 'escher-transformation',
    name: 'Escher Transformation',
    description: 'M.C. Escher-inspired metamorphosis patterns',
    geometry: 'escher',
    energyProfile: { model: 'diffusion', resolution: 1024, powerWatts: 380, seconds: 22 }
  }
];

function selectPregenerated(patternId, prompt) {
  const imagePool = PREGENERATED_IMAGES[patternId] || PREGENERATED_IMAGES['custom'];
  const hash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return imagePool[hash % imagePool.length];
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-DMTXACTLY-API-Key'
  });
  res.end(JSON.stringify(data));
}

async function handleDmtxactlyRoutes(req, res, pathname, body) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-DMTXACTLY-API-Key'
    });
    res.end();
    return true;
  }

  if (pathname === '/api/dmtxactly/capabilities' && req.method === 'GET') {
    const capabilities = {
      openapi: '3.1.0',
      info: {
        title: 'DMTXACTLY Creative API',
        version: '1.0.0',
        description: 'AI-accessible API for tessellated visual art on the TC-S Network. Currently serves pre-generated artwork (free). FUTURE: Live AI generation via Solar pay gate.',
        contact: {
          name: 'TC-S Network Foundation',
          url: 'https://www.thecurrentsee.org'
        }
      },
      servers: [
        {
          url: 'https://www.thecurrentsee.org/api/dmtxactly',
          description: 'Production DMTXACTLY API'
        }
      ],
      'x-mode': 'pregenerated',
      'x-future-paygate': 'Solar Rays required for live DALL-E generation',
      paths: {
        '/patterns': {
          get: {
            operationId: 'listPatterns',
            summary: 'List available tessellation patterns',
            description: 'Returns all available pattern types with their geometry and energy profiles'
          }
        },
        '/estimate': {
          post: {
            operationId: 'estimateComputeCost',
            summary: 'Estimate Solar cost for generation',
            description: 'Calculate the Solar token and Solar Ray cost for a generation request'
          }
        },
        '/generate': {
          post: {
            operationId: 'generateArt',
            summary: 'Generate tessellated visual art (pre-generated mode)',
            description: 'Returns pre-generated tessellated artwork from curated collection. Currently free. FUTURE: Live AI via Solar pay gate.'
          }
        },
        '/export': {
          post: {
            operationId: 'exportToMarketplace',
            summary: 'Export generated art to TC-S Marketplace',
            description: 'Publish artwork as a digital artifact for trading with Solar tokens'
          }
        }
      },
      'x-uim-handshake': {
        protocol: 'UIM Handshake v1.0',
        capabilities: ['tessellation', 'generative-art', 'ai-creativity', 'solar-metered-compute'],
        energyStandard: 'Solar Standard Protocol v1.0 (1 Solar = 4,913 kWh)'
      }
    };
    sendJSON(res, 200, capabilities);
    return true;
  }

  if (pathname === '/api/dmtxactly/patterns' && req.method === 'GET') {
    sendJSON(res, 200, {
      patterns: DMTXACTLY_PATTERNS,
      count: DMTXACTLY_PATTERNS.length,
      mode: 'pregenerated',
      energyStandard: '1 Solar = 4,913 kWh = 1,000 Solar Rays',
      _notice: 'Pre-generated artwork available. Live AI generation coming with Solar pay gate.'
    });
    return true;
  }

  if (pathname === '/api/dmtxactly/estimate' && req.method === 'POST') {
    try {
      const { patternId, resolution = 1024, prompt } = body || {};
      
      let energyProfile = {
        model: 'diffusion',
        resolution: resolution,
        powerWatts: 300,
        seconds: 15
      };
      
      if (patternId) {
        const pattern = DMTXACTLY_PATTERNS.find(p => p.id === patternId);
        if (pattern) {
          energyProfile = { ...pattern.energyProfile, resolution };
        }
      }
      
      if (prompt && prompt.length > 100) {
        energyProfile.seconds *= 1.2;
      }
      
      const metrics = wpc.computeAll(energyProfile);
      
      sendJSON(res, 200, {
        estimate: {
          solarCost: metrics.solar,
          raysCost: Math.ceil(metrics.rays),
          kWh: metrics.kWh,
          joules: metrics.joules,
          wpcGrade: metrics.grade,
          flops: metrics.flops
        },
        pattern: patternId || 'custom',
        resolution,
        mode: 'pregenerated',
        currentCost: 'FREE (pre-generated)',
        futureCost: 'Solar Rays (live AI generation)',
        energyStandard: '1 Solar = 4,913 kWh = 1,000 Solar Rays'
      });
    } catch (error) {
      console.error('DMTXACTLY estimate error:', error);
      sendJSON(res, 500, { error: 'Failed to estimate compute cost', message: error.message });
    }
    return true;
  }

  if (pathname === '/api/dmtxactly/generate' && req.method === 'POST') {
    try {
      const { prompt, patternId, resolution = 1024, style } = body || {};
      
      if (!prompt) {
        sendJSON(res, 400, { error: 'Missing required field: prompt' });
        return true;
      }
      
      let energyProfile = {
        model: 'diffusion',
        resolution: resolution,
        powerWatts: 300,
        seconds: 15
      };
      
      let patternName = 'Custom';
      if (patternId) {
        const pattern = DMTXACTLY_PATTERNS.find(p => p.id === patternId);
        if (pattern) {
          energyProfile = { ...pattern.energyProfile, resolution };
          patternName = pattern.name;
        }
      }
      
      const imageUrl = selectPregenerated(patternId || 'custom', prompt);
      const metrics = wpc.computeAll(energyProfile);
      
      const jobId = crypto.randomUUID();
      
      try {
        await pool.query(
          `INSERT INTO dmtxactly_jobs (id, job_type, pattern_type, prompt, parameters, status, result_image_url, solar_cost, rays_cost, wpc_grade, compute_metrics, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [
            jobId,
            'generate',
            patternId || 'custom',
            prompt,
            JSON.stringify({ resolution, style, patternId, mode: 'pregenerated' }),
            'completed',
            imageUrl,
            metrics.solar.toString(),
            Math.ceil(metrics.rays),
            metrics.grade,
            JSON.stringify(metrics)
          ]
        );
      } catch (dbError) {
        console.warn('DMTXACTLY job logging failed (non-critical):', dbError.message);
      }
      
      sendJSON(res, 200, {
        jobId: jobId,
        imageUrl: imageUrl,
        prompt: prompt,
        pattern: patternId || 'custom',
        patternName: patternName,
        resolution,
        mode: 'pregenerated',
        compute: {
          solarCost: metrics.solar,
          raysCost: Math.ceil(metrics.rays),
          wpcGrade: metrics.grade,
          kWh: metrics.kWh
        },
        energyStandard: '1 Solar = 4,913 kWh = 1,000 Solar Rays',
        exportable: true,
        exportEndpoint: '/api/dmtxactly/export',
        _notice: 'Using pre-generated artwork. Live AI generation coming with Solar pay gate.'
      });
    } catch (error) {
      console.error('DMTXACTLY generate error:', error);
      sendJSON(res, 500, { error: 'Failed to generate artwork', message: error.message });
    }
    return true;
  }

  if (pathname === '/api/dmtxactly/export' && req.method === 'POST') {
    try {
      const { jobId, title, description, priceRays = 100 } = body || {};
      
      if (!jobId || !title) {
        sendJSON(res, 400, { error: 'Missing required fields: jobId and title' });
        return true;
      }
      
      const jobResult = await pool.query('SELECT * FROM dmtxactly_jobs WHERE id = $1', [jobId]);
      
      if (jobResult.rows.length === 0) {
        sendJSON(res, 404, { error: 'Job not found' });
        return true;
      }
      
      const job = jobResult.rows[0];
      
      if (!job.result_image_url) {
        sendJSON(res, 400, { error: 'Job has no generated image to export' });
        return true;
      }
      
      const slug = `dmtxactly-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      const solarAmount = (priceRays / 1000).toFixed(6);
      const kwhFootprint = (parseFloat(solarAmount) * 4913).toFixed(2);
      
      const artifactResult = await pool.query(
        `INSERT INTO artifacts (slug, title, description, category, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, delivery_url, creator_id, cover_art_url, master_file_url, preview_file_url, trade_file_url, preview_type, processing_status, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id, slug`,
        [
          slug,
          title,
          description || `DMTXACTLY tessellated artwork: ${job.prompt}`,
          'Digital Art',
          'image/png',
          kwhFootprint,
          solarAmount,
          priceRays,
          'download',
          job.result_image_url,
          'dmtxactly-api',
          job.result_image_url,
          job.result_image_url,
          job.result_image_url,
          job.result_image_url,
          'image',
          'completed',
          true
        ]
      );
      
      const artifact = artifactResult.rows[0];
      
      await pool.query('UPDATE dmtxactly_jobs SET artifact_id = $1 WHERE id = $2', [artifact.id, jobId]);
      
      sendJSON(res, 200, {
        success: true,
        artifact: {
          id: artifact.id,
          slug: artifact.slug,
          title: title,
          priceRays: priceRays,
          priceSolar: solarAmount,
          marketplaceUrl: `https://www.thecurrentsee.org/marketplace.html#${artifact.slug}`
        },
        message: 'Artwork successfully exported to TC-S Marketplace'
      });
    } catch (error) {
      console.error('DMTXACTLY export error:', error);
      sendJSON(res, 500, { error: 'Failed to export to marketplace', message: error.message });
    }
    return true;
  }

  if (pathname.startsWith('/api/dmtxactly/jobs/') && req.method === 'GET') {
    try {
      const jobId = pathname.split('/').pop();
      
      const jobResult = await pool.query('SELECT * FROM dmtxactly_jobs WHERE id = $1', [jobId]);
      
      if (jobResult.rows.length === 0) {
        sendJSON(res, 404, { error: 'Job not found' });
        return true;
      }
      
      const job = jobResult.rows[0];
      
      sendJSON(res, 200, {
        job: {
          id: job.id,
          status: job.status,
          jobType: job.job_type,
          pattern: job.pattern_type,
          prompt: job.prompt,
          imageUrl: job.result_image_url,
          mode: 'pregenerated',
          compute: {
            solarCost: job.solar_cost,
            raysCost: job.rays_cost,
            wpcGrade: job.wpc_grade
          },
          artifactId: job.artifact_id,
          createdAt: job.created_at,
          completedAt: job.completed_at
        }
      });
    } catch (error) {
      console.error('DMTXACTLY job lookup error:', error);
      sendJSON(res, 500, { error: 'Failed to retrieve job', message: error.message });
    }
    return true;
  }

  return false;
}

module.exports = handleDmtxactlyRoutes;

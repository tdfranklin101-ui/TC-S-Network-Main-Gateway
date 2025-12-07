import { Router } from 'express';
import { db } from '../db';
import { dmtxactlyJobs, agentApiKeys, artifacts, members } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import crypto from 'crypto';

const wpc = require('../../shared/wpc.js');

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

router.get('/capabilities', (req, res) => {
  const capabilities = {
    openapi: '3.1.0',
    info: {
      title: 'DMTXACTLY Creative API',
      version: '1.0.0',
      description: 'AI-accessible API for generating tessellated visual art on the TC-S Network. All compute is metered in Solar tokens (1 Solar = 4,913 kWh renewable energy).',
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
    paths: {
      '/patterns': {
        get: {
          operationId: 'listPatterns',
          summary: 'List available tessellation patterns',
          description: 'Returns all available pattern types with their geometry and energy profiles',
          responses: {
            '200': {
              description: 'Array of pattern definitions',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        geometry: { type: 'string' },
                        energyProfile: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/estimate': {
        post: {
          operationId: 'estimateComputeCost',
          summary: 'Estimate Solar cost for generation',
          description: 'Calculate the Solar token and Solar Ray cost for a generation request before executing',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    patternId: { type: 'string', description: 'Pattern type ID' },
                    resolution: { type: 'integer', default: 1024 },
                    prompt: { type: 'string', description: 'Natural language prompt for AI generation' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Compute cost estimate in Solar tokens and rays',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      solarCost: { type: 'number' },
                      raysCost: { type: 'integer' },
                      wpcGrade: { type: 'string' },
                      kWh: { type: 'number' },
                      joules: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/generate': {
        post: {
          operationId: 'generateArt',
          summary: 'Generate tessellated visual art',
          description: 'Create a new tessellated artwork using AI. Requires authentication. Compute cost deducted in Solar Rays.',
          security: [{ apiKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['prompt'],
                  properties: {
                    prompt: { type: 'string', description: 'Natural language description of desired artwork' },
                    patternId: { type: 'string', description: 'Optional pattern type to guide generation' },
                    resolution: { type: 'integer', default: 1024 },
                    style: { type: 'string', description: 'Art style modifier' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Generated artwork with metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      jobId: { type: 'string' },
                      imageUrl: { type: 'string' },
                      previewUrl: { type: 'string' },
                      solarCost: { type: 'number' },
                      raysCost: { type: 'integer' },
                      wpcGrade: { type: 'string' },
                      pattern: { type: 'string' },
                      prompt: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/export': {
        post: {
          operationId: 'exportToMarketplace',
          summary: 'Export generated art to TC-S Marketplace',
          description: 'Publish a generated artwork as a digital artifact for trading with Solar tokens',
          security: [{ apiKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jobId', 'title'],
                  properties: {
                    jobId: { type: 'string', description: 'ID of the generation job to export' },
                    title: { type: 'string', description: 'Title for the marketplace listing' },
                    description: { type: 'string' },
                    priceRays: { type: 'integer', description: 'Price in Solar Rays' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Marketplace artifact created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      artifactId: { type: 'string' },
                      slug: { type: 'string' },
                      marketplaceUrl: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-DMTXACTLY-API-Key',
          description: 'API key for authenticated AI agent access'
        }
      }
    },
    'x-uim-handshake': {
      protocol: 'UIM Handshake v1.0',
      capabilities: ['tessellation', 'generative-art', 'ai-creativity', 'solar-metered-compute'],
      energyStandard: 'Solar Standard Protocol v1.0 (1 Solar = 4,913 kWh)'
    }
  };
  
  res.json(capabilities);
});

router.get('/patterns', (req, res) => {
  res.json({
    patterns: DMTXACTLY_PATTERNS,
    count: DMTXACTLY_PATTERNS.length,
    energyStandard: '1 Solar = 4,913 kWh = 1,000 Solar Rays'
  });
});

router.post('/estimate', (req, res) => {
  try {
    const { patternId, resolution = 1024, prompt } = req.body;
    
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
    
    res.json({
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
      energyStandard: '1 Solar = 4,913 kWh = 1,000 Solar Rays'
    });
  } catch (error: any) {
    console.error('Estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate compute cost', message: error.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { prompt, patternId, resolution = 1024, style } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI generation service not configured' });
    }
    
    let energyProfile = {
      model: 'diffusion',
      resolution: resolution,
      powerWatts: 300,
      seconds: 15
    };
    
    let patternGuide = '';
    if (patternId) {
      const pattern = DMTXACTLY_PATTERNS.find(p => p.id === patternId);
      if (pattern) {
        energyProfile = { ...pattern.energyProfile, resolution };
        patternGuide = `Style: ${pattern.name} (${pattern.geometry} geometry). `;
      }
    }
    
    const fullPrompt = `Create a high-quality tessellated digital artwork. ${patternGuide}${style ? `Art style: ${style}. ` : ''}Description: ${prompt}. Make it vibrant, mathematically precise, and visually stunning with intricate geometric patterns.`;
    
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: resolution >= 1792 ? '1792x1024' : '1024x1024',
      quality: 'hd',
      style: 'vivid'
    });
    
    const imageUrl = imageResponse.data?.[0]?.url;
    
    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to generate image' });
    }
    
    const metrics = wpc.computeAll(energyProfile);
    
    const [job] = await db.insert(dmtxactlyJobs).values({
      jobType: 'generate',
      patternType: patternId || 'custom',
      prompt: prompt,
      parameters: { resolution, style, patternId },
      status: 'completed',
      resultImageUrl: imageUrl,
      solarCost: metrics.solar.toString(),
      raysCost: Math.ceil(metrics.rays),
      wpcGrade: metrics.grade,
      computeMetrics: metrics,
      completedAt: new Date()
    }).returning();
    
    res.json({
      jobId: job.id,
      imageUrl: imageUrl,
      prompt: prompt,
      pattern: patternId || 'custom',
      resolution,
      compute: {
        solarCost: metrics.solar,
        raysCost: Math.ceil(metrics.rays),
        wpcGrade: metrics.grade,
        kWh: metrics.kWh
      },
      energyStandard: '1 Solar = 4,913 kWh = 1,000 Solar Rays',
      exportable: true,
      exportEndpoint: '/api/dmtxactly/export'
    });
    
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate artwork', message: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { jobId, title, description, priceRays = 100 } = req.body;
    
    if (!jobId || !title) {
      return res.status(400).json({ error: 'Missing required fields: jobId and title' });
    }
    
    const [job] = await db.select().from(dmtxactlyJobs).where(eq(dmtxactlyJobs.id, jobId));
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (!job.resultImageUrl) {
      return res.status(400).json({ error: 'Job has no generated image to export' });
    }
    
    const slug = `dmtxactly-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    
    const solarAmount = (priceRays / 1000).toFixed(6);
    const kwhFootprint = (parseFloat(solarAmount) * 4913).toFixed(2);
    
    const [artifact] = await db.insert(artifacts).values({
      slug,
      title,
      description: description || `DMTXACTLY tessellated artwork: ${job.prompt}`,
      category: 'Digital Art',
      fileType: 'image/png',
      kwhFootprint: kwhFootprint,
      solarAmountS: solarAmount,
      raysAmount: priceRays,
      deliveryMode: 'download',
      deliveryUrl: job.resultImageUrl,
      creatorId: 'dmtxactly-api',
      coverArtUrl: job.resultImageUrl,
      masterFileUrl: job.resultImageUrl,
      previewFileUrl: job.resultImageUrl,
      tradeFileUrl: job.resultImageUrl,
      previewType: 'image',
      processingStatus: 'completed',
      active: true
    }).returning();
    
    await db.update(dmtxactlyJobs)
      .set({ artifactId: artifact.id })
      .where(eq(dmtxactlyJobs.id, jobId));
    
    res.json({
      success: true,
      artifact: {
        id: artifact.id,
        slug: artifact.slug,
        title: artifact.title,
        priceRays: priceRays,
        priceSolar: solarAmount,
        marketplaceUrl: `https://www.thecurrentsee.org/marketplace.html#${artifact.slug}`
      },
      message: 'Artwork successfully exported to TC-S Marketplace'
    });
    
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export to marketplace', message: error.message });
  }
});

router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const [job] = await db.select().from(dmtxactlyJobs).where(eq(dmtxactlyJobs.id, jobId));
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({
      job: {
        id: job.id,
        status: job.status,
        jobType: job.jobType,
        pattern: job.patternType,
        prompt: job.prompt,
        imageUrl: job.resultImageUrl,
        compute: {
          solarCost: job.solarCost,
          raysCost: job.raysCost,
          wpcGrade: job.wpcGrade
        },
        artifactId: job.artifactId,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }
    });
  } catch (error: any) {
    console.error('Job lookup error:', error);
    res.status(500).json({ error: 'Failed to retrieve job', message: error.message });
  }
});

export default router;

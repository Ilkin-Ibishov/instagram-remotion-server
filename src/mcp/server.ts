#!/usr/bin/env node
/**
 * MCP Platform Server
 * 
 * Model Context Protocol server exposing Instagram/TikTok/YouTube content
 * generation and publishing platform for specialist AI bots.
 * 
 * Transport: stdio (standard MCP)
 * Usage: node dist/mcp/server.js
 */

import * as dotenv from 'dotenv';
import { renderNicheVoice } from './tools/renderNicheVoice';
import { publishPost } from './tools/publishPost';
import { getPostMetrics } from './tools/getPostMetrics';
import { listPublishedPosts } from './tools/listPublishedPosts';
import { listNiches } from './tools/listNiches';

dotenv.config();

interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

class McpServer {
  private toolHandlers: Map<string, (args: any) => Promise<any>>;

  constructor() {
    this.toolHandlers = new Map([
      ['render_niche_voice', renderNicheVoice],
      ['publish_post', publishPost],
      ['get_post_metrics', getPostMetrics],
      ['list_published_posts', listPublishedPosts],
      ['list_niches', listNiches],
    ]);
  }

  async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      if (request.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'instagram-mcp-platform',
              version: '1.0.0',
            },
          },
        };
      }

      if (request.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: [
              {
                name: 'render_niche_voice',
                description: 'Render content for a specific niche using account branding. Returns render URLs and local file paths.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    niche: {
                      type: 'string',
                      enum: ['technology', 'business', 'startup', 'ai', 'science'],
                      description: 'Account niche for branding context',
                    },
                    manifest: {
                      type: 'object',
                      description: 'Carousel manifest with globalBranding and carousel array',
                      properties: {
                        globalBranding: {
                          type: 'object',
                          properties: {
                            accentColor: { type: 'string' },
                            handle: { type: 'string' },
                            effects: { type: 'array', items: { type: 'string' } },
                          },
                          required: ['accentColor', 'handle', 'effects'],
                        },
                        carousel: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              templateId: { type: 'string' },
                              data: { type: 'object' },
                            },
                            required: ['templateId', 'data'],
                          },
                        },
                      },
                      required: ['globalBranding', 'carousel'],
                    },
                    format: {
                      type: 'string',
                      enum: ['png', 'mp4'],
                      description: 'Render format (default: mp4)',
                    },
                  },
                  required: ['niche', 'manifest'],
                },
              },
              {
                name: 'publish_post',
                description: 'Publish rendered media to a platform (Instagram, TikTok, YouTube Shorts). Instagram is production-ready; TikTok/YouTube return notImplemented.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    platform: {
                      type: 'string',
                      enum: ['instagram', 'tiktok', 'youtube_shorts'],
                      description: 'Target platform',
                    },
                    mediaPaths: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Local filesystem paths to media files',
                    },
                    caption: {
                      type: 'string',
                      description: 'Post caption text',
                    },
                    niche: {
                      type: 'string',
                      description: 'Account niche for session selection',
                    },
                    metadata: {
                      type: 'object',
                      properties: {
                        hashtags: { type: 'array', items: { type: 'string' } },
                        location: { type: 'string' },
                        schedule: { type: 'string', description: 'ISO 8601 timestamp (future)' },
                      },
                    },
                  },
                  required: ['platform', 'mediaPaths', 'caption', 'niche'],
                },
              },
              {
                name: 'get_post_metrics',
                description: 'Retrieve engagement metrics for a published post. Phase 1: Returns not available (live scraping not implemented). Phase 2: Live Instagram/TikTok/YouTube metrics.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    platform: {
                      type: 'string',
                      enum: ['instagram', 'tiktok', 'youtube_shorts'],
                      description: 'Platform where post was published',
                    },
                    permalink: {
                      type: 'string',
                      description: 'Platform-specific post URL',
                    },
                    batchId: {
                      type: 'string',
                      description: 'Internal render batch ID',
                    },
                    niche: {
                      type: 'string',
                      description: 'Account niche',
                    },
                  },
                  required: ['platform'],
                },
              },
              {
                name: 'list_published_posts',
                description: 'List recent published posts with metadata. Supports filtering by platform, niche, and recency.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    platform: {
                      type: 'string',
                      enum: ['instagram', 'tiktok', 'youtube_shorts'],
                      description: 'Filter by platform (optional)',
                    },
                    niche: {
                      type: 'string',
                      description: 'Filter by niche keyword (optional)',
                    },
                    limit: {
                      type: 'number',
                      description: 'Max posts to return (default: 10, max: 100)',
                    },
                    days: {
                      type: 'number',
                      description: 'Filter posts from last N days (optional)',
                    },
                  },
                },
              },
              {
                name: 'list_niches',
                description: 'List available account niches with platform support. Returns 5 locked niches: technology, business, startup, ai, science.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
          },
        };
      }

      if (request.method === 'tools/call') {
        const params = request.params as { name: string; arguments: any };
        const handler = this.toolHandlers.get(params.name);

        if (!handler) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${params.name}`,
            },
          };
        }

        const result = await handler(params.arguments ?? {});

        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
    } catch (error) {
      console.error('[mcp-server] Error handling request:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  start() {
    console.error('[mcp-server] Starting MCP platform server (stdio transport)');

    let buffer = '';

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const request = JSON.parse(trimmed) as McpRequest;
          const response = await this.handleRequest(request);
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
          console.error('[mcp-server] Failed to parse or handle request:', error);
        }
      }
    });

    process.stdin.on('end', () => {
      console.error('[mcp-server] stdin closed, exiting');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.error('[mcp-server] SIGINT received, exiting');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('[mcp-server] SIGTERM received, exiting');
      process.exit(0);
    });
  }
}

// Start server
const server = new McpServer();
server.start();

/**
 * MCP Server — Multi-Model AI Agent Orchestrator
 *
 * Coordinates tool-calling and response generation across multiple AI models.
 * Streams replies token-by-token using Server-Sent Events (SSE).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompts.js';
import { executeMcpTool, mcpToolsList } from '../tools/registry.js';
import { env } from '../config/env.js';

// Convert MCP tool schemas into OpenAI tools declaration format
function getOpenAITools() {
  return mcpToolsList.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    },
  }));
}

// Convert MCP tool schemas into Google Gen AI declaration format
function getGeminiTools() {
  const declarations = mcpToolsList.map((tool) => {
    // Map JSON schema types to Gemini API type structures
    const properties: Record<string, any> = {};
    const originalProps = (tool.inputSchema.properties || {}) as Record<string, any>;

    for (const key of Object.keys(originalProps)) {
      const prop = originalProps[key];
      properties[key] = {
        type: prop.type.toUpperCase(), // GEMINI uses UPPERCASE types (e.g. OBJECT, ARRAY)
        description: prop.description,
        ...(prop.items ? { items: { type: prop.items.type.toUpperCase() } } : {}),
      };
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT',
        properties,
        required: tool.inputSchema.required,
      },
    };
  });

  return [{ functionDeclarations: declarations }];
}

/**
 * Helper to resolve tool arguments. Overwrites dummy/mock containerJson inputs with actual preloaded session data.
 */
function resolveArgs(toolName: string, callArgs: any, sessionContainer: any, sessionLiveEvents: any) {
  const args = { ...callArgs };
  
  let isDummyContainer = false;
  if (args.containerJson) {
    if (typeof args.containerJson === 'object') {
      isDummyContainer = !args.containerJson.containerVersion && 
                         !args.containerJson.tag && 
                         !args.containerJson.exportFormatVersion;
    } else if (typeof args.containerJson === 'string') {
      isDummyContainer = !args.containerJson.includes('containerVersion') && 
                         !args.containerJson.includes('exportFormatVersion');
    } else {
      isDummyContainer = true;
    }
  }

  if ((!args.containerJson || isDummyContainer) && sessionContainer) {
    args.containerJson = sessionContainer;
  }
  
  if (!args.liveEvents && sessionLiveEvents) {
    args.liveEvents = sessionLiveEvents;
  }
  
  return args;
}

/**
 * Handles generative AI chat streaming. Coordinates tool execution loops
 * and pushes tokens directly to Express SSE client write streams.
 */
export async function streamChatResponse(
  params: {
    message: string;
    containerJson?: any;
    liveEvents?: any[];
    history?: any[];
    provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'openrouter';
    model?: string;
  },
  writeToken: (token: string, type?: 'text' | 'tool_call' | 'tool_result' | 'done') => void
) {
  const { message, containerJson, liveEvents, history = [], provider, model } = params;

  try {
    // Format and sanitize conversational history for Gemini API
    const formattedHistory = history.map((h) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: Array.isArray(h.parts) ? h.parts.map((p: any) => ({ text: p.text || String(p) })) : [{ text: String(h.parts) }],
    }));

    // Filter and sanitize history to ensure it strictly starts with 'user'
    // and alternates user -> model -> user -> model
    const cleanHistory: any[] = [];
    for (const msg of formattedHistory) {
      if (cleanHistory.length === 0) {
        // First message MUST be 'user'
        if (msg.role === 'user') {
          cleanHistory.push(msg);
        }
      } else {
        const lastMsg = cleanHistory[cleanHistory.length - 1];
        if (lastMsg.role === msg.role) {
          // Merge consecutive messages with the same role
          lastMsg.parts.push(...msg.parts);
        } else {
          cleanHistory.push(msg);
        }
      }
    }

    if (provider === 'gemini') {
      // Initialize Gemini SDK
      const ai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: SYSTEM_PROMPT,
        tools: getGeminiTools() as any,
      });

      // Inject active context payloads (uploaded GTM file & Extension captured logs)
      // as hidden contextual updates
      const activeContext = [];
      if (containerJson) {
        activeContext.push({
          text: `[System Context - Uploaded GTM Container Data]:\n${JSON.stringify({
            containerName: containerJson.containerVersion?.name || 'Uploaded Container',
            containerId: containerJson.containerVersion?.containerId || '',
            stats: {
              tagCount: containerJson.containerVersion?.tag?.length || 0,
              triggerCount: containerJson.containerVersion?.trigger?.length || 0,
              variableCount: containerJson.containerVersion?.variable?.length || 0,
            }
          })}`
        });
      }
      if (liveEvents && liveEvents.length > 0) {
        activeContext.push({
          text: `[System Context - Live Extension Capture Event Logs]:\n${JSON.stringify(liveEvents)}`
        });
      }

      // Combine user message with active context injection
      const userMessageContent = {
        role: 'user',
        parts: [
          ...activeContext,
          { text: message }
        ]
      };

      // Establish multi-turn chat session with sanitized history
      const chat = model.startChat({
        history: cleanHistory,
      });

      // Send user message and stream content
      // Loop to handle tool calling iteration
      let promptToSend: any = userMessageContent.parts;
      let keepRunningLoop = true;
      let loopIterationCount = 0;

      while (keepRunningLoop && loopIterationCount < 5) {
        loopIterationCount++;
        const resultStream = await chat.sendMessageStream(promptToSend);

        let functionCalls: any[] = [];
        let fullTextResponse = '';

        for await (const chunk of resultStream.stream) {
          const text = chunk.text();
          if (text) {
            fullTextResponse += text;
            writeToken(text, 'text');
          }

          // Capture model-requested function calls
          const calls = chunk.functionCalls();
          if (calls && calls.length > 0) {
            functionCalls = [...functionCalls, ...calls];
          }
        }

        if (functionCalls.length > 0) {
          // AI decided to execute tools
          const toolResponseParts = [];

          for (const call of functionCalls) {
            writeToken(`🔧 AI calling tool: \`${call.name}\`...\n`, 'tool_call');

            // Inject standard GTM payload context from session state if missing
            const args = resolveArgs(call.name, call.args, containerJson, liveEvents);

            try {
              // Execute tool locally
              const toolResult = await executeMcpTool(call.name, args);
              
              // Format success response back to Gemini
              toolResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { result: toolResult },
                },
              });
              writeToken(`✅ Tool \`${call.name}\` executed successfully.\n`, 'tool_result');
            } catch (err: any) {
              // Format failure response back to Gemini
              toolResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { error: err.message || String(err) },
                },
              });
              writeToken(`❌ Tool \`${call.name}\` failed: ${err.message || String(err)}\n`, 'tool_result');
            }
          }

          // Loop the tool output back into the chat session
          promptToSend = toolResponseParts;
        } else {
          // No further tools requested. Generation finished.
          keepRunningLoop = false;
        }
      }
    } else if (provider === 'openai') {
      if (!env.OPENAI_API_KEY) {
        writeToken(`❌ OpenAI API Key not configured. Please add OPENAI_API_KEY to your .env configuration.`);
        return;
      }

      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

      // Format conversational history for OpenAI (which uses role: 'user' | 'assistant' | 'system')
      const openAiMessages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...cleanHistory.map((h) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0]?.text || '',
        })),
      ];

      // Inject GTM context payloads
      if (containerJson) {
        openAiMessages.push({
          role: 'user',
          content: `[System Context - Uploaded GTM Container Data]:\n${JSON.stringify({
            containerName: containerJson.containerVersion?.name || 'Uploaded Container',
            containerId: containerJson.containerVersion?.containerId || '',
            stats: {
              tagCount: containerJson.containerVersion?.tag?.length || 0,
              triggerCount: containerJson.containerVersion?.trigger?.length || 0,
              variableCount: containerJson.containerVersion?.variable?.length || 0,
            }
          })}`
        });
        // A mock reply from assistant acknowledging system context so it doesn't break the history order
        openAiMessages.push({ role: 'assistant', content: 'Acknowledged. I have loaded the container data.' });
      }
      if (liveEvents && liveEvents.length > 0) {
        openAiMessages.push({
          role: 'user',
          content: `[System Context - Live Extension Capture Event Logs]:\n${JSON.stringify(liveEvents)}`
        });
        openAiMessages.push({ role: 'assistant', content: 'Acknowledged. I have loaded the live events logs.' });
      }

      // Add current user query
      openAiMessages.push({ role: 'user', content: message });

      let keepRunningLoop = true;
      let loopIterationCount = 0;

      while (keepRunningLoop && loopIterationCount < 5) {
        loopIterationCount++;
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          tools: getOpenAITools() as any,
          tool_choice: 'auto',
        });

        const responseMessage = response.choices[0].message;

        if (responseMessage.content) {
          writeToken(responseMessage.content, 'text');
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          // Add the model's response (with tool calls) to the thread
          openAiMessages.push(responseMessage);

          for (const call of responseMessage.tool_calls) {
            writeToken(`🔧 AI calling tool: \`${call.function.name}\`...\n`, 'tool_call');
            
            let rawArgs: any = {};
            try {
              rawArgs = JSON.parse(call.function.arguments);
            } catch {
              rawArgs = {};
            }

            const args = resolveArgs(call.function.name, rawArgs, containerJson, liveEvents);

            try {
              const toolResult = await executeMcpTool(call.function.name, args);
              openAiMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              });
              writeToken(`✅ Tool \`${call.function.name}\` executed successfully.\n`, 'tool_result');
            } catch (err: any) {
              openAiMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ error: err.message || String(err) }),
              });
              writeToken(`❌ Tool \`${call.function.name}\` failed: ${err.message || String(err)}\n`, 'tool_result');
            }
          }
        } else {
          keepRunningLoop = false;
        }
      }
    } else if (provider === 'groq') {
      if (!env.GROQ_API_KEY) {
        writeToken(`❌ Groq API Key not configured. Please add GROQ_API_KEY to your .env configuration.`);
        return;
      }

      const groqClient = new OpenAI({
        apiKey: env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });

      const groqMessages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...cleanHistory.map((h) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0]?.text || '',
        })),
      ];

      if (containerJson) {
        groqMessages.push({
          role: 'user',
          content: `[System Context - Uploaded GTM Container Data]:\n${JSON.stringify({
            containerName: containerJson.containerVersion?.name || 'Uploaded Container',
            containerId: containerJson.containerVersion?.containerId || '',
            stats: {
              tagCount: containerJson.containerVersion?.tag?.length || 0,
              triggerCount: containerJson.containerVersion?.trigger?.length || 0,
              variableCount: containerJson.containerVersion?.variable?.length || 0,
            }
          })}`
        });
        groqMessages.push({ role: 'assistant', content: 'Acknowledged. GTM data loaded.' });
      }
      if (liveEvents && liveEvents.length > 0) {
        groqMessages.push({
          role: 'user',
          content: `[System Context - Live Extension Capture Event Logs]:\n${JSON.stringify(liveEvents)}`
        });
        groqMessages.push({ role: 'assistant', content: 'Acknowledged. Live logs loaded.' });
      }

      groqMessages.push({ role: 'user', content: message });

      let keepRunningLoop = true;
      let loopIterationCount = 0;

      while (keepRunningLoop && loopIterationCount < 5) {
        loopIterationCount++;
        
        const response = await groqClient.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: groqMessages,
          tools: getOpenAITools() as any,
          tool_choice: 'auto',
        });

        const responseMessage = response.choices[0].message;

        if (responseMessage.content) {
          writeToken(responseMessage.content, 'text');
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          groqMessages.push(responseMessage);

          for (const call of responseMessage.tool_calls) {
            writeToken(`🔧 AI calling tool: \`${call.function.name}\`...\n`, 'tool_call');
            
            let rawArgs: any = {};
            try {
              rawArgs = JSON.parse(call.function.arguments);
            } catch {
              rawArgs = {};
            }

            const args = resolveArgs(call.function.name, rawArgs, containerJson, liveEvents);

            try {
              const toolResult = await executeMcpTool(call.function.name, args);
              groqMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              });
              writeToken(`✅ Tool \`${call.function.name}\` executed successfully.\n`, 'tool_result');
            } catch (err: any) {
              groqMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ error: err.message || String(err) }),
              });
              writeToken(`❌ Tool \`${call.function.name}\` failed: ${err.message || String(err)}\n`, 'tool_result');
            }
          }
        } else {
          keepRunningLoop = false;
        }
      }
    } else if (provider === 'ollama') {
      const ollamaClient = new OpenAI({
        apiKey: 'ollama', // Ollama does not require authentication
        baseURL: `${env.OLLAMA_HOST}/v1`,
      });

      const ollamaMessages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...cleanHistory.map((h) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0]?.text || '',
        })),
      ];

      if (containerJson) {
        ollamaMessages.push({
          role: 'user',
          content: `[System Context - Uploaded GTM Container Data]:\n${JSON.stringify({
            containerName: containerJson.containerVersion?.name || 'Uploaded Container',
            containerId: containerJson.containerVersion?.containerId || '',
            stats: {
              tagCount: containerJson.containerVersion?.tag?.length || 0,
              triggerCount: containerJson.containerVersion?.trigger?.length || 0,
              variableCount: containerJson.containerVersion?.variable?.length || 0,
            }
          })}`
        });
        ollamaMessages.push({ role: 'assistant', content: 'Acknowledged. GTM data loaded.' });
      }
      if (liveEvents && liveEvents.length > 0) {
        ollamaMessages.push({
          role: 'user',
          content: `[System Context - Live Extension Capture Event Logs]:\n${JSON.stringify(liveEvents)}`
        });
        ollamaMessages.push({ role: 'assistant', content: 'Acknowledged. Live logs loaded.' });
      }

      ollamaMessages.push({ role: 'user', content: message });

      let keepRunningLoop = true;
      let loopIterationCount = 0;

      while (keepRunningLoop && loopIterationCount < 5) {
        loopIterationCount++;
        
        const response = await ollamaClient.chat.completions.create({
          model: env.OLLAMA_MODEL,
          messages: ollamaMessages,
          tools: getOpenAITools() as any,
          tool_choice: 'auto',
        });

        const responseMessage = response.choices[0].message;

        if (responseMessage.content) {
          writeToken(responseMessage.content, 'text');
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          ollamaMessages.push(responseMessage);

          for (const call of responseMessage.tool_calls) {
            writeToken(`🔧 AI calling tool: \`${call.function.name}\`...\n`, 'tool_call');
            
            let rawArgs: any = {};
            try {
              rawArgs = JSON.parse(call.function.arguments);
            } catch {
              rawArgs = {};
            }

            const args = resolveArgs(call.function.name, rawArgs, containerJson, liveEvents);

            try {
              const toolResult = await executeMcpTool(call.function.name, args);
              ollamaMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              });
              writeToken(`✅ Tool \`${call.function.name}\` executed successfully.\n`, 'tool_result');
            } catch (err: any) {
              ollamaMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ error: err.message || String(err) }),
              });
              writeToken(`❌ Tool \`${call.function.name}\` failed: ${err.message || String(err)}\n`, 'tool_result');
            }
          }
        } else {
          keepRunningLoop = false;
        }
      }
    } else if (provider === 'openrouter') {
      if (!env.OPENROUTER_API_KEY) {
        writeToken(`❌ OpenRouter API Key not configured. Please add OPENROUTER_API_KEY to your .env configuration.`);
        return;
      }
      
      let openRouterModel = env.OPENROUTER_MODEL_DEFAULT;
      if (model === 'auto') openRouterModel = 'openrouter/free';
      else if (model === 'llama') openRouterModel = env.OPENROUTER_MODEL_LLAMA;
      else if (model === 'deepseek') openRouterModel = env.OPENROUTER_MODEL_DEEPSEEK;
      else if (model === 'qwen') openRouterModel = env.OPENROUTER_MODEL_QWEN;
      else if (model === 'gemma') openRouterModel = env.OPENROUTER_MODEL_GEMMA;
      else if (model === 'mistral') openRouterModel = env.OPENROUTER_MODEL_MISTRAL;
      else if (model && model.includes('/')) {
        openRouterModel = model;
      }
      
      const openrouter = new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://gtmcontaineranalyzer.com',
          'X-Title': 'GTM Insight Analyzer',
        }
      });

      const openrouterMessages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      for (const h of history) {
        if (h.role === 'model') {
          openrouterMessages.push({ role: 'assistant', content: Array.isArray(h.parts) ? h.parts.map((p: any) => p.text || String(p)).join('') : String(h.parts) });
        } else {
          openrouterMessages.push({ role: 'user', content: Array.isArray(h.parts) ? h.parts.map((p: any) => p.text || String(p)).join('') : String(h.parts) });
        }
      }

      if (containerJson) {
        openrouterMessages.push({ role: 'user', content: 'Here is the parsed GTM container version export data I am working on.' });
        openrouterMessages.push({ role: 'assistant', content: 'Acknowledged. I have loaded the container data.' });
        openrouterMessages.push({ role: 'user', content: JSON.stringify(containerJson) });
        openrouterMessages.push({ role: 'assistant', content: 'Acknowledged. GTM container version schema validation succeeded and loaded.' });
      }

      if (liveEvents && liveEvents.length > 0) {
        openrouterMessages.push({ role: 'user', content: `Here are the captured live console and network logs from the extension: ${JSON.stringify(liveEvents)}` });
        openrouterMessages.push({ role: 'assistant', content: 'Acknowledged. I have loaded the live events logs.' });
      }

      openrouterMessages.push({ role: 'user', content: message });

      let keepRunningLoop = true;
      let loopIterationCount = 0;
      const MAX_LOOPS = 5;

      while (keepRunningLoop && loopIterationCount < MAX_LOOPS) {
        loopIterationCount++;
        
        const response = await openrouter.chat.completions.create({
          model: openRouterModel,
          messages: openrouterMessages,
          tools: getOpenAITools() as any,
          tool_choice: 'auto',
        });

        const responseMessage = response.choices[0].message;

        if (responseMessage.content) {
          writeToken(responseMessage.content, 'text');
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          openrouterMessages.push(responseMessage);

          for (const call of responseMessage.tool_calls) {
            writeToken(`🔧 AI calling tool: \`${call.function.name}\`...\n`, 'tool_call');
            
            let rawArgs: any = {};
            try {
              rawArgs = JSON.parse(call.function.arguments);
            } catch {
              rawArgs = {};
            }

            const args = resolveArgs(call.function.name, rawArgs, containerJson, liveEvents);

            try {
              const toolResult = await executeMcpTool(call.function.name, args);
              openrouterMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              });
              writeToken(`✅ Tool \`${call.function.name}\` executed successfully.\n`, 'tool_result');
            } catch (err: any) {
              openrouterMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ error: err.message || String(err) }),
              });
              writeToken(`❌ Tool \`${call.function.name}\` failed: ${err.message || String(err)}\n`, 'tool_result');
            }
          }
        } else {
          keepRunningLoop = false;
        }
      }
    } else {
      // Fallback/Mock placeholder for Anthropic experimentation
      writeToken(`⚠️ Provider "${provider.toUpperCase()}" is configured as a mockup for testing. ` +
        `Please provide API integrations in agent.ts. Running default offline validation checks...\n`);
      
      // Simulate thinking latency
      await new Promise((r) => setTimeout(r, 1000));

      if (containerJson) {
        const stats = {
          tags: containerJson.containerVersion?.tag?.length || 0,
          triggers: containerJson.containerVersion?.trigger?.length || 0,
          variables: containerJson.containerVersion?.variable?.length || 0,
        };
        writeToken(`GTM Container Loaded: Found ${stats.tags} tags, ${stats.triggers} triggers, and ${stats.variables} variables. ` +
          `To run complete AI assessments with Claude, configure the corresponding API key in your .env variables.`);
      } else {
        writeToken(`No container JSON supplied. Paste your Google Tag Manager export file into the dashboard to test offline audit logic.`);
      }
    }
  } catch (error: any) {
    console.error(`[AI Provider "${provider}" failed, switching to Local Offline Rules Engine]`, error);
    await runOfflineRulesEngine(message, containerJson, liveEvents, error, provider, writeToken);
  }
}

// ─── Local Offline Rules Engine & Heuristic Helpers ───────────────────────────

function getTagTypeLabel(type: string): string {
  switch (type) {
    case 'gaawe': return 'GA4 Event';
    case 'html': return 'Custom HTML';
    case 'ga': return 'Universal Analytics';
    case 'awct': return 'Google Ads Conversion Tracking';
    case 'sp': return 'Google Tag / GA4 Configuration';
    default: return type || 'Unknown';
  }
}

function findVariablesInObject(obj: any): string[] {
  const str = JSON.stringify(obj);
  const matches = str.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.slice(2, -2))));
}

function getTriggerEventNames(trigger: any): string[] {
  if (trigger.type === 'CUSTOM_EVENT') {
    const customEventFilter = trigger.customEventFilter || '';
    if (customEventFilter) return [customEventFilter];
    
    const params = trigger.parameter || [];
    const eventNameParam = params.find((p: any) => p.key === 'eventName')?.value;
    if (eventNameParam) return [eventNameParam];
  }
  return [];
}

function doesTriggerMatchPath(trigger: any, path: string): boolean {
  const isPageviewType = trigger.type === 'PAGEVIEW' || trigger.type === 'DOM_READY' || trigger.type === 'WINDOW_LOADED';
  if (!isPageviewType) return false;
  
  if (!trigger.filter || trigger.filter.length === 0) {
    return true; // Fires on all pages
  }
  
  return trigger.filter.some((f: any) => {
    const params = f.parameter || [];
    const arg0 = params.find((p: any) => p.key === 'arg0')?.value || '';
    const arg1 = params.find((p: any) => p.key === 'arg1')?.value || '';
    const filterType = f.type || '';
    
    const isPageVar = arg0.toLowerCase().includes('page') || arg0.toLowerCase().includes('url') || arg0.toLowerCase().includes('path');
    if (!isPageVar) return false;
    
    const val = arg1.toLowerCase();
    const target = path.toLowerCase();
    
    switch (filterType) {
      case 'EQUALS':
        return val === target;
      case 'CONTAINS':
        return target.includes(val) || val.includes(target);
      case 'STARTS_WITH':
        return target.startsWith(val);
      case 'ENDS_WITH':
        return target.endsWith(val);
      case 'MATCHES_REGEXP':
      case 'REGEX':
        try {
          return new RegExp(val).test(target);
        } catch {
          return target.includes(val);
        }
      default:
        return target.includes(val);
    }
  });
}

async function streamTokens(text: string, writeToken: (token: string, type?: any) => void) {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (word) {
      writeToken(word, 'text');
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }
}

async function runOfflineRulesEngine(
  message: string,
  containerJson: any,
  liveEvents: any[] | undefined,
  originalError: Error,
  provider: string,
  writeToken: (token: string, type?: any) => void
) {
  const query = message.toLowerCase();
  let response = '';

  response += `> [!WARNING]\n`;
  response += `> **Self-Healing Failover Active**\n`;
  response += `> The AI provider (${provider.toUpperCase()}) is currently unavailable due to a rate limit (429), quota issue, or connection failure:\n`;
  response += `> *${originalError.message || String(originalError)}*\n`;
  response += `> GTM Insight has automatically switched to the **Local Offline Rules Engine** to answer your request.\n\n`;

  const pathMatch = message.match(/\/[a-zA-Z0-9_\-\/]+/);
  const path = pathMatch ? pathMatch[0] : null;

  if (path || query.includes('fire') || query.includes('trigger') || query.includes('checkout') || query.includes('cart')) {
    const targetPath = path || '/checkout';
    response += `## 📋 Tag Firing Analysis for \`${targetPath}\`\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file or log in with Google OAuth to inspect tag firing triggers.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const triggers = containerJson.containerVersion.trigger || [];
      const triggerMap = new Map(triggers.map((t: any) => [t.triggerId, t]));
      
      const firingTags: any[] = [];
      
      tags.forEach((tag: any) => {
        const firingTriggerIds = tag.firingTriggerId || [];
        const matchingTriggers = firingTriggerIds
          .map((id: string) => triggerMap.get(id))
          .filter((t: any) => t && doesTriggerMatchPath(t, targetPath));
          
        if (matchingTriggers.length > 0) {
          firingTags.push({ tag, triggers: matchingTriggers });
        }
      });
      
      if (firingTags.length === 0) {
        response += `No specific tags are configured to fire on path \`${targetPath}\` in this GTM container.\n\n`;
        response += `### Recommendations:\n`;
        response += `- Verify if you have custom event triggers that might fire on this page instead of standard page view triggers.\n`;
        response += `- Check if the trigger conditions use a different variable (e.g. \`{{Page URL}}\` instead of \`{{Page Path}}\`).\n`;
      } else {
        response += `Found **${firingTags.length}** tag(s) configured to fire on \`${targetPath}\`:\n\n`;
        
        firingTags.forEach(({ tag, triggers: matchingTriggers }, index) => {
          const typeLabel = getTagTypeLabel(tag.type);
          const variables = findVariablesInObject(tag);
          
          response += `### ${index + 1}. **${tag.name}**\n`;
          response += `- **Tag Type:** \`${typeLabel}\`\n`;
          response += `- **Firing Triggers:**\n`;
          matchingTriggers.forEach((t: any) => {
            response += `  - **${t.name}** (Type: \`${t.type}\`)\n`;
          });
          if (variables.length > 0) {
            response += `- **Variables Referenced:** ${variables.map(v => `\`{{${v}}}\``).join(', ')}\n`;
          }
          response += `\n`;
        });
      }
    }
  } else if (query.includes('naming') || query.includes('convention') || query.includes('audit')) {
    response += `## 🔍 Naming Convention Compliance Audit\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to run naming audits.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const triggers = containerJson.containerVersion.trigger || [];
      const variables = containerJson.containerVersion.variable || [];
      
      const tagIssues: string[] = [];
      const triggerIssues: string[] = [];
      const variableIssues: string[] = [];
      
      tags.forEach((t: any) => {
        const name = t.name || '';
        if (!name.includes(' - ') && !name.includes(':') && !name.startsWith('GA4') && !name.startsWith('GTM')) {
          tagIssues.push(`- **${name}** (Type: \`${getTagTypeLabel(t.type)}\`) lacks a clear vendor prefix (e.g. \`GA4 - \` or \`GAds - \`).`);
        }
      });
      
      triggers.forEach((tr: any) => {
        const name = tr.name || '';
        if (!name.includes(' - ') && !name.includes(':') && !/^(Event|Page|Click|Form|Timer|Scroll|Error)\b/i.test(name)) {
          triggerIssues.push(`- **${name}** (Type: \`${tr.type}\`) should start with its category prefix (e.g., \`Event - Login\` or \`Page - Checkout\`).`);
        }
      });
      
      variables.forEach((v: any) => {
        const name = v.name || '';
        if (!name.includes(' - ') && !name.includes(':') && !/^(dlv|cjs|url|cookie|constant|var)\b/i.test(name)) {
          variableIssues.push(`- **${name}** (Type: \`${v.type}\`) could use a classification prefix (e.g., \`dlv - \` for Data Layer).`);
        }
      });
      
      const totalIssues = tagIssues.length + triggerIssues.length + variableIssues.length;
      response += `Audit completed! Found **${totalIssues}** naming convention compliance recommendation(s):\n\n`;
      
      if (tagIssues.length > 0) {
        response += `### 🏷️ Tags (${tagIssues.length})\n`;
        response += tagIssues.join('\n') + `\n\n`;
      }
      if (triggerIssues.length > 0) {
        response += `### ⚡ Triggers (${triggerIssues.length})\n`;
        response += triggerIssues.join('\n') + `\n\n`;
      }
      if (variableIssues.length > 0) {
        response += `### 📊 Variables (${variableIssues.length})\n`;
        response += variableIssues.join('\n') + `\n\n`;
      }
      
      if (totalIssues === 0) {
        response += `✅ **Perfect Score!** All tags, triggers, and variables are named according to GTM best-practices.\n`;
      }
    }
  } else if (query.includes('ga4') || query.includes('compliance') || query.includes('validate')) {
    response += `## 📈 GA4 Event Configuration Validation\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to run GA4 validation.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const ga4EventTags = tags.filter((t: any) => t.type === 'gaawe');
      
      const namingIssues: string[] = [];
      const reservedEvents = ['session_start', 'first_visit', 'user_engagement', 'click', 'scroll', 'file_download'];
      
      ga4EventTags.forEach((tag: any) => {
        const params = tag.parameter || [];
        const eventName = params.find((p: any) => p.key === 'eventName')?.value || '';
        
        if (eventName) {
          if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(eventName)) {
            namingIssues.push(`- **${tag.name}**: Event name \`${eventName}\` contains invalid characters. GA4 events must only use letters, numbers, and underscores, and must start with a letter.`);
          }
          if (reservedEvents.includes(eventName.toLowerCase()) && !(tag.name.toLowerCase().includes('config') || tag.name.toLowerCase().includes('base'))) {
            namingIssues.push(`- **${tag.name}**: Event name \`${eventName}\` is a GA4 reserved event. Custom tracking should avoid triggering these directly unless specifically implementing custom measurements.`);
          }
        }
      });
      
      response += `Audited **${ga4EventTags.length}** GA4 custom event tag(s):\n\n`;
      
      if (namingIssues.length === 0) {
        response += `✅ **GA4 Event Validation Passed!** All custom events follow Google's standard naming and parameter protocols.\n`;
      } else {
        response += `### 🚨 Event Naming Violations:\n`;
        response += namingIssues.join('\n') + `\n\n`;
        response += `### 💡 Recommendation:\n`;
        response += `Rename these event names in your GTM tags to comply with GA4 limitations. Use lowercase characters and underscores instead of spaces or hyphens.\n`;
      }
    }
  } else if (query.includes('consent') || query.includes('privacy')) {
    response += `## 🛡️ Consent & Privacy Compliance Check\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to run privacy audits.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const marketingTags: any[] = [];
      
      tags.forEach((t: any) => {
        const name = (t.name || '').toLowerCase();
        const type = t.type || '';
        const hasConsentSettings = t.consentSettings && t.consentSettings.consentStatus && t.consentSettings.consentStatus !== 'NOT_SET';
        
        const isMarketing = name.includes('pixel') || 
                            name.includes('facebook') || 
                            name.includes('fb -') ||
                            name.includes('tiktok') || 
                            name.includes('google ads') || 
                            name.includes('gads') || 
                            name.includes('hotjar') || 
                            name.includes('clarity') ||
                            name.includes('analytics') ||
                            name.includes('ga4') ||
                            type === 'html';
                            
        if (isMarketing) {
          marketingTags.push({ tag: t, hasConsentSettings });
        }
      });
      
      const unconfigured = marketingTags.filter(t => !t.hasConsentSettings);
      
      response += `Audited **${marketingTags.length}** analytics and marketing tag(s) for Consent Settings:\n\n`;
      
      if (unconfigured.length === 0) {
        response += `✅ **Perfect Consent Mode Score!** All marketing and analytics tags have explicit Consent Mode settings configured.\n`;
      } else {
        response += `⚠️ **Found ${unconfigured.length} tag(s) running without explicit Consent Mode settings:**\n\n`;
        
        unconfigured.forEach(({ tag }, idx) => {
          response += `### ${idx + 1}. **${tag.name}**\n`;
          response += `- **Type:** \`${getTagTypeLabel(tag.type)}\`\n`;
          response += `- 🚨 **Issue:** Firing trigger does not require consent permission. This tag can fire before users accept cookies, potentially violating GDPR/CCPA regulations.\n`;
          response += `- **Recommendation:** Go to **Tag Settings > Advanced Settings > Consent Settings** in GTM, select "Require additional consent for tag to fire", and specify required consent types (e.g. \`ad_storage\`, \`analytics_storage\`).\n\n`;
        });
      }
    }
  } else if (query.includes('ecommerce') || query.includes('revenue') || query.includes('sales') || query.includes('purchase')) {
    response += `## 🛒 GA4 Ecommerce Tracking Health Check\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to validate ecommerce configuration.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const ga4EventTags = tags.filter((t: any) => t.type === 'gaawe');
      const purchaseTags: any[] = [];
      
      ga4EventTags.forEach((t: any) => {
        const params = t.parameter || [];
        const eventNameParam = params.find((p: any) => p.key === 'eventName')?.value || '';
        
        if (eventNameParam.toLowerCase().includes('purchase') || (t.name || '').toLowerCase().includes('purchase')) {
          purchaseTags.push(t);
        }
      });
      
      if (purchaseTags.length === 0) {
        response += `⚠️ **Discrepancy:** No GA4 Event tags configured for the \`purchase\` event found in your container.\n`;
        response += `- **Impact:** Ecommerce purchase tracking, conversion value attribution, and ROI metrics will not be reported in Google Analytics 4.\n`;
        response += `- **Recommendation:** Create a new GA4 Event Tag, set the Event Name to \`purchase\`, and attach it to your checkout success trigger.\n`;
      } else {
        response += `Found **${purchaseTags.length}** GA4 Event tag(s) configured for the \`purchase\` event:\n\n`;
        
        purchaseTags.forEach((tag: any, idx) => {
          response += `### ${idx + 1}. **${tag.name}**\n`;
          
          const params = tag.parameter || [];
          const eventParamsEntry = params.find((p: any) => p.key === 'eventParameters');
          
          let eventParams: any[] = [];
          if (eventParamsEntry && Array.isArray(eventParamsEntry.list)) {
            eventParams = eventParamsEntry.list.map((item: any) => {
              const itemParams = item.mapValue || [];
              const pKey = itemParams.find((p: any) => p.key === 'parameter')?.value || '';
              const pVal = itemParams.find((p: any) => p.key === 'value')?.value || '';
              return { key: pKey, value: pVal };
            });
          }
          
          const hasParam = (name: string) => eventParams.some(p => p.key.toLowerCase() === name.toLowerCase());
          const getParamVal = (name: string) => eventParams.find(p => p.key.toLowerCase() === name.toLowerCase())?.value || '';
          
          const required = ['transaction_id', 'value', 'currency', 'items'];
          const missing = required.filter(p => !hasParam(p));
          
          if (missing.length === 0) {
            response += `✅ **All required GA4 parameters configured:**\n`;
            required.forEach(p => {
              response += `- \`${p}\`: \`${getParamVal(p)}\`\n`;
            });
          } else {
            response += `🚨 **Missing Required GA4 Parameters:** ${missing.map(p => `\`${p}\``).join(', ')}\n\n`;
            response += `**Recommendations:**\n`;
            missing.forEach(p => {
              if (p === 'transaction_id') {
                response += `- Add parameter \`transaction_id\` set to a dynamic data layer variable (e.g. \`{{dlv - transaction_id}}\`) to prevent duplicate transactions inflating your sales reports.\n`;
              } else if (p === 'value') {
                response += `- Add parameter \`value\` set to the total purchase amount variable (e.g. \`{{dlv - value}}\`).\n`;
              } else if (p === 'currency') {
                response += `- Add parameter \`currency\` representing transaction currency (e.g. \`{{dlv - currency}}\` or constant \`USD\`).\n`;
              } else if (p === 'items') {
                response += `- Add parameter \`items\` set to the data layer product items array variable (e.g. \`{{dlv - items}}\`). GA4 requires a structured items array to map transaction products.\n`;
              }
            });
          }
          response += `\n`;
        });
      }
    }
  } else if (query.includes('bloat') || query.includes('cleanup') || query.includes('orphaned') || query.includes('unused') || query.includes('duplicate')) {
    response += `## 🧹 GTM Container Bloat & Cleanup Audit\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to run cleanup checks.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const triggers = containerJson.containerVersion.trigger || [];
      const variables = containerJson.containerVersion.variable || [];
      
      const htmlTags = tags.filter((t: any) => t.type === 'html');
      const duplicates: string[] = [];
      const htmlContents = new Set<string>();
      
      htmlTags.forEach((t: any) => {
        const htmlCode = t.parameter?.find((p: any) => p.key === 'html')?.value || '';
        if (htmlCode) {
          const stripped = htmlCode.replace(/\s+/g, '');
          if (htmlContents.has(stripped)) {
            duplicates.push(t.name);
          } else {
            htmlContents.add(stripped);
          }
        }
      });
      
      const tagStr = JSON.stringify(tags);
      const triggerStr = JSON.stringify(triggers);
      const combinedConfig = tagStr + triggerStr;
      
      const unusedVars: string[] = [];
      variables.forEach((v: any) => {
        const vName = v.name;
        if (!combinedConfig.includes(`{{${vName}}}`)) {
          unusedVars.push(vName);
        }
      });
      
      response += `### GTM Workspace Bloat Audit:\n\n`;
      
      if (duplicates.length > 0) {
        response += `- ⚠️ **Duplicate Custom HTML tags found:**\n`;
        duplicates.forEach(d => response += `  - \`${d}\`\n`);
        response += `  *(These may cause third-party scripts to be loaded twice, bloating page loads and inflating pageviews.)*\n\n`;
      }
      
      if (unusedVars.length > 0) {
        response += `- ⚠️ **Unused variables found (${unusedVars.length}):**\n`;
        unusedVars.slice(0, 5).forEach(v => response += `  - \`{{${v}}}\`\n`);
        if (unusedVars.length > 5) {
          response += `  - *and ${unusedVars.length - 5} more variables...*\n`;
        }
        response += `  *(These variables are defined but never referenced in any tag or trigger conditions, bloating your container size.)*\n\n`;
      }
      
      if (duplicates.length === 0 && unusedVars.length === 0) {
        response += `✅ **Clean Container!** No major duplicate tags or unused variables were detected.\n\n`;
      } else {
        response += `### 💡 Next Steps:\n`;
        response += `Click on the **Cleanup** tab in the top navigation panel. You can select these items and download a cleaned, optimized container file instantly.\n`;
      }
    }
  } else if (query.includes('performance') || query.includes('slow') || query.includes('speed') || query.includes('timing')) {
    response += `## ⚡ Script Performance Audit\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to run performance check.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const triggers = containerJson.containerVersion.trigger || [];
      const triggerMap = new Map(triggers.map((t: any) => [t.triggerId, t]));
      
      const slowTags: any[] = [];
      
      tags.forEach((tag: any) => {
        const isCustomHtml = tag.type === 'html';
        const isPageviewFired = (tag.firingTriggerId || []).some((id: string) => {
          const tr = triggerMap.get(id) as any;
          return tr && (tr.type === 'PAGEVIEW' && (!tr.filter || tr.filter.length === 0));
        });
        
        if (isCustomHtml && isPageviewFired) {
          slowTags.push(tag);
        }
      });
      
      response += `Analyzed container tags for script loading blocking events (Core Web Vitals impact):\n\n`;
      
      if (slowTags.length === 0) {
        response += `✅ **Fast Tag Loading Setup!** No Custom HTML tags are bound to block the initial Page View event.\n`;
      } else {
        response += `⚠️ **Found ${slowTags.length} Custom HTML script(s) loading on all initial Page Views:**\n\n`;
        
        slowTags.forEach((tag, idx) => {
          response += `### ${idx + 1}. **${tag.name}**\n`;
          response += `- **Impact:** Firing custom scripts on Page View blocks HTML parsing, slowing down your page's **Largest Contentful Paint (LCP)** and **Interaction to Next Paint (INP)** scores.\n`;
          response += `- **Recommendation:** If this script is not critical to early page render (e.g. chat widgets, heatmaps like Hotjar/Clarity, feedback forms), migrate its trigger to **DOM Ready** or **Window Loaded** to defer loading.\n\n`;
        });
      }
    }
  } else if (query.includes('explain') || query.includes('setup') || query.includes('walkthrough')) {
    response += `## 🎓 Plain-English Container Setup Breakdown\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please upload your GTM container JSON file to get its plain-English summary.\n`;
    } else {
      const cVer = containerJson.containerVersion;
      const tags = cVer.tag || [];
      const triggers = cVer.trigger || [];
      const variables = cVer.variable || [];
      
      const ga4Event = tags.filter((t: any) => t.type === 'gaawe').length;
      const ga4Config = tags.filter((t: any) => t.type === 'sp').length;
      const customHtml = tags.filter((t: any) => t.type === 'html').length;
      const conversionTracking = tags.filter((t: any) => t.type === 'awct').length;
      
      response += `Here is a plain-English inventory and description of your container **${cVer.container?.name || cVer.name || 'demostore.com'}**:\n\n`;
      response += `### 📦 GTM Inventory Overview\n`;
      response += `- **Tags:** Firing ${tags.length} scripts total.\n`;
      response += `- **Triggers:** Listening for ${triggers.length} page actions/events.\n`;
      response += `- **Variables:** Storing ${variables.length} dynamic data inputs.\n\n`;
      
      response += `### 🏷️ Firing Scripts breakdown\n`;
      if (ga4Config > 0) response += `- **Google Tags (GA4 Configuration):** \`${ga4Config}\` tag(s) loading base Google Analytics tracking.\n`;
      if (ga4Event > 0) response += `- **GA4 Custom Events:** \`${ga4Event}\` event tag(s) sending custom user interactions to Google Analytics.\n`;
      if (conversionTracking > 0) response += `- **Google Ads Tracking:** \`${conversionTracking}\` tag(s) attributing Google Ads purchases or ads conversions.\n`;
      if (customHtml > 0) response += `- **Custom HTML Pixels:** \`${customHtml}\` tags injection third-party vendor tracking pixels (like Meta, TikTok, or Hotjar).\n`;
      
      response += `\n`;
      response += `### 💡 Quick Summary of What Your GTM Setup Does:\n`;
      if (ga4Config > 0 || ga4Event > 0) {
        response += `* **Analytics:** It is configured to report site pageviews and user actions directly to **Google Analytics 4**.\n`;
      }
      if (customHtml > 0) {
        response += `* **Marketing Pixels:** It injects external scripts to trace conversions and retarget visitors on third-party ad networks.\n`;
      }
      if (tags.length === 0) {
        response += `* **Empty Setup:** There are no active firing tags in this GTM container yet.\n`;
      }
    }
  } else if (query.includes('correlation') || query.includes('live') || query.includes('check my live')) {
    response += `## 📥 Live Events Correlation Audit\n\n`;
    
    if (!containerJson || !containerJson.containerVersion) {
      response += `❌ **No active GTM container linked.** Please link your GTM container to correlate live captured events.\n`;
    } else if (!liveEvents || liveEvents.length === 0) {
      response += `⚠️ **No live events captured.** Use the Chrome Extension to capture page interactions or click **Load Sandbox Debug Session** below to simulate live event debugging.\n`;
    } else {
      const tags = containerJson.containerVersion.tag || [];
      const triggers = containerJson.containerVersion.trigger || [];
      const triggerMap = new Map(triggers.map((t: any) => [t.triggerId, t]));
      
      response += `Correlating **${liveEvents.length}** live debugger events against your container tags:\n\n`;
      
      liveEvents.forEach((ev: any) => {
        const evName = ev.eventName || ev.event || '';
        const count = ev.count ?? 1;
        
        const matchingTags: string[] = [];
        tags.forEach((tag: any) => {
          const firingTriggerIds = tag.firingTriggerId || [];
          const matches = firingTriggerIds.some((id: string) => {
            const tr = triggerMap.get(id) as any;
            if (!tr) return false;
            if (tr.type === 'CUSTOM_EVENT') {
              const eventNames = getTriggerEventNames(tr);
              return eventNames.includes(evName);
            }
            if (tr.type === 'PAGEVIEW' || tr.type === 'DOM_READY' || tr.type === 'WINDOW_LOADED') {
              return evName === 'page_view';
            }
            return false;
          });
          if (matches) {
            matchingTags.push(tag.name);
          }
        });
        
        response += `### 🔹 Event: \`${evName}\` (Captured **${count}** times)\n`;
        if (matchingTags.length > 0) {
          response += `- **Expected Firing Tag(s):** ${matchingTags.map(t => `\`${t}\``).join(', ')}\n`;
          if (count === 0) {
            response += `- ⚠️ **Discrepancy:** This event has a capture count of **0**, meaning its firing tag(s) did not fire. Verify the trigger conditions or site setup.\n`;
          } else {
            response += `- ✅ **Status:** Correlated successfully.\n`;
          }
        } else {
          response += `- ⚠️ **Discrepancy:** No GTM configurations or tags are set to trigger on event \`${evName}\`.\n`;
        }
        response += `\n`;
      });
    }
  } else {
    response += `## 💡 GTM Insight Offline Guide\n\n`;
    response += `I am currently operating in **Offline Fallback Mode** due to rate limit constraints on the generative AI keys. Here are key tasks I can run for you based on your input:\n\n`;
    response += `1. **Tag Firing Analysis:** Ask *"Which tags fire on /checkout?"* or specify another path to map tag triggers.\n`;
    response += `2. **Naming Convention Audit:** Ask *"Audit my naming conventions"* to review styling compliance.\n`;
    response += `3. **Consent & Privacy Check:** Ask *"Are my marketing tags firing before consent?"* to audit cookie restrictions.\n`;
    response += `4. **Ecommerce Tracking Health:** Ask *"Why doesn't my GA4 ecommerce revenue match my store's sales?"* to validate required purchase event variables.\n`;
    response += `5. **Container Bloat Audit:** Ask *"Find duplicate, unused, or orphaned tags/triggers/variables"* to review workspace cleanups.\n`;
    response += `6. **Script Performance Check:** Ask *"Which tags are slowing down my page load?"* to optimize CWV metrics.\n`;
    response += `7. **Container Setup Breakdown:** Ask *"Explain my container setup in plain English"* to read a simple summary.\n\n`;
    response += `### GTM Debugging Tip:\n`;
    response += `Make sure that you have linked your GTM Container JSON file using the **Upload Container JSON** section or Google OAuth in the workspace dashboard. Without it, rule-based matching cannot analyze trigger filters.`;
  }

  await streamTokens(response, writeToken);
}

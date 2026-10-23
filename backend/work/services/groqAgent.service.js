import Groq from "groq-sdk";
import { LOCAL_COMMAND_TOOLS } from "./toolsSchema.js";
import { createTaskPlan, formatTaskPlan } from "./taskPlan.service.js";

class DesktopToolExecutionError extends Error {}

/**
 * Provider adapter for bounded desktop-tool requests through the local agent.
 */

class GroqAgentService {
  constructor() {
    this.groqClient = null;
    this.initClients();
  }

  initClients() {
    if (process.env.GROQ_API_KEY) {
      this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
  }

  getSystemPrompt(agentName = "Cheeni", userName = "friend") {
    return `You are ${agentName}, a brilliant, warm, and highly capable desktop AI copilot for ${userName}.
You can use a limited set of approved desktop tools to open allowlisted apps, standard user folders, and web URLs, or read selected system status.

OPERATING INSTRUCTIONS:
1. Use an available tool only when it directly matches the user's request. Never claim to perform actions outside the available tools.
2. In normal conversational replies without tools, deliver a sweet, concise, natural response (1-3 sentences) suitable for voice.
3. Never invent or hallucinate tool results. Execute the tool, inspect the observation, and summarize the result naturally.
4. Keep spoken responses friendly and natural—avoid markdown syntax in the spoken text.
5. Reply in the same language as the latest user message: Hindi in natural Devanagari for Hindi, English for English, and mirror natural Hindi-English mixing. This applies to normal answers, action confirmations, and tool-result summaries.`;
  }

  /**
   * Run one ReAct turn with Groq Llama-3.3-70B Function Calling
   * @param {string} userPrompt - User message
   * @param {Array} history - Previous messages
   * @param {Function} toolExecutor - Async callback function (toolName, toolArgs) => Promise<toolResult>
   * @param {Object} options - Custom options (agentName, userName)
   */
  async processUserMessage(userPrompt, history = [], toolExecutor = null, options = {}) {
    const agentName = options.agentName || "Cheeni";
    const userName = options.userName || "friend";
    const systemPrompt = this.getSystemPrompt(agentName, userName);

    // Format message history
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
      })),
      { role: "user", content: userPrompt },
    ];

    // Use Groq only when explicitly configured.
    if (this.groqClient) {
      try {
        return await this._runGroqLoop(messages, toolExecutor);
      } catch (err) {
        if (err instanceof DesktopToolExecutionError) throw err;
        console.warn("Groq agent dispatch failed, attempting fallback:", err.message);
      }
    }

    // Fail clearly rather than implying that an unsupported action was performed.
    return await this._runFallback(userPrompt, options);
  }

  async _runGroqLoop(messages, toolExecutor) {
    const response = await this.groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messages,
      tools: LOCAL_COMMAND_TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 1024,
    });

    const responseMessage = response.choices[0]?.message;
    if (!responseMessage) {
      throw new Error("Empty response received from Groq");
    }

    // If no tool was called, return conversational text
    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
      const text = responseMessage.content || "I am here with you!";
      return {
        speechText: text,
        textResponse: text,
        action: null,
      };
    }

    if (responseMessage.tool_calls.length > 1) {
      const proposed = createTaskPlan(responseMessage.tool_calls);
      if (!proposed.success) {
        return {
          speechText: proposed.reason,
          textResponse: proposed.reason,
          action: null,
          plan: null,
        };
      }
      const preview = formatTaskPlan(proposed.plan);
      return {
        speechText: "I prepared a plan for review. I have not started any of its steps.",
        textResponse: preview,
        action: null,
        plan: proposed.plan,
      };
    }

    // Process the tool calls
    const executedActions = [];
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        throw new Error(`Model returned invalid arguments for ${toolName}`);
      }
      if (!LOCAL_COMMAND_TOOLS.some(({ function: tool }) => tool.name === toolName)) {
        throw new Error(`Tool is not enabled in the local command path: ${toolName}`);
      }

      let observation;
      if (typeof toolExecutor === "function") {
        let result;
        try {
          result = await toolExecutor(toolName, toolArgs);
        } catch (execErr) {
          throw new DesktopToolExecutionError(`Desktop action ${toolName} failed: ${execErr.message}`);
        }
        observation = typeof result === "object" ? JSON.stringify(result) : String(result);
      } else {
        throw new Error("No authorized desktop tool executor is configured");
      }

      executedActions.push({
        type: toolName,
        args: toolArgs,
        observation: observation,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolName,
        content: observation,
      });
    }

    // Get final speech summary from model after receiving tool observations
    const secondPass = await this.groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messages,
      temperature: 0.3,
      max_tokens: 256,
    });

    const finalReply = secondPass.choices[0]?.message?.content || "Done!";

    return {
      speechText: finalReply,
      textResponse: finalReply,
      action: executedActions[0] || null,
      executedActions: executedActions,
    };
  }

  async _runFallback(userPrompt, options) {
    const message = /[\u0900-\u097F]/.test(userPrompt)
      ? "अभी कॉन्फ़िगर किया गया AI उपलब्ध नहीं है। फिर भी आप उपलब्ध स्थानीय डेस्कटॉप नियंत्रण इस्तेमाल कर सकते हैं।"
      : "The configured AI provider is unavailable right now. You can still use the supported local desktop controls.";
    return {
      speechText: message,
      textResponse: message,
      action: null,
    };
  }
}

export const groqAgentService = new GroqAgentService();

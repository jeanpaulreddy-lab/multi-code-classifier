import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CodedResult, ModuleType, AISettings, AIProvider, SearchResult, ReferenceEntry } from "../types";

// Helper to initialize Gemini client (safe if env key is missing, will throw later if used)
const getGeminiClient = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key not found for Gemini.");
  return new GoogleGenAI({ apiKey: key });
};

const codingResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    code: {
      type: Type.STRING,
      description: "The classification code (e.g., 2512 for ISCO or 6201 for ISIC).",
    },
    label: {
      type: Type.STRING,
      description: "The official label for the code.",
    },
    confidence: {
      type: Type.STRING,
      enum: ["High", "Medium", "Low"],
      description: "Confidence level of the classification.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief explanation of why this code was chosen.",
    },
  },
  required: ["code", "label", "confidence"],
};

// --- Generic OpenAI-Compatible Fetcher ---
// Handles OpenAI, DeepSeek, and Local (Ollama/LM Studio)
async function callOpenAICompatible(
  systemPrompt: string,
  userPrompt: string,
  settings: AISettings,
  jsonMode: boolean = true
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (settings.apiKey) {
    headers["Authorization"] = `Bearer ${settings.apiKey}`;
  }

  const payload = {
    model: settings.model,
    messages: [
      { role: "system", content: systemPrompt + (jsonMode ? " Output valid JSON." : "") },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    ...(jsonMode && settings.provider === AIProvider.OpenAI ? { response_format: { type: "json_object" } } : {}),
  };

  const url = settings.baseUrl || (
    settings.provider === AIProvider.OpenAI ? "https://api.openai.com/v1/chat/completions" :
    settings.provider === AIProvider.DeepSeek ? "https://api.deepseek.com/chat/completions" :
    "http://localhost:11434/v1/chat/completions"
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error (${settings.provider}): ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty response from AI provider");

    if (jsonMode) {
      const jsonStr = content.replace(/```json\n|\n```|```/g, '').trim();
      return JSON.parse(jsonStr);
    }
    
    return content;
  } catch (error) {
    console.error(`Error calling ${settings.provider}:`, error);
    throw error;
  }
}

export const searchClassification = async (
  query: string,
  module: ModuleType,
  settings: AISettings
): Promise<SearchResult[]> => {
  const systemPrompt = `You are an expert statistician specializing in ${module}.`;
  const userPrompt = `Search the ${module} classification structure for codes related to: "${query}". Return the top 5 most relevant codes as JSON: { "results": [{ "code": "...", "label": "...", "description": "..." }] }.`;

  try {
    if (settings.provider === AIProvider.Gemini) {
      const ai = getGeminiClient(settings.apiKey);
      const response = await ai.models.generateContent({
        model: settings.model || "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: systemPrompt,
        }
      });
      const text = response.text;
      if (!text) return [];
      return JSON.parse(text).results || [];
    } else {
      const json = await callOpenAICompatible(systemPrompt, userPrompt, settings, true);
      return json.results || [];
    }
  } catch (e) {
    console.error("Search failed", e);
    return [];
  }
};

export const suggestCodes = async (
  query: string,
  module: ModuleType,
  settings: AISettings
): Promise<{code: string, label: string, confidence: string}[]> => {
  const systemPrompt = `You are an autocomplete API for ${module}.`;
  const userPrompt = `The user is typing: "${query}". Suggest 3-5 relevant classification codes. Return JSON: { "suggestions": [{ "code": "...", "label": "...", "confidence": "High/Medium" }] }`;

  try {
    if (settings.provider === AIProvider.Gemini) {
      const ai = getGeminiClient(settings.apiKey);
      const response = await ai.models.generateContent({
        model: settings.model || "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: systemPrompt,
        }
      });
      const text = response.text;
      if (!text) return [];
      return JSON.parse(text).suggestions || [];
    } else {
      const json = await callOpenAICompatible(systemPrompt, userPrompt, settings, true);
      return json.suggestions || [];
    }
  } catch (error) {
    console.error("Suggestion failed", error);
    return [];
  }
};

export const codeSingleOccupation = async (
  primaryText: string,
  secondaryText: string,
  module: ModuleType,
  settings: AISettings,
  tertiaryText?: string,
  examples: ReferenceEntry[] = []
): Promise<CodedResult> => {
  
  let systemPrompt = "";
  let contextInfo = "";

  // Build Few-Shot Prompt Context from Examples
  if (examples.length > 0) {
    contextInfo = "\n\nUse these similar past decisions from the dictionary as reference logic:\n";
    examples.forEach(ex => {
      contextInfo += `- Input: "${ex.term}" was coded as Code: ${ex.code} ("${ex.label}")\n`;
    });
    contextInfo += "\nApply similar logic to the new item below.\n";
  }

  let userPrompt = "";

  // Define Prompts
  if (module === ModuleType.ISCO08) {
    systemPrompt = "You are an expert statistician specializing in ISCO-08.";
    userPrompt = `${contextInfo}Classify: Job Title: "${primaryText}", Description: "${secondaryText}". Return JSON with fields: code (4-digit string), label (string), confidence (High/Medium/Low), reasoning (string).`;
  } else if (module === ModuleType.ISIC4) {
    systemPrompt = "You are an expert statistician specializing in ISIC Rev. 4.";
    userPrompt = `${contextInfo}Classify: Activity: "${primaryText}", Details: "${secondaryText}". Return JSON with fields: code (4-digit string), label (string), confidence (High/Medium/Low), reasoning (string).`;
  } else if (module === ModuleType.COICOP) {
    systemPrompt = "You are an expert statistician specializing in COICOP 2018.";
    userPrompt = `${contextInfo}Classify: Item: "${primaryText}", Context: "${secondaryText}". Return JSON with fields: code (4-digit string), label (string), confidence (High/Medium/Low), reasoning (string).`;
  } else if (module === ModuleType.DUAL) {
    systemPrompt = "You are an expert statistician.";
    const industryInfo = tertiaryText || secondaryText;
    userPrompt = `${contextInfo}Perform DUAL CODING for: Job Title: "${primaryText}", Industry: "${industryInfo}".
      1. Determine ISCO-08 code.
      2. Determine ISIC Rev. 4 code.
      Return JSON:
      - code: "ISCO: <isco> / ISIC: <isic>"
      - label: "<isco_label> / <isic_label>"
      - confidence: "High" (if both high), else "Medium/Low"
      - reasoning: "ISCO: <reason>. ISIC: <reason>."`;
  }

  try {
    if (settings.provider === AIProvider.Gemini) {
      // --- GEMINI SPECIFIC IMPLEMENTATION ---
      const ai = getGeminiClient(settings.apiKey);
      const response = await ai.models.generateContent({
        model: settings.model || "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: codingResponseSchema,
          temperature: 0.1,
          systemInstruction: systemPrompt,
          thinkingConfig: settings.model?.includes('2.5') ? { thinkingBudget: 1024 } : undefined 
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from model");
      return JSON.parse(text) as CodedResult;

    } else {
      // --- OPENAI / DEEPSEEK / LOCAL IMPLEMENTATION ---
      const result = await callOpenAICompatible(systemPrompt, userPrompt, settings, true);
      return result as CodedResult;
    }

  } catch (error) {
    console.error("Error coding item:", error);
    throw error;
  }
};
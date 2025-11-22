import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CodedResult, ModuleType, AISettings, ProcessingMode, SearchResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

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

const searchResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
           code: { type: Type.STRING },
           label: { type: Type.STRING },
           description: { type: Type.STRING }
        },
        required: ["code", "label", "description"]
      }
    }
  }
};

const suggestionResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
           code: { type: Type.STRING },
           label: { type: Type.STRING },
           confidence: { type: Type.STRING }
        },
        required: ["code", "label", "confidence"]
      }
    }
  }
};

export const codeOccupationBatch = async (
  items: { id: string; title: string; description: string }[]
): Promise<Record<string, CodedResult>> => {
  return {}; // Placeholder
};

export const searchClassification = async (
  query: string,
  module: ModuleType,
  settings: AISettings
): Promise<SearchResult[]> => {
  const prompt = `
    You are an expert statistician specializing in ${module}.
    Search the ${module} classification structure for codes related to the term: "${query}".
    Return a list of the top 5 most relevant codes, including their official code, label, and a brief description of what is included.
    Sort by relevance.
  `;

  try {
     if (settings.mode === ProcessingMode.Cloud) {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
             responseMimeType: "application/json",
             responseSchema: searchResponseSchema,
             temperature: 0.1
          }
        });
        const text = response.text;
        if (!text) return [];
        const json = JSON.parse(text);
        return json.results || [];
     } else {
        // Local Fallback
        const payload = {
          model: settings.localModel,
          messages: [
             { role: "system", content: "You are a classification search assistant. Output JSON." },
             { role: "user", content: prompt + " Output valid JSON with format { results: [{code, label, description}] }." }
          ],
          temperature: 0.1,
          format: "json"
        };
        const response = await fetch(settings.localUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Local API Error");
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return [];
        const jsonStr = content.replace(/```json\n|\n```/g, '').trim();
        const json = JSON.parse(jsonStr);
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
  const prompt = `
    You are an autocomplete API for ${module}.
    The user is typing: "${query}".
    Suggest 3-5 relevant classification codes.
    Return JSON: { "suggestions": [{ "code": "...", "label": "...", "confidence": "High/Medium" }] }
  `;

  try {
    if (settings.mode === ProcessingMode.Cloud) {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: suggestionResponseSchema,
          temperature: 0.3
        }
      });
      const text = response.text;
      if (!text) return [];
      const json = JSON.parse(text);
      return json.suggestions || [];
    } else {
        // Local fallback for suggestions
        const payload = {
            model: settings.localModel,
            messages: [
                { role: "system", content: "You are an auto-complete assistant. Output JSON." },
                { role: "user", content: prompt + " Output valid JSON." }
            ],
            temperature: 0.3,
            format: "json"
        };
        const response = await fetch(settings.localUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return [];
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return [];
        const jsonStr = content.replace(/```json\n|\n```/g, '').trim();
        const json = JSON.parse(jsonStr);
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
  tertiaryText?: string // Optional industry column for dual coding
): Promise<CodedResult> => {
  
  let prompt = "";
  
  // Define Prompts
  if (module === ModuleType.ISCO08) {
    prompt = `
      You are an expert statistician specializing in ISCO-08.
      Classify: Job Title: "${primaryText}", Description: "${secondaryText}".
      Return JSON with fields: code (4-digit string), label (string), confidence (High/Medium/Low), reasoning (string).
    `;
  } else if (module === ModuleType.ISIC4) {
    prompt = `
      You are an expert statistician specializing in ISIC Rev. 4.
      Classify: Activity: "${primaryText}", Details: "${secondaryText}".
      Return JSON with fields: code (4-digit string), label (string), confidence (High/Medium/Low), reasoning (string).
    `;
  } else if (module === ModuleType.COICOP) {
    prompt = `
      You are an expert statistician specializing in COICOP 2018.
      Classify: Item: "${primaryText}", Context: "${secondaryText}".
      Return JSON with fields: code (4-digit string), label (string), confidence (High/Medium/Low), reasoning (string).
    `;
  } else if (module === ModuleType.DUAL) {
    // Dual Coding Prompt
    const industryInfo = tertiaryText || secondaryText;
    prompt = `
      You are an expert statistician. Perform DUAL CODING for:
      Job Title: "${primaryText}"
      Industry/Activity: "${industryInfo}"

      1. Determine the ISCO-08 code for the occupation.
      2. Determine the ISIC Rev. 4 code for the industry activity.

      Return a merged JSON object:
      - code: "ISCO: <isco_code> / ISIC: <isic_code>"
      - label: "<isco_label> / <isic_label>"
      - confidence: "High" (only if both are high, otherwise Medium/Low)
      - reasoning: "ISCO: <reasoning>. ISIC: <reasoning>."
    `;
  }

  try {
    if (settings.mode === ProcessingMode.Cloud) {
      // --- CLOUD MODE (GEMINI) ---
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: codingResponseSchema,
          temperature: 0.1,
          // Enable Thinking for better accuracy on classification tasks
          thinkingConfig: { thinkingBudget: 1024 }
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from model");
      return JSON.parse(text) as CodedResult;

    } else {
      // --- LOCAL MODE (OFFLINE / CUSTOM URL) ---
      // Expecting OpenAI-compatible endpoint (e.g. Ollama, LM Studio)
      const payload = {
        model: settings.localModel,
        messages: [
          { role: "system", content: "You are a classification assistant. You only output valid JSON." },
          { role: "user", content: prompt + " IMPORTANT: Output ONLY valid JSON." }
        ],
        temperature: 0.1,
        stream: false,
        format: "json" // Ollama supports this
      };

      const response = await fetch(settings.localUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Local API error: ${response.statusText}`);
      }

      const data = await response.json();
      // Parse standard OpenAI-format response
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from local model");
      
      // Attempt to parse JSON from content (sometimes local LLMs add markdown code blocks)
      const jsonStr = content.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(jsonStr) as CodedResult;
    }

  } catch (error) {
    console.error("Error coding item:", error);
    throw error; // Rethrow to allow App to handle error state
  }
};
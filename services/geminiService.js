// services/geminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  // Define the function schema for Gemini 2.0 Flash
  getFunctionDefinitions() {
    return [
      {
        name: "suggest_time_slots",
        description: "Find optimal time slots for tasks considering energy levels",
        parameters: {
          type: "object",
          properties: {
            optimal_slots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  start_time: { type: "string", format: "date-time" },
                  end_time: { type: "string", format: "date-time" },
                  score: { type: "number" },
                  reason: { type: "string" }
                }
              }
            }
          },
          required: ["optimal_slots"]
        }
      },
      {
        name: "prioritize_tasks",
        description: "Prioritize tasks based on deadlines, importance, and user preferences",
        parameters: {
          type: "object",
          properties: {
            prioritized_tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_id: { type: "integer" },
                  priority_score: { type: "number" },
                  suggested_order: { type: "integer" },
                  reason: { type: "string" }
                }
              }
            }
          },
          required: ["prioritized_tasks"]
        }
      },
      {
        name: "generate_roadmap",
        description: "Create optimization plan for work-life balance",
        parameters: {
          type: "object",
          properties: {
            weekly_goals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  goal_type: { 
                    type: "string",
                    enum: ["productivity", "wellness", "learning", "personal"]
                  },
                  description: { type: "string" },
                  suggested_actions: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            daily_schedule_template: {
              type: "object",
              properties: {
                work_blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      start_hour: { type: "number" },
                      end_hour: { type: "number" },
                      focus_type: { type: "string" }
                    }
                  }
                },
                break_times: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      start_hour: { type: "number" },
                      duration_minutes: { type: "number" },
                      break_type: { type: "string" }
                    }
                  }
                }
              }
            },
            wellness_recommendations: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["weekly_goals", "daily_schedule_template", "wellness_recommendations"]
        }
      }
    ];
  }

  async suggestTimeSlots(schedule, freeSlots, taskType, duration, userPreferences) {
    try {
      const prompt = `
      Analyze this user's schedule and suggest optimal time slots for a ${taskType} task that requires ${duration} minutes.
      
      User schedule: ${JSON.stringify(schedule)}
      Available free slots: ${JSON.stringify(freeSlots)}
      User preferences: ${JSON.stringify(userPreferences)}
      
      Consider the following factors:
      - If the task type is "deep_work", prioritize morning slots for morning people and afternoon/evening for night owls
      - For "meeting" tasks, avoid scheduling back-to-back meetings when possible
      - For "creative" tasks, find times when the user historically has more energy
      - For "physical" tasks, consider appropriate spacing from meals and other physical activities
      
      Return the top 3 suggested time slots with scores and reasoning.
      `;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          topP: 0.8,
          topK: 40
        },
        tools: {
          functionDeclarations: [this.getFunctionDefinitions()[0]]
        }
      });

      const response = result.response;
      const functionCall = response.functionCalls?.[0];
      
      if (functionCall && functionCall.name === 'suggest_time_slots') {
        return JSON.parse(functionCall.args.optimal_slots);
      } else {
        // Fallback parsing if function calling doesn't work as expected
        const textResponse = response.text();
        try {
          return JSON.parse(textResponse).optimal_slots;
        } catch (e) {
          console.error('Error parsing Gemini response:', e);
          throw new Error('Failed to parse AI suggestions');
        }
      }
    } catch (error) {
      console.error('Error getting time slot suggestions from Gemini:', error);
      throw error;
    }
  }

  async prioritizeTasks(tasks, userGoals, deadlines) {
    try {
      const prompt = `
      Prioritize these tasks based on deadlines, importance, and alignment with user goals.
      
      Tasks: ${JSON.stringify(tasks)}
      User goals: ${JSON.stringify(userGoals)}
      Deadlines: ${JSON.stringify(deadlines)}
      
      Consider:
      - Urgency (deadline proximity)
      - Importance (alignment with goals)
      - Dependencies between tasks
      - Time required vs. time available
      
      Return prioritized list with scores, suggested order, and reasoning.
      `;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          topP: 0.8,
          topK: 40
        },
        tools: {
          functionDeclarations: [this.getFunctionDefinitions()[1]]
        }
      });

      const response = result.response;
      const functionCall = response.functionCalls?.[0];
      
      if (functionCall && functionCall.name === 'prioritize_tasks') {
        return JSON.parse(functionCall.args.prioritized_tasks);
      } else {
        // Fallback parsing
        const textResponse = response.text();
        try {
          return JSON.parse(textResponse).prioritized_tasks;
        } catch (e) {
          console.error('Error parsing Gemini response:', e);
          throw new Error('Failed to parse AI prioritization');
        }
      }
    } catch (error) {
      console.error('Error prioritizing tasks with Gemini:', error);
      throw error;
    }
  }

  async generateRoadmap(userProfile, historicalData, userGoals) {
    try {
      const prompt = `
      Create a 30-day work-life balance optimization plan for this user.
      
      User profile: ${JSON.stringify(userProfile)}
      Historical schedule data: ${JSON.stringify(historicalData)}
      User goals: ${JSON.stringify(userGoals)}
      
      The plan should include:
      - Weekly goals for productivity, wellness, learning, and personal time
      - Daily schedule template with optimal work blocks and break times
      - Wellness recommendations tailored to user preferences
      
      Make the plan realistic and achievable based on the user's past behavior.
      `;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 40
        },
        tools: {
          functionDeclarations: [this.getFunctionDefinitions()[2]]
        }
      });

      const response = result.response;
      const functionCall = response.functionCalls?.[0];
      
      if (functionCall && functionCall.name === 'generate_roadmap') {
        const args = functionCall.args;
        return {
          weekly_goals: JSON.parse(args.weekly_goals),
          daily_schedule_template: JSON.parse(args.daily_schedule_template),
          wellness_recommendations: JSON.parse(args.wellness_recommendations)
        };
      } else {
        // Fallback parsing
        const textResponse = response.text();
        try {
          return JSON.parse(textResponse);
        } catch (e) {
          console.error('Error parsing Gemini response:', e);
          throw new Error('Failed to parse AI roadmap');
        }
      }
    } catch (error) {
      console.error('Error generating roadmap with Gemini:', error);
      throw error;
    }
  }
}

module.exports = GeminiService;
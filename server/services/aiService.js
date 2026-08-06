import { GoogleGenAI, Type } from '@google/genai';
import { Meeting } from '../models/MeetingModel.js';
import redisClient, { isRedisConnected } from '../database/redis.js';

/**
 * Transcribe video/audio recording from a public S3 URL using AssemblyAI.
 * @param {string} s3Url - Public Amazon S3 URL of the video/audio recording.
 * @returns {Promise<Array<{ speakerName: string, text: string, timestamp: Date }>>} Formatted transcript segments
 */
export async function transcribeFromS3WithAssemblyAI(s3Url) {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        throw new Error("ASSEMBLYAI_API_KEY is not set in server/.env");
    }

    console.log(`Initiating AssemblyAI transcription for recording: ${s3Url}`);

    // 1. Request Transcription with speaker labels enabled
    const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
            "authorization": apiKey,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            audio_url: s3Url,
            speaker_labels: true
        })
    });

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(`AssemblyAI submit error (${submitResponse.status}): ${errorText}`);
    }

    const transcriptJob = await submitResponse.json();
    const transcriptId = transcriptJob.id;
    console.log(`AssemblyAI transcript job submitted. Job ID: ${transcriptId}`);

    // 2. Poll AssemblyAI for job completion (every 3 seconds)
    const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    let completedJob = null;

    while (true) {
        await new Promise(res => setTimeout(res, 3000));
        const pollResponse = await fetch(pollUrl, {
            headers: { "authorization": apiKey }
        });

        if (!pollResponse.ok) {
            throw new Error(`AssemblyAI poll error: ${pollResponse.statusText}`);
        }

        const data = await pollResponse.json();
        if (data.status === "completed") {
            completedJob = data;
            break;
        } else if (data.status === "error") {
            throw new Error(`AssemblyAI processing error: ${data.error}`);
        }
        console.log(`AssemblyAI status for ${transcriptId}: ${data.status}...`);
    }

    // 3. Format utterances into transcript segments
    const segments = [];
    if (completedJob.utterances && completedJob.utterances.length > 0) {
        for (const u of completedJob.utterances) {
            segments.push({
                speakerName: `Speaker ${u.speaker}`,
                text: u.text,
                timestamp: new Date(u.start)
            });
        }
    } else if (completedJob.text) {
        segments.push({
            speakerName: "Speaker",
            text: completedJob.text,
            timestamp: new Date()
        });
    }

    console.log(`AssemblyAI transcription complete. Formatted ${segments.length} transcript segments.`);
    return { segments, rawText: completedJob.text || "" };
}

/**
 * Generate meeting summary and extract action items using the Google Gen AI SDK.
 * Primary model: gemini-2.5-flash (with fallbacks to gemini-2.0-flash / gemini-1.5-flash).
 * @param {string} transcriptText - Full text transcript of the meeting.
 * @returns {Promise<{ summary: string, actionItems: Array<{ task: string, assigneeName: string, status: string }> }>}
 */
export async function extractSummaryAndActionItemsWithGemini(transcriptText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in server/.env");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Models to try in order of preference
    const modelsToTry = [
        process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
    ];

    const promptText = `Analyze the following meeting transcript and extract:
1. A concise, professional 2-4 sentence summary of the key discussions and decisions.
2. A list of action items / tasks assigned or agreed upon, including the assignee's name if mentioned (or "Unassigned" if unspecified).

Meeting Transcript:
${transcriptText}`;

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`[AI SDK] Attempting summary generation with model: ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: promptText,
                config: {
                    systemInstruction: "You are an expert AI meeting assistant. Output strictly structured JSON matching the requested schema.",
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            summary: {
                                type: Type.STRING,
                                description: "Concise 2-4 sentence executive summary of the meeting."
                            },
                            actionItems: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        task: { type: Type.STRING, description: "Description of the action item" },
                                        assigneeName: { type: Type.STRING, description: "Assignee Name or Unassigned" },
                                        status: { type: Type.STRING, description: "Initial status, set to pending" }
                                    },
                                    required: ["task", "assigneeName", "status"]
                                }
                            }
                        },
                        required: ["summary", "actionItems"]
                    }
                }
            });

            const responseText = response.text || "";
            let cleanedJsonText = responseText.trim();
            if (cleanedJsonText.startsWith("```")) {
                cleanedJsonText = cleanedJsonText.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "").trim();
            }

            const parsedData = JSON.parse(cleanedJsonText);
            console.log(`[AI SDK] Successfully extracted AI Summary & Action Items via Google Gen AI SDK (${modelName}).`);
            return {
                summary: parsedData.summary || "",
                actionItems: parsedData.actionItems || []
            };
        } catch (err) {
            console.warn(`[AI SDK] Model ${modelName} failed: ${err.message || err}`);
            lastError = err;
            if (err.message && err.message.includes("GEMINI_API_KEY")) {
                throw err;
            }
        }
    }

    throw new Error(`Google Gen AI SDK extraction failed: ${lastError?.message || lastError}`);
}

/**
 * High-level automatic orchestrator: Uploads, transcribes via AssemblyAI, summarizes via Gemini, and updates MongoDB.
 * @param {string} meetingCode - Meeting room code.
 * @param {string} s3Url - Public Amazon S3 recording URL.
 */
export async function autoProcessMeetingAI(meetingCode, s3Url) {
    console.log(`[AI Pipeline] Starting automatic background AI processing for meeting: ${meetingCode}`);

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) {
        console.error(`[AI Pipeline] Meeting not found: ${meetingCode}`);
        return;
    }

    meeting.recordingUrl = s3Url;
    await meeting.save();

    // 1. Transcribe via AssemblyAI
    if (!process.env.ASSEMBLYAI_API_KEY) {
        console.warn("[AI Pipeline] ASSEMBLYAI_API_KEY not configured. Skipping transcription.");
        return;
    }

    try {
        const { segments, rawText } = await transcribeFromS3WithAssemblyAI(s3Url);
        meeting.transcript = segments;
        await meeting.save();

        // 2. Extract Summary & Action Items via Gemini 1.5 Flash
        if (!process.env.GEMINI_API_KEY) {
            console.warn("[AI Pipeline] GEMINI_API_KEY not configured. Skipping summary generation.");
            return;
        }

        const { summary, actionItems } = await extractSummaryAndActionItemsWithGemini(rawText);
        meeting.summary = summary;
        meeting.actionItems = actionItems;
        await meeting.save();

        // Invalidate Redis cache
        if (isRedisConnected) {
            try {
                await redisClient.del(`meeting:${meetingCode}`);
            } catch (rErr) {
                console.error("Redis cache invalidate error:", rErr);
            }
        }

        console.log(`[AI Pipeline] Successfully completed automatic processing for meeting ${meetingCode}!`);
    } catch (err) {
        console.error(`[AI Pipeline] Error during AI processing for ${meetingCode}:`, err);
    }
}

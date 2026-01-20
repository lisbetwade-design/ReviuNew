import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateSummaryRequest {
  designId: string;
  projectId: string;
}

interface IdentifiedPattern {
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  description: string;
  examples: string[];
  mentions: number;
}

interface CriticalIssue {
  issue: string;
}

interface ActionableNextStep {
  title: string;
  description: string;
  tag: string;
  priority: "urgent" | "high" | "medium" | "low";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Starting generate-summary function');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { designId, projectId }: GenerateSummaryRequest = await req.json();
    console.log('Request params:', { designId, projectId });

    // Fetch all comments for this design
    const { data: comments, error: commentsError } = await supabaseClient
      .from("comments")
      .select("*")
      .eq("design_id", designId)
      .order("created_at", { ascending: false });

    console.log('Comments fetched:', { count: comments?.length, error: commentsError });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      throw commentsError;
    }

    if (!comments || comments.length === 0) {
      console.log('No comments found to summarize');
      return new Response(
        JSON.stringify({ error: "No feedback to summarize" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare feedback text for AI
    const feedbackText = comments
      .map((c, i) => `[${i + 1}] ${c.author_name}: ${c.content}${c.rating ? ` (Rating: ${c.rating}/5)` : ""}`)
      .join("\n\n");

    let summaryData;

    try {
      const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiApiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      const prompt = `You are an expert UX analyst. Analyze the following design feedback and identify patterns, critical issues, and actionable next steps.

Feedback:
${feedbackText}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "identifiedPatterns": [
    {
      "title": "Pattern name (e.g., 'Button Colors & Visibility')",
      "priority": "critical",
      "description": "Brief description of the pattern",
      "examples": ["Example quote 1", "Example quote 2", "Example quote 3"],
      "mentions": 5
    }
  ],
  "criticalIssues": [
    "Issue description 1",
    "Issue description 2",
    "Issue description 3"
  ],
  "actionableNextSteps": [
    {
      "title": "Action title",
      "description": "Detailed description of what needs to be done",
      "tag": "Usability",
      "priority": "urgent"
    }
  ]
}

Rules:
- Identify 3-5 repeating patterns across feedback
- priority for patterns: "critical", "high", "medium", or "low"
- Provide 3-5 example quotes per pattern (exact quotes from feedback when possible)
- Extract 2-4 critical issues (high-level problems)
- Create 3-5 actionable next steps
- tag for next steps: "Usability", "Development", "Copy", "Design", "Performance", or "Other"
- priority for next steps: "urgent", "high", "medium", or "low"
- Be specific and actionable`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert UX analyst. Always respond with valid JSON only, no markdown formatting.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const aiResult = await response.json();
      const content = aiResult.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const cleanedOutput = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const jsonMatch = cleanedOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON in AI response");
      }
    } catch (aiError) {
      console.error("AI processing failed, using intelligent fallback", aiError);

      const ratedComments = comments.filter(c => c.rating);
      const avgRating = ratedComments.length > 0
        ? ratedComments.reduce((sum, c) => sum + (c.rating || 0), 0) / ratedComments.length
        : 3;

      const positiveComments = comments.filter(c => (c.rating || 0) >= 4);
      const negativeComments = comments.filter(c => (c.rating || 0) <= 2);

      const commonWords = feedbackText.toLowerCase().split(/\s+/)
        .filter(word => word.length > 5)
        .reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const topWords = Object.entries(commonWords)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([word]) => word);

      // Fallback structure matching the new format
      summaryData = {
        identifiedPatterns: topWords.slice(0, 3).map((word, idx) => ({
          title: word.charAt(0).toUpperCase() + word.slice(1) + " Issues",
          priority: idx === 0 ? "critical" : idx === 1 ? "high" : "medium",
          description: `Multiple stakeholders mentioned issues related to ${word}`,
          examples: comments
            .filter(c => c.content.toLowerCase().includes(word))
            .slice(0, 3)
            .map(c => c.content.substring(0, 100)),
          mentions: commonWords[word],
        })),
        criticalIssues: [
          negativeComments.length > 0
            ? `Address ${negativeComments.length} negative feedback item(s) requiring immediate attention`
            : "Review all feedback for potential improvements",
          `Analyze ${comments.length} total feedback items for patterns`,
        ],
        actionableNextSteps: [
          {
            title: "Review High Priority Feedback",
            description: `Analyze ${negativeComments.length} concern(s) and ${positiveComments.length} positive comment(s)`,
            tag: "Usability",
            priority: negativeComments.length > positiveComments.length ? "urgent" : "high",
          },
          {
            title: "Address User Concerns",
            description: "Focus on resolving the issues identified in low-rated feedback",
            tag: "Development",
            priority: negativeComments.length > 0 ? "high" : "medium",
          },
          {
            title: "Build on Positive Feedback",
            description: "Identify and enhance aspects users appreciate",
            tag: "Design",
            priority: positiveComments.length > 0 ? "medium" : "low",
          },
        ],
      };
    }

    // Save summary to database
    console.log('Saving summary to database...');
    const { data: summary, error: summaryError } = await supabaseClient
      .from("feedback_summaries")
      .upsert(
        {
          project_id: projectId,
          design_id: designId,
          summary_data: {
            ...summaryData,
            feedbackCount: comments.length,
            generated_at: new Date().toISOString(),
          },
        },
        {
          onConflict: "project_id,design_id",
        }
      )
      .select()
      .single();

    if (summaryError) {
      console.error('Error saving summary:', summaryError);
      throw summaryError;
    }

    console.log('Summary saved successfully');
    return new Response(
      JSON.stringify({ success: true, summary }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-summary function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

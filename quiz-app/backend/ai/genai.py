from google import genai
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import google_search
from google.genai import types

from ai.prompts import (
    SYSTEM_PROMPT,
    TOPICS_AGENT_SYSTEM_PROMPT,
    QUIZ_AGENT_SYSTEM_PROMPT,
    TOPICS_USER_PROMPT,
    get_quiz_user_prompt,
    get_regenerate_prompt,
)
from schema import QuizQuestions, TrendingTopics, TieredQuizQuestions

# ============================================
# GEMINI CLIENT SETUP
# ============================================

def get_gemini_client():
    """Create and return a Gemini client configured for Vertex AI."""
    return genai.Client(
        vertexai=True, 
        project='gen-lang-client-0899905004', 
        location='global'
    )


# ============================================
# SESSION MANAGEMENT (Singleton for agent memory)
# ============================================

# Global session service - persists across requests within the same server process
_quiz_session_service = InMemorySessionService()

# Store active session IDs per user/week
_active_quiz_sessions: dict[str, str] = {}


# ============================================
# TRENDING TOPICS AGENT
# ============================================

# Create the topics agent (singleton)
topics_agent = Agent(
    name="trending_topics_agent",
    model="gemini-3.5-flash",
    description="Research assistant that finds trending topics in India for quiz questions",
    instruction=TOPICS_AGENT_SYSTEM_PROMPT,
    tools=[google_search],
    output_schema=TrendingTopics,
)


async def generate_trending_topics() -> list[dict]:
    """
    Step 1: Generate trending topics using Google Search.
    Returns a list of trending topics with descriptions.
    """
    print("[Topics Agent] Starting trending topics generation...")
    
    # Create session and runner
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name="quiz_app",
        user_id="admin",
        session_id=f"topics_{id(session_service)}"  # Unique session ID
    )
    
    runner = Runner(
        agent=topics_agent,
        app_name="quiz_app",
        session_service=session_service
    )
    
    # Create the user message
    content = types.Content(
        role='user',
        parts=[types.Part(text=TOPICS_USER_PROMPT)]
    )
    
    # Run the agent
    result = None
    async for event in runner.run_async(
        user_id="admin",
        session_id=session.id,
        new_message=content
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                result = event.content.parts[0].text
                print(f"[Topics Agent] Received response")
    
    if not result:
        raise Exception("Failed to get trending topics from agent")
    
    # Parse the JSON response
    import json
    try:
        parsed = json.loads(result)
        topics = parsed.get("topics", [])
        print(f"[Topics Agent] Found {len(topics)} trending topics")
        return topics
    except json.JSONDecodeError as e:
        print(f"[Topics Agent] JSON parse error: {e}")
        raise Exception(f"Failed to parse topics response: {e}")


# ============================================
# QUIZ GENERATION AGENT
# ============================================

# Create the quiz agent (singleton)
# Note: output_schema is enforced on ALL turns, but we set high max_output_tokens
# to prevent truncation when session history grows large
quiz_agent = Agent(
    name="quiz_generation_agent",
    model="gemini-3.5-flash",
    description="Expert quiz master that generates tiered difficulty questions",
    instruction=QUIZ_AGENT_SYSTEM_PROMPT,
    tools=[google_search],
    output_schema=TieredQuizQuestions
)


async def generate_tiered_questions(selected_topics: list[str], week_id: str = "default") -> dict:
    """
    Step 2: Generate tiered quiz questions with the selected trending topics.
    Returns questions organized by difficulty: easy (10), medium (6), hard (4).
    Creates a new session that can be reused for regeneration.
    """
    print(f"[Quiz Agent] Starting question generation with {len(selected_topics)} selected topics...")
    print(f"[Quiz Agent] Topics: {selected_topics}")
    
    # Create a unique session key for this week
    session_key = f"quiz_{week_id}"
    
    # Create a new session for this generation
    import uuid
    session_id = f"quiz_{uuid.uuid4().hex[:8]}"
    
    session = await _quiz_session_service.create_session(
        app_name="quiz_app",
        user_id="admin",
        session_id=session_id
    )
    
    # Store the session ID for potential regeneration
    _active_quiz_sessions[session_key] = session_id
    print(f"[Quiz Agent] Created new session: {session_id}")
    
    runner = Runner(
        agent=quiz_agent,
        app_name="quiz_app",
        session_service=_quiz_session_service
    )
    
    # Create the user message with selected topics
    user_prompt = get_quiz_user_prompt(selected_topics)
    content = types.Content(
        role='user',
        parts=[types.Part(text=user_prompt)]
    )
    
    # Run the agent
    result = None
    async for event in runner.run_async(
        user_id="admin",
        session_id=session.id,
        new_message=content
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                result = event.content.parts[0].text
                print(f"[Quiz Agent] Received response")
    
    if not result:
        raise Exception("Failed to get quiz questions from agent")
    
    # Parse the JSON response
    import json
    try:
        parsed = json.loads(result)
        easy_count = len(parsed.get("easy_questions", []))
        medium_count = len(parsed.get("medium_questions", []))
        hard_count = len(parsed.get("hard_questions", []))
        print(f"[Quiz Agent] Generated {easy_count} easy, {medium_count} medium, {hard_count} hard questions")
        
        # Include session_id in response for regeneration
        parsed["session_id"] = session_id
        return parsed
    except json.JSONDecodeError as e:
        print(f"[Quiz Agent] JSON parse error: {e}")
        raise Exception(f"Failed to parse quiz response: {e}")


async def regenerate_tiered_questions(session_id: str, feedback: str) -> dict:
    """
    Regenerate questions using the same session (agent memory).
    The agent will remember the previous context and topics.
    
    Args:
        session_id: The session ID from the initial generation
        feedback: User feedback like "too difficult", "different questions", etc.
    """
    print(f"[Quiz Agent] Regenerating with session: {session_id}")
    print(f"[Quiz Agent] Feedback: {feedback}")
    
    runner = Runner(
        agent=quiz_agent,
        app_name="quiz_app",
        session_service=_quiz_session_service
    )
    
    # Create the regeneration prompt with user feedback
    regen_prompt = get_regenerate_prompt(feedback)

    content = types.Content(
        role='user',
        parts=[types.Part(text=regen_prompt)]
    )
    
    # Run the agent with the existing session
    result = None
    async for event in runner.run_async(
        user_id="admin",
        session_id=session_id,
        new_message=content
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                result = event.content.parts[0].text
                print(f"[Quiz Agent] Received regeneration response")
    
    if not result:
        raise Exception("Failed to regenerate quiz questions")
    
    # Clean up the response - remove markdown code blocks if present
    result = result.strip()
    if result.startswith("```json"):
        result = result[7:]
    elif result.startswith("```"):
        result = result[3:]
    if result.endswith("```"):
        result = result[:-3]
    result = result.strip()
    
    # Parse the JSON response
    import json
    try:
        parsed = json.loads(result)
        easy_count = len(parsed.get("easy_questions", []))
        medium_count = len(parsed.get("medium_questions", []))
        hard_count = len(parsed.get("hard_questions", []))
        print(f"[Quiz Agent] Regenerated {easy_count} easy, {medium_count} medium, {hard_count} hard questions")
        
        # Keep the same session_id for further regenerations
        parsed["session_id"] = session_id
        return parsed
    except json.JSONDecodeError as e:
        print(f"[Quiz Agent] JSON parse error: {e}")
        print(f"[Quiz Agent] Raw response (first 500 chars): {result[:500]}")
        print(f"[Quiz Agent] Raw response (last 200 chars): {result[-200:]}")
        
        # Try to repair truncated JSON by finding the last complete question
        try:
            # Find the last complete "}" that could be an object end
            repaired = repair_truncated_json(result)
            if repaired:
                parsed = json.loads(repaired)
                parsed["session_id"] = session_id
                print(f"[Quiz Agent] Successfully repaired truncated JSON")
                return parsed
        except Exception as repair_error:
            print(f"[Quiz Agent] Repair failed: {repair_error}")
        
        raise Exception(f"Failed to parse regeneration response: {e}")


def repair_truncated_json(json_str: str) -> str:
    """Attempt to repair a truncated JSON response."""
    import re
    
    # Count open braces and brackets
    open_braces = json_str.count('{') - json_str.count('}')
    open_brackets = json_str.count('[') - json_str.count(']')
    
    # If we have unclosed structures, try to close them
    if open_braces > 0 or open_brackets > 0:
        # Find the last complete question object
        # Look for patterns like }, { or }, ] which indicate complete objects
        last_complete = json_str.rfind('},')
        if last_complete == -1:
            last_complete = json_str.rfind('}]')
        
        if last_complete > 0:
            # Truncate at the last complete object
            json_str = json_str[:last_complete + 1]
            
            # Now close any remaining open structures
            open_braces = json_str.count('{') - json_str.count('}')
            open_brackets = json_str.count('[') - json_str.count(']')
            
            json_str += ']' * open_brackets
            json_str += '}' * open_braces
    
    return json_str


# ============================================
# LEGACY FUNCTION (for backward compatibility)
# ============================================

async def generate_questions_by_ai():
    """
    Legacy function for generating questions without the two-step process.
    Kept for backward compatibility.
    """
    print("Creating gemini client")
    client = get_gemini_client()
    print("Gemini client created")

    async_client = client.aio

    print("Generating quiz questions")
    response = await async_client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Generate 20 questions",
        config={
            "system_instruction": SYSTEM_PROMPT,
            "response_mime_type": "application/json",
            "response_schema": QuizQuestions,
        }
    )

    print(response)
    return response.parsed.question_sets




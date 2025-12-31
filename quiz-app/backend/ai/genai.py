from google import genai
from system_prompt import SYSTEM_PROMPT
from schema import QuizQuestions


async def generate_questions_by_ai():
    

    # gemini client with api key
    # client = genai.Client(api_key='GEMINI_API_KEY')

    # gemini client with vertex (gcloud)
    # client = genai.Client(
    # vertexai=True, project='gen-lang-client-0899905004', location='us-central1'
    # )

    # gemini async client with vertex (gcloud)
    print("Creating gemini client")
    client = genai.Client(
    vertexai=True, project='gen-lang-client-0899905004', location='global'
    )
    print("Gemini client created")

    async_client = client.aio

    print("Generating quiz questions")
    response = await async_client.models.generate_content(
        model="gemini-3-flash-preview",
        contents = "Generate 20 questions",
        config={
            "system_instruction": SYSTEM_PROMPT,
            "response_mime_type": "application/json",
            "response_json_schema": QuizQuestions.model_json_schema(),
        }
    )
    # if(response.sdk_http_response.status_code == 200):
    #     print("Quiz questions generated successfully")
    # else:
    #     print("Failed to generate quiz questions")

    print(response)

    return response.parsed["question_sets"]




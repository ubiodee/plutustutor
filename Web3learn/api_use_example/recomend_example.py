from openai import OpenAI
import os
import json
import time

# Load API key from env
client = OpenAI(api_key="")
# Your prompt agent ID
PROMPT_ID = "recommend model"  # e.g., pmpt_xxxxx

# Input payload
test_input = {
    "personality": "expressive",
    "level": "beginner",
    "topic": "what is plutus?",
    "query": "What is Plutus?"
}


def test_prompt_agent(input_data):
    try:
        start_time = time.time()

        # Call prompt agent
        response = client.responses.create(
            prompt={
                "id": PROMPT_ID,
                "variables": input_data
            }
        )

        end_time = time.time()

        # Extract output
        output_text = response.output_text

        # Print results
        print("\n🧾 INPUT:")
        print(json.dumps(input_data, indent=2))

        print("\n🤖 OUTPUT:")
        print(output_text)

        print("\n⏱️ Latency: {:.2f} sec".format(end_time - start_time))

        # Optional: raw response for debugging
        print("\n📦 FULL RESPONSE:")
        print(response)

        return output_text

    except Exception as e:
        print("❌ Error:", str(e))
        return None


if __name__ == "__main__":
    test_prompt_agent(test_input)
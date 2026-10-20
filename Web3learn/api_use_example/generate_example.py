from openai import OpenAI
import time
import json

# Initialize client
client = OpenAI(api_key="")

# Your fine-tuned model
MODEL_ID = "generate model"

# Test input
test_input = {
    "personality": "expressive",
    "level": "beginner",
    "topic": "plutus",
    "query": "Introduction to Plutus Core",
}

def test_model(input_data):
    try:
        start_time = time.time()

        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI tutor that explains topics clearly."
                },
                {
                    "role": "user",
                    "content": json.dumps(input_data)
                }
            ],
            temperature=input_data.get("temperature", 0.5),
            top_p=input_data.get("top_p", 1),
            max_tokens=input_data.get("max_new_tokens", 500)
        )

        end_time = time.time()

        output = response.choices[0].message.content

        print("\n🧾 INPUT:")
        print(json.dumps(input_data, indent=2))

        print("\n🤖 OUTPUT:")
        print(output)

        print("\n⏱️ Latency: {:.2f} seconds".format(end_time - start_time))

        print("\n💰 Token Usage:")
        print(response.usage)

        return output

    except Exception as e:
        print("❌ Error:", str(e))


if __name__ == "__main__":
    test_model(test_input)
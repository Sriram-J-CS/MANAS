import asyncio, os, httpx, dotenv
dotenv.load_dotenv()
key = os.getenv("AI_PROVIDER_API_KEY") or os.getenv("GEMINI_API_KEY")

async def test():
    models = ["gemini-3.8-flash", "gemini-pro-latest", "gemini-flash-latest"]
    for m in models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}"
            payload = {
                "contents": [{"parts": [{"text": 'Respond with JSON: {"status": "ok"}'}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.post(url, json=payload)
                print(m, res.status_code, res.text[:120])
        except Exception as e:
            print(m, "Exception:", type(e).__name__)

if __name__ == "__main__":
    asyncio.run(test())

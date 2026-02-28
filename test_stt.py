import asyncio
import httpx
from app.services.elevenlabs import settings

async def test_elevenlabs_stt():
    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {
        "xi-api-key": settings.elevenlabs_api_key
    }
    
    # create a dummy audio file using gTTS or just some random bytes? No, random bytes will fail.
    # I can just check if it returns 400 Bad Request or 200 OK
    audio_data = b"RIFF$" + b"A"*100  # Fake wav headers
    
    files = {
        "file": ("test.wav", audio_data, "audio/wav")
    }
    data = {
        "model_id": "scribe_v1"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, files=files, data=data)
        print("Status:", resp.status_code)
        print("Response:", resp.text)

if __name__ == "__main__":
    asyncio.run(test_elevenlabs_stt())

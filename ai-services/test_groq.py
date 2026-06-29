import os
from groq import Groq
client = Groq(api_key=os.environ.get('GROQ_API_KEY'))
try:
    r = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role":"user","content":"Say hi in 1 word"}], max_tokens=10)
    print("RESPONSE:", r.choices[0].message.content)
except Exception as e:
    print("ERROR:", type(e).__name__, str(e)[:200])

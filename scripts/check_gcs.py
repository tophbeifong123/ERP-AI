import urllib.request, urllib.error
try:
    req = urllib.request.Request("https://storage.googleapis.com/water-fish-veo-bucket/n8n-tmp/641423115272846316/sample_0.mp4", method="HEAD")
    r = urllib.request.urlopen(req, timeout=10)
    print(f"HTTP {r.status}: {dict(r.headers)[:5]}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.reason}")
    print(f"Headers: {dict(e.headers)[:5]}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")

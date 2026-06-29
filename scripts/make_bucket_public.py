"""
Make the GCS bucket public-read using the service account credentials.
"""
import json
import time
import urllib.request
import urllib.error
import urllib.parse
import base64

KEY_FILE = "/mnt/d/work/ERP-AI/gcp-key.json"
BUCKET = "water-fish-veo-bucket"


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def get_jwt(sa: dict, scopes: list[str]) -> str:
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": sa["client_email"],
        "scope": " ".join(scopes),
        "aud": sa["token_uri"],
        "iat": now,
        "exp": now + 3600,
    }
    h_b64 = b64url(json.dumps(header).encode())
    p_b64 = b64url(json.dumps(payload).encode())
    signing_input = f"{h_b64}.{p_b64}".encode()
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    private_key = serialization.load_pem_private_key(
        sa["private_key"].encode(), password=None
    )
    signature = private_key.sign(
        signing_input, padding.PKCS1v15(), hashes.SHA256()
    )
    sig_b64 = b64url(signature)
    return f"{h_b64}.{p_b64}.{sig_b64}"


def get_access_token(sa: dict, scopes: list[str]) -> str:
    jwt_token = get_jwt(sa, scopes)
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token,
    }).encode()
    req = urllib.request.Request(
        sa["token_uri"],
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["access_token"]


def set_bucket_public(sa: dict, bucket: str):
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    print("1. Getting access token...")
    token = get_access_token(sa, scopes)
    print(f"   Token len: {len(token)}")

    print(f"2. Setting publicAccessPrevention=inherited on {bucket}...")
    pap_url = f"https://storage.googleapis.com/storage/v1/b/{bucket}"
    pap_body = json.dumps({"iamConfiguration": {"publicAccessPrevention": "inherited"}}).encode()
    pap_req = urllib.request.Request(
        pap_url,
        data=pap_body,
        method="PUT",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(pap_req, timeout=30) as r:
            print(f"   PUT iamConfiguration status={r.status}")
    except urllib.error.HTTPError as e:
        print(f"   PUT iamConfiguration error {e.code}: {e.read().decode()[:400]}")
        return False

    print(f"3. Setting bucket {bucket} IAM policy (allUsers = objectViewer)...")
    policy = {
        "bindings": [
            {
                "role": "roles/storage.objectViewer",
                "members": ["allUsers"],
            }
        ]
    }
    url = f"https://storage.googleapis.com/storage/v1/b/{bucket}/iam"
    req = urllib.request.Request(
        url,
        data=json.dumps(policy).encode(),
        method="PUT",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode()
            print(f"   Status: {r.status}")
            print(f"   Body: {body[:300]}")
            return True
    except urllib.error.HTTPError as e:
        print(f"   Error {e.code}: {e.read().decode()[:500]}")
        return False


if __name__ == "__main__":
    with open(KEY_FILE) as f:
        sa = json.load(f)
    print(f"Using SA: {sa['client_email']}")
    print(f"Project: {sa['project_id']}")
    print(f"Bucket: {BUCKET}")
    print()
    ok = set_bucket_public(sa, BUCKET)
    print()
    print("OK" if ok else "FAILED")

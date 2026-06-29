import socket

# Try various addresses
for host in ["host.docker.internal", "172.27.65.121", "host-gateway", "gateway"]:
    try:
        ip = socket.gethostbyname(host)
        print(f"{host} -> {ip}")
    except Exception as e:
        print(f"{host} -> DNS FAIL: {e}")

# Try TCP connect to backend
for host, port in [("host.docker.internal", 3000), ("172.27.65.121", 3000), ("host-gateway", 3000)]:
    s = socket.socket()
    s.settimeout(2)
    r = s.connect_ex((host, port))
    if r == 0:
        print(f"  TCP {host}:{port} -> OK")
    else:
        print(f"  TCP {host}:{port} -> err {r}")
    s.close()

"""Generate a VAPID pair and install it into ignored local env files.

Run from backend/: python scripts/generate_vapid_keys.py
The script intentionally never prints either key.
"""

import base64
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import ec


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _set_values(path: Path, values: dict[str, str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    remaining = dict(values)
    output: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
        if key in remaining:
            output.append(f"{key}={remaining.pop(key)}")
        else:
            output.append(line)
    if remaining:
        if output and output[-1]:
            output.append("")
        output.extend(f"{key}={value}" for key, value in remaining.items())
    path.write_text("\n".join(output) + "\n", encoding="utf-8")


def main() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    frontend_root = backend_root.parent / "frontend"
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_number = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_numbers = private_key.public_key().public_numbers()
    public_point = b"\x04" + public_numbers.x.to_bytes(32, "big") + public_numbers.y.to_bytes(32, "big")
    public_value = _encode(public_point)
    private_value = _encode(private_number)

    _set_values(backend_root / ".env", {
        "WEB_PUSH_VAPID_PUBLIC_KEY": public_value,
        "WEB_PUSH_VAPID_PRIVATE_KEY": private_value,
        "WEB_PUSH_SUBJECT": "mailto:support@example.com",
    })
    _set_values(frontend_root / ".env.local", {
        "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY": public_value,
    })
    print("VAPID credentials generated and installed in ignored local environment files.")


if __name__ == "__main__":
    main()

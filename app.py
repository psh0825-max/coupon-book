from pathlib import Path
import os

from flask import Flask, send_from_directory
from waitress import serve

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR))

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")

@app.route("/healthz")
def healthz():
    return {"ok": True, "app": "coupon-book"}

@app.route("/<path:path>")
def catch_all(path):
    target = (STATIC_DIR / path).resolve()
    if target.is_file() and STATIC_DIR in target.parents:
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, "index.html")

def start():
    port = int(os.environ.get("COUPON_BOOK_PORT", "7789"))
    print(f"[CouponBook] http://127.0.0.1:{port}")
    serve(app, host="0.0.0.0", port=port, threads=4)

if __name__ == "__main__":
    start()

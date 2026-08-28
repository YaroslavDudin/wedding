import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import List
import sqlite3
import json
import base64
import zipfile
import io as bio
import os

app = FastAPI(title="Wedding Photo Gallery API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "wedding.db"

# --- Учётные данные администратора ---
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "23.07.2004Marry"
ADMIN_TOKEN    = "wedding-admin-secret-token-2024"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS wedding_photos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            image_data  TEXT    NOT NULL,
            uploaded_at TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()
    print("[OK] База данных SQLite готова")


@app.on_event("startup")
async def startup():
    init_db()


# --- WebSocket для realtime галереи ---
class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)
        print(f"[+] Подключился гость. Всего: {len(self.connections)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)
        print(f"[-] Гость отключился. Всего: {len(self.connections)}")

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in self.connections:
                self.connections.remove(ws)


manager = ConnectionManager()


# --- Модели ---
class PhotoUpload(BaseModel):
    image_data: str


class LoginCredentials(BaseModel):
    username: str
    password: str


# --- Авторизация ---
@app.post("/login")
def login(credentials: LoginCredentials):
    if credentials.username == ADMIN_USERNAME and credentials.password == ADMIN_PASSWORD:
        return {"success": True, "token": ADMIN_TOKEN}
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


# --- Эндпоинты фото ---
@app.get("/api/status")
def root():
    return {"status": "ok", "message": "Свадебная галерея работает!"}


@app.get("/photos")
def get_photos():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, image_data, uploaded_at FROM wedding_photos ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/photos")
async def upload_photo(photo: PhotoUpload):
    if not photo.image_data.startswith("data:image"):
        raise HTTPException(status_code=400, detail="Неверный формат изображения")

    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO wedding_photos (image_data) VALUES (?) RETURNING id, image_data, uploaded_at",
        (photo.image_data,)
    )
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()

    await manager.broadcast({"type": "new_photo", "photo": row})
    return row


@app.delete("/photos/{photo_id}")
async def delete_photo(photo_id: int):
    conn = get_connection()
    cursor = conn.execute("DELETE FROM wedding_photos WHERE id = ? RETURNING id", (photo_id,))
    deleted = cursor.fetchone()
    conn.commit()
    conn.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Фото не найдено")

    await manager.broadcast({"type": "delete_photo", "photo_id": photo_id})
    return {"status": "deleted", "id": photo_id}


@app.get("/photos/zip")
def download_all_zip(token: str = ""):
    """Скачать все фото одним ZIP-архивом (только для admin)"""
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    conn = get_connection()
    rows = conn.execute(
        "SELECT id, image_data FROM wedding_photos ORDER BY id ASC"
    ).fetchall()
    conn.close()

    zip_buffer = bio.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, row in enumerate(rows, 1):
            img_data = row["image_data"]
            if "," in img_data:
                img_data = img_data.split(",", 1)[1]
            img_bytes = base64.b64decode(img_data)
            zf.writestr(f"wedding_photo_{i:03d}.jpg", img_bytes)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=wedding_photos.zip"}
    )


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# --- Раздача React-билда (должна быть после всех API-маршрутов) ---
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "wedding-app", "dist")

if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index)
else:
    print("[INFO] dist/ не найден — запустите 'npm run build' в wedding-app")


# --- Запуск через python main.py ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)

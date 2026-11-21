import json
import os
import uuid
import hashlib
from typing import Optional, Dict, Any

AUTH_FILE = os.path.join(os.path.dirname(__file__), "..", "users.json")


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


class AuthService:
    def __init__(self):
        self.users: Dict[str, Dict[str, Any]] = {}
        self.sessions: Dict[str, str] = {}  # token -> email
        self._load_users()

    def _load_users(self):
        if os.path.exists(AUTH_FILE):
            try:
                with open(AUTH_FILE, "r", encoding="utf-8") as f:
                    self.users = json.load(f)
            except Exception:
                self.users = {}

        # Default Demo Researcher
        demo_email = "researcher@academic.edu"
        if demo_email not in self.users:
            self.users[demo_email] = {
                "name": "Dr. Alex Sharma",
                "email": demo_email,
                "role": "Lead Researcher & Faculty",
                "department": "Computer Science & AI",
                "password_hash": _hash_pw("demo1234"),
                "avatar": "👨‍🔬"
            }
            self._save_users()

    def _save_users(self):
        try:
            with open(AUTH_FILE, "w", encoding="utf-8") as f:
                json.dump(self.users, f, indent=2)
        except Exception:
            pass

    def register(self, email: str, name: str, password: str, department: str = "Research") -> Dict[str, Any]:
        email_clean = email.lower().strip()
        if not email_clean or "@" not in email_clean:
            raise ValueError("Please provide a valid email address.")
        if len(password) < 4:
            raise ValueError("Password must be at least 4 characters long.")
        if email_clean in self.users:
            raise ValueError("An account with this email already exists.")

        user_data = {
            "name": name.strip() or "Researcher",
            "email": email_clean,
            "role": "Academic Researcher",
            "department": department or "Computer Science",
            "password_hash": _hash_pw(password),
            "avatar": "🎓"
        }
        self.users[email_clean] = user_data
        self._save_users()

        token = str(uuid.uuid4())
        self.sessions[token] = email_clean

        return {
            "token": token,
            "user": {
                "name": user_data["name"],
                "email": user_data["email"],
                "role": user_data["role"],
                "department": user_data["department"],
                "avatar": user_data["avatar"]
            }
        }

    def login(self, email: str, password: str) -> Dict[str, Any]:
        email_clean = email.lower().strip()
        if email_clean not in self.users:
            raise ValueError("No account found with this email.")

        user = self.users[email_clean]
        if user["password_hash"] != _hash_pw(password):
            raise ValueError("Invalid password. Please try again.")

        token = str(uuid.uuid4())
        self.sessions[token] = email_clean

        return {
            "token": token,
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "department": user["department"],
                "avatar": user["avatar"]
            }
        }

    def demo_login(self) -> Dict[str, Any]:
        user = self.users["researcher@academic.edu"]
        token = str(uuid.uuid4())
        self.sessions[token] = user["email"]
        return {
            "token": token,
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "department": user["department"],
                "avatar": user["avatar"]
            }
        }

    def get_current_user(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        if not token or token not in self.sessions:
            return None
        email = self.sessions[token]
        user = self.users.get(email)
        if not user:
            return None
        return {
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "department": user["department"],
            "avatar": user["avatar"]
        }


auth_service = AuthService()

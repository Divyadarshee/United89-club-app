import sys
import os
import unittest
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
import jwt

# Add backend directory to sys.path so imports work cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auth.jwt import create_access_token, create_refresh_token, decode_token
from services.phone_service import normalize_phone
from core.config import SECRET_KEY, ALGORITHM


class TestAuthJWT(unittest.TestCase):
    def test_create_and_decode_access_token_default_role(self):
        """Tokens created without explicit role should have member role and type access"""
        user_id = "9876543210"
        token = create_access_token(user_id=user_id)
        payload = decode_token(token, expected_type="access")
        
        self.assertEqual(payload.get("sub"), user_id)
        self.assertEqual(payload.get("role"), "member")
        self.assertEqual(payload.get("type"), "access")
        self.assertIn("exp", payload)
        self.assertIn("iat", payload)

    def test_create_and_decode_admin_token(self):
        """Designated admin token should have role 'admin'"""
        admin_id = "9437555900"
        token = create_access_token(user_id=admin_id, role="admin")
        payload = decode_token(token, expected_type="access")
        
        self.assertEqual(payload.get("sub"), admin_id)
        self.assertEqual(payload.get("role"), "admin")
        self.assertEqual(payload.get("type"), "access")

    def test_refresh_token_type_enforcement(self):
        """Refresh token must have type 'refresh' and should fail if decoded as 'access'"""
        user_id = "9437555900"
        token = create_refresh_token(user_id=user_id)
        
        # Decoding as refresh should succeed
        payload = decode_token(token, expected_type="refresh")
        self.assertEqual(payload.get("sub"), user_id)
        self.assertEqual(payload.get("type"), "refresh")

        # Decoding as access must fail with 401
        with self.assertRaises(HTTPException) as ctx:
            decode_token(token, expected_type="access")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid token type", ctx.exception.detail)

    def test_expired_token_handling(self):
        """Expired token must raise HTTPException 401"""
        past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        payload = {
            "sub": "9437555900",
            "role": "admin",
            "type": "access",
            "exp": past_time,
            "iat": past_time - timedelta(minutes=15)
        }
        expired_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        with self.assertRaises(HTTPException) as ctx:
            decode_token(expired_token, expected_type="access")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("expired", ctx.exception.detail.lower())

    def test_tampered_token_handling(self):
        """Tampered token with invalid signature must raise HTTPException 401"""
        token = create_access_token("9437555900", role="admin")
        tampered_token = token[:-5] + "ABCDE"
        
        with self.assertRaises(HTTPException) as ctx:
            decode_token(tampered_token, expected_type="access")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_designated_admin_rbac_resolution(self):
        """Only the designated phone (9437555900 in any formatted variation) resolves to admin role"""
        phones = [
            ("+91 94375 55900", True),
            ("9437555900", True),
            ("+919437555900", True),
            ("+91-94375-55900", True),
            ("9876543210", False),
            ("+91 98765 43210", False),
        ]
        for phone_input, is_expected_admin in phones:
            norm = normalize_phone(phone_input)
            role = "admin" if norm == "9437555900" else "member"
            self.assertEqual(
                role == "admin", 
                is_expected_admin, 
                f"Failed for phone: {phone_input} (normalized: {norm})"
            )


if __name__ == '__main__':
    unittest.main()

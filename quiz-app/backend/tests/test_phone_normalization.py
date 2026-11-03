import sys
import os
import unittest

# Add backend directory to sys.path so imports work cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.phone_service import normalize_phone


class TestPhoneNormalization(unittest.TestCase):
    def test_clean_10_digit_phone(self):
        """Standard 10-digit number should remain unchanged"""
        self.assertEqual(normalize_phone("9437555900"), "9437555900")
        self.assertEqual(normalize_phone("9876543210"), "9876543210")

    def test_phone_with_country_code_and_spaces(self):
        """Numbers with +91 and spaces should be stripped to clean 10 digits"""
        self.assertEqual(normalize_phone("+91 94375 55900"), "9437555900")
        self.assertEqual(normalize_phone("+919437555900"), "9437555900")
        self.assertEqual(normalize_phone("+91 98765 43210"), "9876543210")

    def test_phone_with_dashes_and_parentheses(self):
        """Numbers formatted with dashes or parentheses should normalize correctly"""
        self.assertEqual(normalize_phone("+91-94375-55900"), "9437555900")
        self.assertEqual(normalize_phone("(+91) 94375 55900"), "9437555900")
        self.assertEqual(normalize_phone("(943) 755-5900"), "9437555900")

    def test_phone_starting_with_91_prefix_without_plus(self):
        """12-digit Indian number starting with 91 should have 91 stripped"""
        self.assertEqual(normalize_phone("919437555900"), "9437555900")

    def test_admin_phone_identification(self):
        """All variations of the designated admin phone normalize to 9437555900"""
        variations = [
            "9437555900",
            "+91 94375 55900",
            "+919437555900",
            "+91-94375-55900",
            "919437555900",
            "  +91 94375 55900  "
        ]
        for v in variations:
            self.assertEqual(normalize_phone(v), "9437555900", f"Failed for variation: {v}")


if __name__ == '__main__':
    unittest.main()

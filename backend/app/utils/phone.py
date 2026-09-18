import re

def sanitize_phone_number(number: str) -> str:
    """
    Cleans phone numbers to raw digits.
    Removes '+', spaces, hyphens, brackets.
    If 10 digit Indian number without country code, prefixes '91'.
    """
    if not number:
        return ""
    digits = re.sub(r"\D", "", str(number))
    # Handle leading zeros
    digits = digits.lstrip("0")
    # If 10 digits, assume India (+91)
    if len(digits) == 10:
        digits = f"91{digits}"
    return digits

def mask_phone_number(number: str) -> str:
    """
    Masks a phone number for secure logging and display.
    Example: 919876543210 -> +91******3210
    """
    sanitized = sanitize_phone_number(number)
    if len(sanitized) < 4:
        return "***"
    country_prefix = sanitized[:2] if len(sanitized) > 6 else ""
    last_four = sanitized[-4:]
    masked_middle = "*" * (len(sanitized) - len(country_prefix) - len(last_four))
    return f"+{country_prefix}{masked_middle}{last_four}" if country_prefix else f"***{last_four}"

def validate_phone_number(number: str) -> bool:
    """
    Validates phone number length and structure (relaxed validation for global/Indian format).
    """
    sanitized = sanitize_phone_number(number)
    # Most international numbers with country codes are 10 to 15 digits
    return 10 <= len(sanitized) <= 15

import re
from typing import Dict, List, Optional


def infer_template_variable_mappings(
    body_text: Optional[str] = None,
    template_name: Optional[str] = None,
    category: Optional[str] = None
) -> Dict[str, str]:
    """
    Intelligently infers dynamic database field mappings ({Student Name}, {Fees Due}, etc.)
    from the template's body text context, keywords, and name.
    
    Ensures that even if the database is truncated or freshly synced from Meta,
    templates immediately have their variable placeholders mapped to the correct student fields.
    """
    if not body_text:
        return {}

    # Extract all {{1}}, {{2}}, ... placeholders
    placeholders = re.findall(r"\{\{(\d+)\}\}", body_text)
    if not placeholders:
        return {}

    unique_nums = sorted(list(set(placeholders)), key=lambda x: int(x))
    mappings: Dict[str, str] = {}
    
    lower_body = body_text.lower()
    lower_name = (template_name or "").lower()

    # Pre-calculated whole-template context flags
    is_fee_context = any(k in lower_name or k in lower_body for k in [
        "fee", "fees", "due", "dues", "payment", "tuition", "installment", "arrear", "payable", "balance"
    ])
    is_attendance_context = any(k in lower_name or k in lower_body for k in [
        "attendance", "absent", "presence", "leave", "marked"
    ])
    is_announcement_context = any(k in lower_name or k in lower_body for k in [
        "announc", "circular", "notice", "invite", "function", "event", "holiday", "celebrat", "annual"
    ])

    for num in unique_nums:
        placeholder_str = f"{{{{{num}}}}}"
        idx = lower_body.find(placeholder_str)
        
        # Look around the placeholder (50 chars before, 50 chars after)
        start_pos = max(0, idx - 60)
        end_pos = min(len(lower_body), idx + len(placeholder_str) + 60)
        window = lower_body[start_pos:end_pos]
        window_before = lower_body[start_pos:idx]
        window_after = lower_body[idx + len(placeholder_str):end_pos]

        # 1. Fee / Amount checking
        if any(k in window for k in ["fee", "fees", "amount", "balance", "₹", "rs", "inr", "rupees", "payable", "installment", "dues", "due of"]) and not any(k in window for k in ["due date", "by date", "last date", "deadline"]):
            mappings[num] = "{Fees Due}"
            continue

        # 2. Due Date / Deadline checking
        if any(k in window for k in ["due date", "by date", "last date", "deadline", "pay by", "valid till", "on or before", "before date", "till date"]) or (("due on" in window or "by" in window_before) and is_fee_context):
            mappings[num] = "{Due Date}"
            continue

        # 3. Attendance checking
        if any(k in window for k in ["attendance", "absent", "present", "was absent", "is absent", "marked"]):
            mappings[num] = "{Attendance}"
            continue

        # 4. Class / Grade checking
        if any(k in window for k in ["class", "grade", "standard", "std", "section", "sec ", "division", "batch"]):
            mappings[num] = "{Class Name}"
            continue

        # 5. Parent Name checking
        if any(k in window for k in ["parent", "guardian", "father", "mother", "mr.", "mrs.", "mr/mrs", "shri", "smt", "s/o", "d/o", "dear parent"]):
            mappings[num] = "{Parent Name}"
            continue

        # 6. Student Name checking
        if any(k in window for k in ["student", "child", "ward", "kid", "scholar", "roll", "student name", "name of"]):
            mappings[num] = "{Student Name}"
            continue

        # 7. School Name checking
        if any(k in window for k in ["school", "academy", "institute", "vidyalaya", "institution", "principal"]):
            mappings[num] = "{School Name}"
            continue

        # 8. Exam Name / Date
        if any(k in window for k in ["exam", "examination", "test", "assessment"]):
            if any(k in window for k in ["date", "on", "schedule"]):
                mappings[num] = "{Exam Date}"
            else:
                mappings[num] = "{Exam Name}"
            continue

        # Positional Fallbacks
        if num == "1":
            if "dear parent" in lower_body or ("dear" in window_before and ("child" in lower_body or "ward" in lower_body or is_fee_context)):
                mappings[num] = "{Parent Name}"
            elif "dear student" in lower_body or "dear" in window_before:
                mappings[num] = "{Student Name}"
            else:
                mappings[num] = "{Parent Name}" if is_fee_context else "{Student Name}"
        elif num == "2":
            if mappings.get("1") == "{Parent Name}":
                mappings[num] = "{Student Name}"
            elif is_fee_context:
                mappings[num] = "{Fees Due}"
            else:
                mappings[num] = "{Student Name}"
        elif num == "3":
            if is_fee_context:
                mappings[num] = "{Fees Due}" if mappings.get("2") != "{Fees Due}" else "{Due Date}"
            elif is_attendance_context:
                mappings[num] = "{Attendance}"
            else:
                mappings[num] = "{Class Name}"
        elif num == "4":
            if is_fee_context:
                mappings[num] = "{Due Date}"
            else:
                mappings[num] = "{Due Date}"
        else:
            mappings[num] = f"Value {num}"

    return mappings

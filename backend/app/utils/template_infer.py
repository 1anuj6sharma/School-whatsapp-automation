import re
from typing import Dict, Optional


def infer_template_variable_mappings(
    body_text: Optional[str] = None,
    template_name: Optional[str] = None,
    category: Optional[str] = None
) -> Dict[str, str]:
    """
    Extracts placeholders ({{1}}, {{2}}, etc.) and returns straightforward default mappings
    ({"1": "Value 1", "2": "Value 2", etc.}) without auto keyword guessing.
    """
    if not body_text:
        return {}

    placeholders = re.findall(r"\{\{(\d+)\}\}", body_text)
    if not placeholders:
        return {}

    unique_nums = sorted(list(set(placeholders)), key=lambda x: int(x))
    return {num: f"Value {num}" for num in unique_nums}

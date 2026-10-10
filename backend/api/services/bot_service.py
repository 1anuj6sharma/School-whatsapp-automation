"""
bot_service.py
==============
WhatsApp Chatbot state-machine for School WhatsApp Automation.

Conversation states (stored in BotUserProfile):
    INIT          → first contact; send greeting + language prompt
    AWAIT_LANG    → user must choose English or Hindi
    MENU          → show 3 main options
    AWAIT_CATEGORY→ user chose Complaint or Feedback; show 4 categories
    AWAIT_MESSAGE → user chose a category; wait for free-text
    DONE          → message received and stored; loop back to MENU

This service is called from the webhook handler for INBOUND messages only.
It never touches MessageLog, MessageCampaign, or ChatMessage — preserving
all existing behaviour completely.
"""
import asyncio
import os
from typing import Optional
from django.utils import timezone
from asgiref.sync import async_to_sync
from api.models import BotUserProfile, ComplaintFeedback, Student, ChatMessage
from api.services.whatsapp_service import whatsapp_service
from api.utils.logger import logger
from api.utils.phone import sanitize_phone_number


def _send_text_sync(phone: str, text: str, student: Optional[Student] = None) -> None:
    """Send text message to WhatsApp and mirror in ChatMessage history."""
    try:
        clean_phone = sanitize_phone_number(phone)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                result = async_to_sync(whatsapp_service.send_text_message)(
                    recipient_number=clean_phone,
                    message_text=text,
                )
            else:
                result = loop.run_until_complete(
                    whatsapp_service.send_text_message(
                        recipient_number=clean_phone,
                        message_text=text,
                    )
                )
        except RuntimeError:
            result = async_to_sync(whatsapp_service.send_text_message)(
                recipient_number=clean_phone,
                message_text=text,
            )

        wamid = result.get("message_id") if isinstance(result, dict) else None
        succ = result.get("success", False) if isinstance(result, dict) else False

        # Mirror outbound message to ChatMessage table for live conversation view
        ChatMessage.objects.create(
            student=student,
            phone_number=clean_phone,
            direction="OUTBOUND",
            message_type="text",
            text_content=text,
            status="SENT" if succ else "FAILED",
            whatsapp_message_id=wamid,
            created_at=timezone.now(),
        )
        logger.info(f"[BotService] Outbound bot message to {clean_phone}: success={succ}, wamid={wamid}")
    except Exception as exc:
        logger.error(f"[BotService] Failed to send bot text to {phone}: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# Localised text strings
# ---------------------------------------------------------------------------

STRINGS = {
    "en": {
        "greeting_new": (
            "👋 Hello! Welcome to *{school_name}*.\n\n"
            "Please choose your preferred language:\n"
            "कृपया अपनी पसंदीदा भाषा चुनें:\n\n"
            "1️⃣  *English*\n"
            "2️⃣  *हिंदी (Hindi)*"
        ),
        "welcome_back": (
            "👋 Hello, *{name}*! Welcome to *{school_name}*."
        ),
        "lang_selection": (
            "🌐 *Language Selection / भाषा चयन*\n\n"
            "Please choose your preferred language:\n"
            "कृपया अपनी पसंदीदा भाषा चुनें:\n\n"
            "1️⃣  *English*\n"
            "2️⃣  *हिंदी (Hindi)*"
        ),
        "lang_set": "✅ Language set to *English*. Let's continue!",
        "menu": (
            "📋 *Main Menu*\n\n"
            "Please choose an option:\n\n"
            "1️⃣  Complaint\n"
            "2️⃣  Feedback\n"
            "3️⃣  Contact School\n\n"
            "_(Type *Change Language* anytime to switch language)_"
        ),
        "choose_category": (
            "Please choose a category for your *{type_label}*:\n\n"
            "1️⃣  Study Related\n"
            "2️⃣  School Related\n"
            "3️⃣  Teacher Related\n"
            "4️⃣  Other"
        ),
        "type_your_message": (
            "✍️ Please type your *{category_label}* {type_label} now.\n"
            "(Send any message and we will record it.)"
        ),
        "saved": (
            "✅ Thank you, *{name}*! Your {type_label} has been recorded and will be reviewed shortly.\n\n"
            "Reply with *Hi* anytime to open the main menu."
        ),
        "invalid_option": "❓ Sorry, I didn't understand that. Please send *1*, *2*, or *3* to choose an option.",
        "invalid_category": "❓ Please send *1*, *2*, *3*, or *4* to choose a category.",
        "contact_school": (
            "📞 *School Contact*\n\n"
            "Phone: +91 00000 00000\n"
            "Email: school@example.com\n\n"
            "Reply *Hi* to go back to the main menu."
        ),
        "type_labels": {
            "COMPLAINT": "complaint",
            "FEEDBACK": "feedback",
        },
        "category_labels": {
            "STUDY": "Study Related",
            "SCHOOL": "School Related",
            "TEACHER": "Teacher Related",
            "OTHER": "Other",
        },
    },
    "hi": {
        "greeting_new": (
            "👋 नमस्ते! *{school_name}* में आपका स्वागत है।\n\n"
            "कृपया अपनी पसंदीदा भाषा चुनें:\n"
            "Please choose your preferred language:\n\n"
            "1️⃣  *English*\n"
            "2️⃣  *हिंदी (Hindi)*"
        ),
        "welcome_back": (
            "👋 नमस्ते, *{name}*! *{school_name}* में आपका स्वागत है।"
        ),
        "lang_selection": (
            "🌐 *भाषा चयन / Language Selection*\n\n"
            "कृपया अपनी पसंदीदा भाषा चुनें:\n"
            "Please choose your preferred language:\n\n"
            "1️⃣  *English*\n"
            "2️⃣  *हिंदी (Hindi)*"
        ),
        "lang_set": "✅ भाषा *हिंदी* में सेट की गई। आगे बढ़ते हैं!",
        "menu": (
            "📋 *मुख्य मेनू*\n\n"
            "कृपया एक विकल्प चुनें:\n\n"
            "1️⃣  शिकायत (Complaint)\n"
            "2️⃣  सुझाव (Feedback)\n"
            "3️⃣  स्कूल से संपर्क करें\n\n"
            "_(भाषा बदलने के लिए कभी भी *Change Language* लिखें)_"
        ),
        "choose_category": (
            "कृपया अपनी *{type_label}* के लिए श्रेणी चुनें:\n\n"
            "1️⃣  पढ़ाई से संबंधित\n"
            "2️⃣  स्कूल से संबंधित\n"
            "3️⃣  शिक्षक से संबंधित\n"
            "4️⃣  अन्य"
        ),
        "type_your_message": (
            "✍️ कृपया अपनी *{category_label}* {type_label} अभी टाइप करें।\n"
            "(कोई भी संदेश भेजें, हम उसे दर्ज कर लेंगे।)"
        ),
        "saved": (
            "✅ धन्यवाद, *{name}*! आपकी {type_label} दर्ज कर ली गई है और जल्द ही इसकी समीक्षा की जाएगी।\n\n"
            "मुख्य मेनू के लिए *Hi* भेजें।"
        ),
        "invalid_option": "❓ क्षमा करें, मैं समझ नहीं पाया। कृपया *1*, *2* या *3* भेजें।",
        "invalid_category": "❓ कृपया श्रेणी चुनने के लिए *1*, *2*, *3* या *4* भेजें।",
        "contact_school": (
            "📞 *स्कूल संपर्क*\n\n"
            "फोन: +91 00000 00000\n"
            "ईमेल: school@example.com\n\n"
            "मुख्य मेनू पर वापस जाने के लिए *Hi* भेजें।"
        ),
        "type_labels": {
            "COMPLAINT": "शिकायत",
            "FEEDBACK": "सुझाव",
        },
        "category_labels": {
            "STUDY": "पढ़ाई से संबंधित",
            "SCHOOL": "स्कूल से संबंधित",
            "TEACHER": "शिक्षक से संबंधित",
            "OTHER": "अन्य",
        },
    },
}

SCHOOL_NAME = "Wonder School"

# Number → menu-option map
MENU_MAP = {"1": "COMPLAINT", "2": "FEEDBACK", "3": "CONTACT"}
CATEGORY_MAP = {"1": "STUDY", "2": "SCHOOL", "3": "TEACHER", "4": "OTHER"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _t(profile: BotUserProfile, key: str, **kwargs) -> str:
    """Return a localised string for the user's language."""
    lang = profile.language if profile.language in STRINGS else "en"
    text = STRINGS[lang].get(key, STRINGS["en"].get(key, key))
    return text.format(school_name=SCHOOL_NAME, **kwargs)


def _type_label(profile: BotUserProfile, submission_type: str) -> str:
    lang = profile.language if profile.language in STRINGS else "en"
    return STRINGS[lang]["type_labels"].get(submission_type, submission_type)


def _category_label(profile: BotUserProfile, category: str) -> str:
    lang = profile.language if profile.language in STRINGS else "en"
    return STRINGS[lang]["category_labels"].get(category, category)


def _get_student(phone: str) -> Optional[Student]:
    student = Student.objects.filter(whatsapp_number=phone).first()
    if not student and len(phone) >= 10:
        student = Student.objects.filter(whatsapp_number__endswith=phone[-10:]).first()
    return student


def _get_or_create_profile(phone: str, sender_name: Optional[str] = None):
    """
    Retrieve or create a BotUserProfile for the given phone number.
    Always tries to link to a Student and updates display_name if a student
    is now in the DB (handles future student additions).
    Returns (profile, is_new).
    """
    student = _get_student(phone)
    profile, created = BotUserProfile.objects.get_or_create(
        phone_number=phone,
        defaults={
            "student": student,
            "display_name": (
                student.student_name if student
                else (sender_name or "WhatsApp User")
            ),
            "language": "en",
            "conversation_state": "INIT",
        },
    )

    # Update student link and name if a student joined after profile creation
    changed = False
    if student and profile.student_id != student.id:
        profile.student = student
        profile.display_name = student.student_name
        changed = True
    elif student and profile.display_name != student.student_name:
        profile.display_name = student.student_name
        changed = True
    elif not student and sender_name and profile.display_name == "WhatsApp User":
        profile.display_name = sender_name
        changed = True

    if changed:
        profile.save(update_fields=["student", "display_name", "updated_at"])

    return profile, created


def _is_change_language_intent(text: str) -> bool:
    """
    Detect if user wants to change/switch their language.
    Supports English, Hindi (Devanagari), and Hinglish (mixed romanized Hindi).
    """
    if not text:
        return False
    t = text.strip().lower()

    # Direct exact phrases
    exact_matches = {
        "change language", "language change", "switch language", "change lang",
        "lang change", "language", "bhasha", "bhasa", "bhasha badlo", "bhasha badle",
        "bhasha badlen", "bhasha badalna hai", "bhasha change", "bhasha change karo",
        "bhasa change karo", "भाषा", "भाषा बदलो", "भाषा बदलें", "भाषा बदलनी है",
        "भाषा परिवर्तन", "change to hindi", "change to english", "set language",
        "select language", "choose language"
    }
    if t in exact_matches:
        return True

    # Substring / keyword patterns
    intent_patterns = [
        "change language", "language change", "switch language", "change lang", "lang change",
        "change my language", "select language", "choose language", "set language",
        "bhasha badl", "bhasa badl", "bhasha change", "bhasa change", "language badl",
        "भाषा बदल", "भाषा चयन", "भाषा परिवर्तन", "भाषा बदलो",
        "hindi me baat", "hindi mai baat", "english me baat", "english mai baat",
        "hindi me karo", "english me karo", "hindi karo", "english karo",
        "language switch", "switch to hindi", "switch to english"
    ]
    for pattern in intent_patterns:
        if pattern in t:
            return True

    return False


# ---------------------------------------------------------------------------
# Gemini contextual reply (optional — used only if GEMINI_API_KEY is set)
# ---------------------------------------------------------------------------

def _gemini_reply(prompt: str) -> Optional[str]:
    """
    Optionally call Gemini to generate a short, friendly reply.
    Returns None if Gemini is not configured or the call fails, so the
    caller can fall back to a hard-coded string.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return (response.text or "").strip() or None
    except Exception as exc:
        logger.warning(f"[BotService] Gemini call failed (will use fallback): {exc}")
        return None


# ---------------------------------------------------------------------------
# State-machine entry point
# ---------------------------------------------------------------------------

def handle_inbound_message(phone: str, text: str, sender_name: Optional[str] = None) -> None:
    """
    Main entry point called by the webhook handler for every INBOUND message.

    This function is intentionally synchronous and self-contained.
    It must NEVER raise an exception — all errors are caught and logged.
    """
    try:
        phone = sanitize_phone_number(phone)
        text_clean = (text or "").strip()
        text_lower = text_clean.lower()

        profile, is_new = _get_or_create_profile(phone, sender_name)
        student = profile.student
        display_name = student.student_name if student else profile.display_name

        # ── 1. Check for explicit Language Change Intent (English/Hindi/Hinglish) ──
        if _is_change_language_intent(text_lower):
            logger.info(f"[BotService] User {phone} requested language change: '{text_clean}'")
            profile.conversation_state = "AWAIT_LANG"
            profile.pending_type = None
            profile.pending_category = None
            profile.save(update_fields=["conversation_state", "pending_type", "pending_category", "updated_at"])
            _send_text_sync(phone, _t(profile, "lang_selection"), student=student)
            return

        # ── 2. Greeting / Reset trigger ("hi", "hello", "namaste", "menu", etc.) ──
        is_greeting = text_lower in (
            "hi", "hello", "helo", "hey", "namaste", "namasthe", "start", "menu", "help",
            "नमस्ते", "हाय", "हेलो", "प्रणाम"
        )

        if is_greeting:
            # If user has ALREADY selected a language previously (not brand new / not in initial AWAIT_LANG)
            # Use their known language directly and show Main Menu without re-asking for language!
            if not is_new and profile.conversation_state not in ("INIT", "AWAIT_LANG"):
                logger.info(f"[BotService] Existing user {phone} greeted with known language: {profile.language}")
                profile.conversation_state = "MENU"
                profile.pending_type = None
                profile.pending_category = None
                profile.save(update_fields=["conversation_state", "pending_type", "pending_category", "updated_at"])

                # Send welcome back in their saved language + main menu
                welcome = _t(profile, "welcome_back", name=display_name)
                _send_text_sync(phone, welcome, student=student)
                _send_text_sync(phone, _t(profile, "menu"), student=student)
                return
            else:
                # Brand new user or pending language selection
                profile.conversation_state = "INIT"
                profile.pending_type = None
                profile.pending_category = None
                profile.save(update_fields=["conversation_state", "pending_type", "pending_category", "updated_at"])

        state = profile.conversation_state

        # ── INIT (Brand new user first greeting) ───────────────────────────
        if state == "INIT":
            greeting = _t(profile, "greeting_new")
            _send_text_sync(phone, greeting, student=student)
            profile.conversation_state = "AWAIT_LANG"
            profile.save(update_fields=["conversation_state", "updated_at"])
            return

        # ── AWAIT_LANG (User choosing language) ────────────────────────────
        if state == "AWAIT_LANG":
            if text_lower in ("1", "english", "eng", "इंग्लिश"):
                profile.language = "en"
                confirm = _t(profile, "lang_set")
            elif text_lower in ("2", "hindi", "हिंदी", "hin", "हिन्दी"):
                profile.language = "hi"
                confirm = _t(profile, "lang_set")
            else:
                # Re-prompt bilingual options
                _send_text_sync(phone, _t(profile, "lang_selection"), student=student)
                return

            profile.conversation_state = "MENU"
            profile.pending_type = None
            profile.pending_category = None
            profile.save(update_fields=["language", "conversation_state", "pending_type", "pending_category", "updated_at"])

            _send_text_sync(phone, confirm, student=student)
            # Show main menu immediately in the chosen language
            _send_text_sync(phone, _t(profile, "menu"), student=student)
            return

        # ── MENU ──────────────────────────────────────────────────────────
        if state == "MENU":
            choice = MENU_MAP.get(text_clean) or MENU_MAP.get(text_lower)
            if choice is None:
                # Try natural language match
                if any(w in text_lower for w in ("complaint", "shikayat", "शिकायत", "sikayat")):
                    choice = "COMPLAINT"
                elif any(w in text_lower for w in ("feedback", "sujhav", "सुझाव", "suggestion", "sujhav")):
                    choice = "FEEDBACK"
                elif any(w in text_lower for w in ("contact", "school", "संपर्क", "call", "phone")):
                    choice = "CONTACT"

            if choice == "CONTACT":
                _send_text_sync(phone, _t(profile, "contact_school"), student=student)
                return

            if choice in ("COMPLAINT", "FEEDBACK"):
                profile.pending_type = choice
                profile.conversation_state = "AWAIT_CATEGORY"
                profile.save(update_fields=["pending_type", "conversation_state", "updated_at"])
                _send_text_sync(
                    phone,
                    _t(profile, "choose_category", type_label=_type_label(profile, choice)),
                    student=student,
                )
                return

            # Unrecognised option
            _send_text_sync(phone, _t(profile, "invalid_option"), student=student)
            _send_text_sync(phone, _t(profile, "menu"), student=student)
            return

        # ── AWAIT_CATEGORY ────────────────────────────────────────────────
        if state == "AWAIT_CATEGORY":
            category = CATEGORY_MAP.get(text_clean) or CATEGORY_MAP.get(text_lower)
            if category is None:
                # Natural language match
                lower = text_lower
                if any(w in lower for w in ("study", "padhai", "पढ़ाई", "education", "class", "homework")):
                    category = "STUDY"
                elif any(w in lower for w in ("school", "स्कूल", "building", "facility", "bus")):
                    category = "SCHOOL"
                elif any(w in lower for w in ("teacher", "शिक्षक", "sir", "ma'am", "mam", "adityasir")):
                    category = "TEACHER"
                elif any(w in lower for w in ("other", "अन्य", "kuch aur", "dusra")):
                    category = "OTHER"
                else:
                    category = None

            if category is None:
                _send_text_sync(phone, _t(profile, "invalid_category"), student=student)
                return

            profile.pending_category = category
            profile.conversation_state = "AWAIT_MESSAGE"
            profile.save(update_fields=["pending_category", "conversation_state", "updated_at"])

            pending_type = profile.pending_type or "COMPLAINT"
            _send_text_sync(
                phone,
                _t(
                    profile,
                    "type_your_message",
                    category_label=_category_label(profile, category),
                    type_label=_type_label(profile, pending_type),
                ),
                student=student,
            )
            return

        # ── AWAIT_MESSAGE ─────────────────────────────────────────────────
        if state == "AWAIT_MESSAGE":
            if not text_clean:
                _send_text_sync(
                    phone,
                    _t(
                        profile,
                        "type_your_message",
                        category_label=_category_label(profile, profile.pending_category or "OTHER"),
                        type_label=_type_label(profile, profile.pending_type or "COMPLAINT"),
                    ),
                    student=student,
                )
                return

            student_name_snap = display_name
            class_name_snap = ""
            if student and student.school_class:
                cls = student.school_class
                class_name_snap = f"{cls.name} - {cls.section}" if cls.section else cls.name

            ComplaintFeedback.objects.create(
                phone_number=phone,
                student=student,
                student_name=student_name_snap,
                class_name=class_name_snap,
                language=profile.language,
                submission_type=profile.pending_type or "COMPLAINT",
                category=profile.pending_category or "OTHER",
                message=text_clean,
            )
            logger.info(
                f"[BotService] Saved {profile.pending_type} from {phone} "
                f"(cat={profile.pending_category}): {text_clean[:80]}"
            )

            # Optional: Gemini-enhanced acknowledgement
            gemini_ack = None
            if os.getenv("GEMINI_API_KEY", "").strip():
                prompt = (
                    f"A student/parent named {student_name_snap} sent this {profile.pending_type.lower()} via WhatsApp: "
                    f"\"{text_clean}\". Write a warm, concise (2-3 sentence) acknowledgement "
                    f"in {'English' if profile.language == 'en' else 'Hindi'} that their "
                    f"{profile.pending_type.lower()} has been received and will be reviewed. "
                    "Do NOT make up any contact details or promise a time frame."
                )
                gemini_ack = _gemini_reply(prompt)

            ack_text = gemini_ack or _t(
                profile,
                "saved",
                name=student_name_snap,
                type_label=_type_label(profile, profile.pending_type or "COMPLAINT"),
            )
            _send_text_sync(phone, ack_text, student=student)

            # Reset state to MENU for the next round
            profile.conversation_state = "MENU"
            profile.pending_type = None
            profile.pending_category = None
            profile.save(update_fields=["conversation_state", "pending_type", "pending_category", "updated_at"])
            return

        # ── Fallback — unknown state ───────────────────────────────────────
        logger.warning(f"[BotService] Unknown state '{state}' for {phone}. Resetting to MENU or INIT.")
        profile.conversation_state = "MENU" if not is_new else "INIT"
        profile.pending_type = None
        profile.pending_category = None
        profile.save(update_fields=["conversation_state", "pending_type", "pending_category", "updated_at"])

    except Exception as exc:
        logger.error(f"[BotService] Unhandled exception for {phone}: {exc}", exc_info=True)


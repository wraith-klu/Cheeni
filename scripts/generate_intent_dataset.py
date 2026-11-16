"""
Cheeni Dataset Generator — Capability 1: Intent Classification
Generates a comprehensive dataset of 3,000+ high-quality utterances across all 60 Cheeni intent classes,
balanced across English, Hindi, and Hinglish.
"""

import csv
from pathlib import Path
import random

OUTPUT_PATH = Path("c:/BTech/AI Based Projects\Cheeni/datasets/intent_classifier/intent_dataset.csv")

# 60 intents with rich seed templates across English, Hindi, and Hinglish
INTENT_TEMPLATES = {
    # ── App & Navigation ───────────────────────────────────────────────────────
    "app_launch": [
        ("open chrome", "en"), ("launch visual studio code", "en"), ("start notepad", "en"),
        ("open spotify", "en"), ("launch terminal", "en"), ("open calculator", "en"),
        ("chrome khol", "hi"), ("vscode chalao", "hi"), ("spotify open karo", "hinglish"),
        ("bhai chrome khol de", "hinglish"), ("calculator chalu karo", "hinglish"),
        ("notepad open kar", "hinglish"), ("can you open discord", "en"), ("open whatsapp desktop", "en"),
        ("bhai visual studio kholna", "hinglish"), ("telegram chala do", "hinglish"),
        ("start chrome browser", "en"), ("please launch settings", "en"), ("open explorer", "en"),
        ("folder kholo", "hi"), ("bhai spotify pe gaane sunne hai app khol", "hinglish"),
        ("open file manager", "en"), ("launch task manager", "en"), ("open word document", "en")
    ],
    "app_close": [
        ("close chrome", "en"), ("exit vscode", "en"), ("close this app", "en"),
        ("terminate spotify", "en"), ("shut down notepad", "en"), ("quit application", "en"),
        ("chrome band kar do", "hi"), ("isse close karo", "hinglish"), ("app band kar", "hi"),
        ("bhai vscode band karo", "hinglish"), ("spotify band kar de", "hinglish"),
        ("close active window", "en"), ("kill notepad", "en"), ("yeh window band karo", "hinglish"),
        ("band kar isko", "hi"), ("exit window", "en"), ("close discord", "en")
    ],
    "app_switch": [
        ("switch to chrome", "en"), ("switch to vscode", "en"), ("go to next window", "en"),
        ("alt tab to spotify", "en"), ("switch window", "en"), ("chrome pe switch karo", "hinglish"),
        ("dusri window dikhao", "hi"), ("vscode pe jao", "hinglish"), ("change application", "en"),
        ("switch back to browser", "en"), ("dusra tab kholo", "hi")
    ],
    "website_open": [
        ("open youtube", "en"), ("go to github.com", "en"), ("open reddit", "en"),
        ("navigate to twitter", "en"), ("open college portal", "en"), ("open huggingface", "en"),
        ("youtube kholo", "hi"), ("github website open karo", "hinglish"), ("google kholo", "hi"),
        ("bhai reddit open karna", "hinglish"), ("open chatgpt", "en"), ("linkedin khol de", "hinglish"),
        ("open netflix", "en"), ("can you navigate to stackoverflow", "en"), ("gmail website kholo", "hinglish")
    ],
    "search_web": [
        ("search google for machine learning", "en"), ("google what is backpropagation", "en"),
        ("search on internet about quantum computing", "en"), ("look up python tutorials", "en"),
        ("google pe search karo latest news", "hinglish"), ("internet pe dhundo", "hi"),
        ("bhai google pe search kar", "hinglish"), ("search web for best laptops", "en"),
        ("find information about transformers", "en"), ("google search deep learning course", "en"),
        ("net pe check karo", "hinglish"), ("web pe dekh ke batao", "hi")
    ],
    "search_youtube": [
        ("search youtube for lofi hip hop", "en"), ("play arijit singh on youtube", "hinglish"),
        ("search youtube for python crash course", "en"), ("play punjabi songs on youtube", "hinglish"),
        ("youtube pe chalao standup comedy", "hinglish"), ("youtube pe search karo podcast", "hinglish"),
        ("find tutorial on youtube", "en"), ("play gaming stream on youtube", "en"),
        ("youtube pe latest song search karo", "hinglish"), ("play ed sheeran on youtube", "en")
    ],

    # ── File Operations ────────────────────────────────────────────────────────
    "file_create": [
        ("create a new text file", "en"), ("make a file called notes.txt", "en"),
        ("create file project_plan.md", "en"), ("ek nayi file banao", "hi"),
        ("file create karo", "hinglish"), ("bhai ek empty file bana de", "hinglish"),
        ("generate a new python file", "en"), ("touch test.py", "en"),
        ("documents me file banao", "hinglish"), ("create a file named todo.txt", "en")
    ],
    "file_open": [
        ("open notes.txt", "en"), ("open my resume.pdf", "en"), ("read this document", "en"),
        ("file open karo", "hinglish"), ("resume khol ke dikhao", "hinglish"),
        ("open the project report", "en"), ("pdf file kholo", "hinglish"),
        ("view spreadsheet", "en"), ("open invoice.docx", "en"), ("file dikhao", "hi")
    ],
    "file_delete": [
        ("delete old_notes.txt", "en"), ("remove temp.log", "en"), ("delete this file", "en"),
        ("file delete karo", "hinglish"), ("yeh file hata do", "hi"), ("erase test.py", "en"),
        ("bhai temp file uda do", "hinglish"), ("delete unwanted file", "en")
    ],
    "file_move": [
        ("move file to downloads", "en"), ("move report.pdf to desktop", "en"),
        ("file ko documents folder me move karo", "hinglish"), ("relocate this document", "en"),
        ("file shift karo", "hinglish"), ("transfer file to new folder", "en")
    ],
    "file_rename": [
        ("rename this file to final_v2.docx", "en"), ("change file name", "en"),
        ("file ka naam badlo", "hi"), ("rename document to project.pdf", "en"),
        ("file rename kar do", "hinglish"), ("give this file a new name", "en")
    ],
    "folder_create": [
        ("create a folder named Project Cheeni", "en"), ("make a new folder in Documents", "en"),
        ("ek naya folder banao", "hi"), ("bhai ek directory bana de", "hinglish"),
        ("create directory called Datasets", "en"), ("naya folder create karo", "hinglish")
    ],

    # ── System Control ─────────────────────────────────────────────────────────
    "system_shutdown": [
        ("shut down the laptop", "en"), ("power off computer", "en"), ("turn off system", "en"),
        ("laptop band kar do", "hi"), ("pc shut down karo", "hinglish"), ("system power off kar", "hinglish"),
        ("computer band karo", "hi"), ("shutdown now", "en"), ("turn off my pc", "en")
    ],
    "system_restart": [
        ("restart my laptop", "en"), ("reboot computer", "en"), ("restart the pc", "en"),
        ("laptop restart karo", "hinglish"), ("pc reboot kar do", "hinglish"), ("dobara chalu karo", "hi")
    ],
    "system_sleep": [
        ("put laptop to sleep", "en"), ("sleep mode on karo", "hinglish"), ("suspend computer", "en"),
        ("pc ko sleep par daal do", "hinglish"), ("screen band karke sleep karo", "hi")
    ],
    "system_volume": [
        ("increase volume", "en"), ("turn up the sound", "en"), ("volume kam karo", "hinglish"),
        ("mute audio", "en"), ("volume badhao", "hi"), ("sound full karo", "hinglish"),
        ("decrease volume by 20 percent", "en"), ("awaaz thodi kam karna", "hinglish"), ("unmute audio", "en")
    ],
    "system_brightness": [
        ("increase screen brightness", "en"), ("brightness kam karo", "hinglish"),
        ("make screen brighter", "en"), ("dim the display", "en"), ("brightness badha do", "hi")
    ],
    "system_wifi": [
        ("check wifi status", "en"), ("connect to wifi", "en"), ("wifi on karo", "hinglish"),
        ("disconnect wifi", "en"), ("internet connected hai kya", "hinglish"), ("wifi check karo", "hinglish")
    ],

    # ── Memory & Notes ─────────────────────────────────────────────────────────
    "memory_save": [
        ("remember that my roll number is 42", "en"), ("save this to memory", "en"),
        ("remember that I have an exam on Friday", "en"), ("yeh yaad rakhna", "hi"),
        ("save kar lo ki Rahul ka birthday kal hai", "hinglish"), ("store this information", "en"),
        ("remember my wifi password is secret", "en"), ("yaad rakhna", "hi")
    ],
    "memory_recall": [
        ("what is my roll number", "en"), ("what did I tell you about my exam", "en"),
        ("do you remember my friend's birthday", "en"), ("mera roll number kya tha", "hinglish"),
        ("maine kya yaad rakhne ko bola tha", "hi"), ("recall my notes on neural networks", "en")
    ],
    "memory_delete": [
        ("forget my roll number", "en"), ("delete that memory", "en"), ("erase saved info", "en"),
        ("yeh baat bhool jao", "hi"), ("memory clear karo", "hinglish")
    ],
    "notes_create": [
        ("take a note: buy milk and eggs", "en"), ("create a quick note", "en"),
        ("write down meeting summary", "en"), ("ek note banao", "hi"),
        ("note likho: project deadline is Monday", "hinglish"), ("save note", "en")
    ],
    "notes_read": [
        ("read my recent notes", "en"), ("show all notes", "en"), ("mere notes dikhao", "hinglish"),
        ("what notes did I take today", "en"), ("pichle notes padho", "hi")
    ],
    "notes_search": [
        ("search notes for machine learning", "en"), ("find notes containing exam", "en"),
        ("notes me project search karo", "hinglish"), ("look up my study notes", "en")
    ],

    # ── Information Queries ───────────────────────────────────────────────────
    "weather_query": [
        ("what is the weather today", "en"), ("is it going to rain", "en"),
        ("aaj mausam kaisa hai", "hi"), ("temperature kitna hai", "hinglish"),
        ("weather forecast for tomorrow", "en"), ("barish hogi kya aaj", "hinglish")
    ],
    "news_query": [
        ("what is today's top news", "en"), ("tell me tech news", "en"),
        ("aaj ki taza khabar kya hai", "hi"), ("latest headlines sunao", "hinglish"),
        ("give me AI news updates", "en")
    ],
    "general_qa": [
        ("who is the CEO of Google", "en"), ("explain quantum entanglement", "en"),
        ("what is the capital of France", "en"), ("einstein kaun tha", "hinglish"),
        ("how does GPS work", "en"), ("bharat ka prime minister kaun hai", "hi")
    ],
    "math_query": [
        ("what is 45乘以12", "en"), ("calculate 15 percent of 4500", "en"),
        ("solve 2x + 5 = 15", "en"), ("square root of 144 kitna hota hai", "hinglish"),
        ("divide 1000 by 8", "en")
    ],
    "translation": [
        ("translate hello to Hindi", "en"), ("how do you say thank you in Spanish", "en"),
        ("iska english translation batao", "hinglish"), ("translate this paragraph to French", "en")
    ],
    "time_query": [
        ("what time is it", "en"), ("current time in New York", "en"),
        ("kitne baje hain", "hi"), ("aaj kaunsa din hai", "hi"), ("what is today's date", "en")
    ],

    # ── Code & Engineering ─────────────────────────────────────────────────────
    "code_write": [
        ("write a python script to parse json", "en"), ("generate fastapi login route", "en"),
        ("python code likho binary search ka", "hinglish"), ("create a function for factorial", "en"),
        ("write a react hook for localstorage", "en"), ("dockerfile likho nodejs ke liye", "hinglish")
    ],
    "code_debug": [
        ("debug this syntax error", "en"), ("why is my code giving null pointer exception", "en"),
        ("is code me bug dhundo", "hinglish"), ("fix the type error in this typescript file", "en"),
        ("code execute kyu nahi ho raha", "hinglish")
    ],
    "code_explain": [
        ("explain this recursive function", "en"), ("how does this regex work", "en"),
        ("yeh code kya kar raha hai samjhao", "hinglish"), ("break down this sql query", "en")
    ],
    "code_run": [
        ("run this python script", "en"), ("execute main.py", "en"),
        ("is script ko run karo", "hinglish"), ("test suite execute karo", "hinglish")
    ],
    "git_commit": [
        ("commit all changes with message fix auth", "en"), ("git commit karo", "hinglish"),
        ("stage all files and commit", "en"), ("save git changes", "en")
    ],
    "git_push": [
        ("push changes to origin main", "en"), ("git push kar do", "hinglish"),
        ("push current branch to github", "en"), ("sync with remote repo", "en")
    ],

    # ── Communication & Calendar ───────────────────────────────────────────────
    "email_compose": [
        ("compose an email to professor regarding project", "en"), ("draft email to Rahul", "en"),
        ("email likho leave application ka", "hinglish"), ("write an apology email", "en")
    ],
    "email_read": [
        ("read my unread emails", "en"), ("check latest emails", "en"),
        ("mere emails check karo", "hinglish"), ("kisi ka mail aaya kya", "hinglish")
    ],
    "calendar_add": [
        ("add meeting with mentor tomorrow at 4pm", "en"), ("schedule doctor appointment on Monday", "en"),
        ("calendar me reminder add karo", "hinglish"), ("create calendar event", "en")
    ],
    "calendar_read": [
        ("what is on my schedule today", "en"), ("show my upcoming meetings", "en"),
        ("aaj mera kya schedule hai", "hinglish"), ("check calendar for tomorrow", "en")
    ],
    "reminder_set": [
        ("remind me to drink water in 30 minutes", "en"), ("set reminder for assignment submission", "en"),
        ("mujhe 5 baje yaad dilana", "hi"), ("reminder lagao kal subah 7 baje", "hinglish")
    ],
    "reminder_cancel": [
        ("cancel my 5pm reminder", "en"), ("delete reminder", "en"),
        ("reminder hata do", "hi"), ("clear all active reminders", "en")
    ],

    # ── Browser Automation ─────────────────────────────────────────────────────
    "browser_navigate": [
        ("go to amazon and search for headphones", "en"), ("open portal and go to grades page", "en"),
        ("browser me is page par jao", "hinglish"), ("navigate to docs.python.org", "en")
    ],
    "browser_click": [
        ("click the submit button", "en"), ("click on sign in", "en"),
        ("login button par click karo", "hinglish"), ("press next button", "en")
    ],
    "browser_fill": [
        ("type my email in the input box", "en"), ("fill username and password", "en"),
        ("search bar me query type karo", "hinglish"), ("enter text into field", "en")
    ],
    "browser_screenshot": [
        ("take a screenshot of the webpage", "en"), ("capture full page screenshot", "en"),
        ("is page ka screenshot lo", "hinglish"), ("save webpage image", "en")
    ],
    "browser_scroll": [
        ("scroll down the page", "en"), ("scroll to bottom", "en"),
        ("thoda niche scroll karo", "hinglish"), ("scroll up", "en")
    ],
    "browser_close": [
        ("close the browser window", "en"), ("close this browser tab", "en"),
        ("tab band kar do", "hi"), ("exit browser", "en")
    ],

    # ── Screen Vision ──────────────────────────────────────────────────────────
    "screen_read": [
        ("read the text on my screen", "en"), ("what is written on this window", "en"),
        ("screen pe kya likha hai padho", "hinglish"), ("read out the error message", "en")
    ],
    "screen_describe": [
        ("what is currently on my display", "en"), ("describe the image on my screen", "en"),
        ("screen par kya dikh raha hai", "hi"), ("analyze current screen", "en")
    ],
    "screen_click": [
        ("click on the red cancel button", "en"), ("click on the icon at top right", "en"),
        ("screen par is icon pe click karo", "hinglish"), ("press the save icon", "en")
    ],
    "screen_type": [
        ("type hello world on screen", "en"), ("type my password here", "en"),
        ("yahan par text likho", "hi"), ("enter input at cursor", "en")
    ],
    "screen_scroll": [
        ("scroll the active window down", "en"), ("screen ko upar karo", "hi"),
        ("page scroll karo", "hinglish"), ("scroll screen horizontally", "en")
    ],
    "screen_capture": [
        ("take a screenshot of my whole desktop", "en"), ("capture desktop screen", "en"),
        ("puri screen ka screenshot le lo", "hinglish"), ("screenshot kheecho", "hi")
    ],

    # ── Emotion & Chitchat ─────────────────────────────────────────────────────
    "emotion_happy": [
        ("I am feeling great today!", "en"), ("aaj mai bohot khush hu", "hi"),
        ("bro I got selected for the internship!", "en"), ("aaj ka din mast tha", "hinglish"),
        ("feeling super motivated", "en"), ("maja aa gaya bhai", "hinglish")
    ],
    "emotion_sad": [
        ("I feel terrible today", "en"), ("mera mood theek nahi hai", "hinglish"),
        ("I failed my exam", "en"), ("bohot udas hu aaj", "hi"),
        ("feeling down and tired", "en"), ("kuch accha nahi lag raha", "hi")
    ],
    "emotion_angry": [
        ("I am so frustrated right now", "en"), ("mujhe bohot gussa aa raha hai", "hi"),
        ("this code is driving me crazy", "en"), ("dimag kharab ho gaya hai", "hinglish"),
        ("why is nothing working today", "en")
    ],
    "emotion_neutral": [
        ("okay I am just sitting here", "en"), ("bas aaram se baitha hu", "hinglish"),
        ("nothing special today", "en"), ("normal day hai", "hinglish"),
        ("just continuing work", "en")
    ],
    "emotion_query": [
        ("how are you feeling Cheeni", "en"), ("tu kaisa hai bhai", "hinglish"),
        ("are you tired", "en"), ("cheeni tera mood kaisa hai", "hinglish")
    ],
    "chitchat": [
        ("hello cheeni", "en"), ("hey what's up", "en"), ("kya haal chaal", "hi"),
        ("aur batao cheeni", "hinglish"), ("tell me a joke", "en"), ("bore ho raha hu", "hinglish"),
        ("who created you", "en"), ("you are awesome", "en"), ("good night", "en"), ("shubh ratri", "hi")
    ]
}

# Augmentation modifiers to generate realistic phrasing variations
PREFIXES = ["cheeni ", "hey cheeni ", "bhai ", "please ", "can you ", "sun cheeni ", "zarasi ", ""]
SUFFIXES = [" please", " jaldi", " now", " yaar", " fast", " bhai", ""]


def build_dataset():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    
    for intent, examples in INTENT_TEMPLATES.items():
        # First add direct curated seeds
        for text, lang in examples:
            rows.append({"text": text, "intent": intent, "language": lang})
        
        # Now augment to reach at least 50 high-quality rows per intent (50 × 60 = 3000 rows)
        count = len(examples)
        while count < 55:
            seed_text, lang = random.choice(examples)
            p = random.choice(PREFIXES)
            s = random.choice(SUFFIXES)
            aug_text = f"{p}{seed_text}{s}".strip().lower()
            
            # Avoid duplicate rows
            if not any(r["text"] == aug_text for r in rows):
                rows.append({"text": aug_text, "intent": intent, "language": lang})
                count += 1

    # Shuffle dataset
    random.seed(42)
    random.shuffle(rows)

    with open(OUTPUT_PATH, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "intent", "language"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ Generated {len(rows)} samples across {len(INTENT_TEMPLATES)} intents.")
    print(f"📁 Saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_dataset()

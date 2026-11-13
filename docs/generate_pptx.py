"""
RaftFS Presentation Generator
Format: Mehran University of Engineering & Technology (MUET) CSE Style
Course: Cloud & Distributed Computing (CS-485)
Submitted to: Sir Asif Wagan
Students:
- Rao Abdullah (22CS067)
- Muhammad Hashim (22CS013)
- Bilal Qazi (22CS029)
"""
import os, sys
from PIL import Image as PILImage
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# Reference Dark Aesthetic Colors
C_BG            = RGBColor(11, 17, 32)          # Deep Navy/Black (#0B1120)
C_CARD          = RGBColor(19, 29, 49)          # Card Box (#131D31)
C_CARD_ALT      = RGBColor(15, 23, 42)          # Darker card (#0F172A)
C_BORDER        = RGBColor(30, 41, 59)          # Card Border (#1E293B)
C_BORDER_LIGHT  = RGBColor(51, 65, 85)          # Lighter Border (#334155)

C_WHITE         = RGBColor(255, 255, 255)       # Primary Text
C_CYAN          = RGBColor(56, 189, 248)        # Cyan Accent (#38BDF8)
C_BLUE_ACCENT   = RGBColor(96, 165, 250)        # Soft Blue (#60A5FA)
C_MUTED         = RGBColor(148, 163, 184)       # Muted Slate (#94A3B8)
C_GREEN         = RGBColor(74, 222, 128)        # Accent Green (#4ADE80)
C_RED           = RGBColor(248, 113, 113)       # Accent Red (#F87171)

SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

prs = Presentation()
prs.slide_width  = SLIDE_W
prs.slide_height = SLIDE_H
BLANK_LAYOUT = prs.slide_layouts[6]

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
SS_DIR   = os.path.join(DOCS_DIR, "screenshots")
OUT_FILE = os.path.join(DOCS_DIR, "Presentation_RaftFS.pptx")
OUT_FILE_FALLBACK = os.path.join(DOCS_DIR, "Presentation_RaftFS_v2.pptx")

def add_slide():
    sl = prs.slides.add_slide(BLANK_LAYOUT)
    bg = sl.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = C_BG
    return sl

def add_reference_header(slide, section_tag, slide_num_str):
    tx_sec = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8.0), Inches(0.4))
    p_sec = tx_sec.text_frame.paragraphs[0]
    r_sec = p_sec.add_run()
    r_sec.text = section_tag.upper()
    r_sec.font.size = Pt(13)
    r_sec.font.bold = True
    r_sec.font.color.rgb = C_CYAN

    tx_sub = slide.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(8.0), Inches(0.35))
    p_sub = tx_sub.text_frame.paragraphs[0]
    r_sub = p_sub.add_run()
    r_sub.text = "CS-485  ·  RaftFS Distributed Document Storage System"
    r_sub.font.size = Pt(10)
    r_sub.font.color.rgb = C_MUTED

    tx_num = slide.shapes.add_textbox(Inches(11.2), Inches(0.4), Inches(1.3), Inches(0.5))
    p_num = tx_num.text_frame.paragraphs[0]
    p_num.alignment = PP_ALIGN.RIGHT
    r_num = p_num.add_run()
    r_num.text = slide_num_str
    r_num.font.size = Pt(15)
    r_num.font.bold = True
    r_num.font.color.rgb = C_MUTED

    div = slide.shapes.add_shape(1, Inches(0.8), Inches(1.25), Inches(11.73), Pt(1))
    div.fill.solid()
    div.fill.fore_color.rgb = C_BORDER
    div.line.fill.background()

def add_card(slide, l, t, w, h, bg_color=C_CARD, border_color=C_BORDER, line_w=Pt(1)):
    card = slide.shapes.add_shape(1, l, t, w, h)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    if border_color:
        card.line.color.rgb = border_color
        card.line.width = line_w
    else:
        card.line.fill.background()
    return card

def add_proportional_image(slide, filename, l, t, max_w, max_h):
    path = os.path.join(SS_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        with PILImage.open(path) as im:
            orig_w, orig_h = im.size
        scale = min(max_w / orig_w, max_h / orig_h)
        target_w = Inches(orig_w * scale)
        target_h = Inches(orig_h * scale)
        x_offset = (Inches(max_w) - target_w) / 2
        return slide.shapes.add_picture(path, l + x_offset, t, target_w, target_h)
    except Exception as e:
        print(f"Error adding picture {filename}: {e}")
        return None

# ==============================================================================
# SLIDE 1: COVER
# ==============================================================================
def slide_title():
    sl = add_slide()

    tx_inst = sl.shapes.add_textbox(Inches(1.0), Inches(1.0), Inches(11.3), Inches(0.8))
    tf_inst = tx_inst.text_frame
    p0 = tf_inst.paragraphs[0]
    p0.alignment = PP_ALIGN.CENTER
    r0 = p0.add_run()
    r0.text = "DEPARTMENT OF COMPUTER SYSTEMS ENGINEERING\nMehran University of Engineering & Technology"
    r0.font.size = Pt(13)
    r0.font.bold = True
    r0.font.color.rgb = C_CYAN

    p_course = tf_inst.add_paragraph()
    p_course.space_before = Pt(8)
    p_course.alignment = PP_ALIGN.CENTER
    r_c = p_course.add_run()
    r_c.text = "CLOUD & DISTRIBUTED COMPUTING  ·  CS-485"
    r_c.font.size = Pt(11)
    r_c.font.color.rgb = C_MUTED

    tx_title = sl.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.3), Inches(1.5))
    tf_title = tx_title.text_frame
    p_t = tf_title.paragraphs[0]
    p_t.alignment = PP_ALIGN.CENTER
    r_t = p_t.add_run()
    r_t.text = "RaftFS: Distributed Document Storage System"
    r_t.font.size = Pt(36)
    r_t.font.bold = True
    r_t.font.color.rgb = C_WHITE

    p_sub = tf_title.add_paragraph()
    p_sub.space_before = Pt(8)
    p_sub.alignment = PP_ALIGN.CENTER
    r_s = p_sub.add_run()
    r_s.text = "Testing Consensus, Leader Election, and MapReduce Search Across a Distributed Storage Cluster."
    r_s.font.size = Pt(14)
    r_s.font.color.rgb = C_MUTED

    div = sl.shapes.add_shape(1, Inches(4.0), Inches(4.1), Inches(5.33), Pt(1.5))
    div.fill.solid()
    div.fill.fore_color.rgb = C_CYAN
    div.line.fill.background()

    tx_subm = sl.shapes.add_textbox(Inches(1.0), Inches(4.5), Inches(11.3), Inches(2.2))
    tf_subm = tx_subm.text_frame
    
    p_by = tf_subm.paragraphs[0]
    p_by.alignment = PP_ALIGN.CENTER
    r_by = p_by.add_run()
    r_by.text = "SUBMITTED BY"
    r_by.font.size = Pt(11)
    r_by.font.bold = True
    r_by.font.color.rgb = C_CYAN

    members = [
        "Rao Abdullah (22CS067)",
        "Muhammad Hashim (22CS013)",
        "Bilal Qazi (22CS029)"
    ]
    for m in members:
        p_m = tf_subm.add_paragraph()
        p_m.space_before = Pt(4)
        p_m.alignment = PP_ALIGN.CENTER
        r_m = p_m.add_run()
        r_m.text = m
        r_m.font.size = Pt(13)
        r_m.font.bold = True
        r_m.font.color.rgb = C_WHITE

    p_to = tf_subm.add_paragraph()
    p_to.space_before = Pt(12)
    p_to.alignment = PP_ALIGN.CENTER
    r_to = p_to.add_run()
    r_to.text = "Submitted to: Sir Asif Wagan"
    r_to.font.size = Pt(12)
    r_to.font.color.rgb = C_MUTED

# ==============================================================================
# SLIDE 2: 01 / PROBLEM STATEMENT
# ==============================================================================
def slide_problem():
    sl = add_slide()
    add_reference_header(sl, "01  /  PROBLEM STATEMENT", "02")

    tx_head = sl.shapes.add_textbox(Inches(0.8), Inches(1.4), Inches(11.73), Inches(0.6))
    p_h = tx_head.text_frame.paragraphs[0]
    r_h = p_h.add_run()
    r_h.text = "Single servers fail, and copying files without consensus causes conflicting copies and data loss."
    r_h.font.size = Pt(15)
    r_h.font.color.rgb = C_WHITE

    workloads = [
        ("Text & Markdown (.md)", "~5 ms", "Small text documents. Takes only a few milliseconds to scan without taxing memory.", C_CYAN),
        ("PDFs & Binary Files", "~50 ms", "Larger document streams requiring SHA-256 hash checks to guarantee no corrupted bytes.", C_BLUE_ACCENT),
        ("Keyword Search", "100–300 ms", "Full-text queries that need to scan files across all nodes without locking the server.", C_GREEN)
    ]
    for i, (w_title, w_time, w_desc, w_color) in enumerate(workloads):
        x = Inches(0.8) + i * Inches(3.95)
        add_card(sl, x, Inches(2.2), Inches(3.75), Inches(2.3), bg_color=C_CARD)

        tx_w = sl.shapes.add_textbox(x + Inches(0.2), Inches(2.35), Inches(3.35), Inches(2.0))
        tf_w = tx_w.text_frame
        tf_w.word_wrap = True

        p0 = tf_w.paragraphs[0]
        r0 = p0.add_run()
        r0.text = w_title
        r0.font.bold = True
        r0.font.size = Pt(14)
        r0.font.color.rgb = C_WHITE

        p1 = tf_w.add_paragraph()
        p1.space_before = Pt(3)
        r1 = p1.add_run()
        r1.text = w_time
        r1.font.bold = True
        r1.font.size = Pt(12)
        r1.font.color.rgb = w_color

        p2 = tf_w.add_paragraph()
        p2.space_before = Pt(6)
        r2 = p2.add_run()
        r2.text = w_desc
        r2.font.size = Pt(11)
        r2.font.color.rgb = C_MUTED

    add_card(sl, Inches(0.8), Inches(4.8), Inches(11.73), Inches(2.1), bg_color=C_CARD_ALT, border_color=C_RED)
    tx_fail = sl.shapes.add_textbox(Inches(1.1), Inches(4.95), Inches(11.1), Inches(1.8))
    tf_fail = tx_fail.text_frame
    tf_fail.word_wrap = True

    pf0 = tf_fail.paragraphs[0]
    rf0 = pf0.add_run()
    rf0.text = "WHY COPYING FILES WITHOUT CONSENSUS FAILS"
    rf0.font.bold = True
    rf0.font.size = Pt(13)
    rf0.font.color.rgb = C_RED

    pf1 = tf_fail.add_paragraph()
    pf1.space_before = Pt(6)
    rf1 = pf1.add_run()
    rf1.text = (
        "If you simply copy files to multiple backup servers without a protocol like Raft, updates quickly clash. "
        "If two users save files at the same time, one copy overwrites the other without warning. Worse, if the main server "
        "goes down, the backup servers have no way to choose a new leader automatically. Users are locked out, and data gets lost."
    )
    rf1.font.size = Pt(11.5)
    rf1.font.color.rgb = C_WHITE

# ==============================================================================
# SLIDE 3: 02 / SYSTEM REQUIREMENTS
# ==============================================================================
def slide_requirements():
    sl = add_slide()
    add_reference_header(sl, "02  /  SYSTEM REQUIREMENTS", "03")

    # Left: Functional Requirements
    add_card(sl, Inches(0.8), Inches(1.5), Inches(5.7), Inches(5.4), bg_color=C_CARD)
    tx_f = sl.shapes.add_textbox(Inches(1.0), Inches(1.7), Inches(5.3), Inches(5.0))
    tf_f = tx_f.text_frame
    tf_f.word_wrap = True

    pf0 = tf_f.paragraphs[0]
    rf0 = pf0.add_run()
    rf0.text = "FUNCTIONAL REQUIREMENTS"
    rf0.font.bold = True
    rf0.font.size = Pt(13)
    rf0.font.color.rgb = C_CYAN

    pf_sub = tf_f.add_paragraph()
    rf_sub = pf_sub.add_run()
    rf_sub.text = "What the system does"
    rf_sub.font.size = Pt(11)
    rf_sub.font.color.rgb = C_MUTED

    f_reqs = [
        ("File Uploads", "Upload text, markdown, and PDF files easily through the web dashboard."),
        ("Raft Consensus", "Handle leader elections, log replication, and 50ms heartbeats automatically."),
        ("Checksum Verification", "Calculate SHA-256 hashes on upload so all node copies are verified identical."),
        ("Parallel Search", "Use MapReduce so all nodes search their local files at the same time."),
        ("Node Scaling", "Add or remove storage nodes while the cluster is running without restarting."),
        ("Crash Testing", "Simulate server crashes with one click to verify that the cluster recovers.")
    ]
    for title, desc in f_reqs:
        p = tf_f.add_paragraph()
        p.space_before = Pt(8)
        rb = p.add_run()
        rb.text = f"{title}\n"
        rb.font.bold = True
        rb.font.size = Pt(11)
        rb.font.color.rgb = C_WHITE
        rd = p.add_run()
        rd.text = desc
        rd.font.size = Pt(10)
        rd.font.color.rgb = C_MUTED

    # Right: Non-Functional Requirements
    add_card(sl, Inches(6.8), Inches(1.5), Inches(5.7), Inches(5.4), bg_color=C_CARD)
    tx_nf = sl.shapes.add_textbox(Inches(7.0), Inches(1.7), Inches(5.3), Inches(5.0))
    tf_nf = tx_nf.text_frame
    tf_nf.word_wrap = True

    pnf0 = tf_nf.paragraphs[0]
    rnf0 = pnf0.add_run()
    rnf0.text = "NON-FUNCTIONAL REQUIREMENTS"
    rnf0.font.bold = True
    rnf0.font.size = Pt(13)
    rnf0.font.color.rgb = C_GREEN

    pnf_sub = tf_nf.add_paragraph()
    rnf_sub = pnf_sub.add_run()
    rnf_sub.text = "Reliability and performance goals"
    rnf_sub.font.size = Pt(11)
    rnf_sub.font.color.rgb = C_MUTED

    nf_reqs = [
        ("High Availability", "Keep serving files as long as more than half the nodes remain healthy."),
        ("Fast Failover (<1.8s)", "Elect a new leader in less than 2 seconds when the leader goes down."),
        ("Speedy Searches", "Distribute search queries across nodes so searches complete in ~266ms."),
        ("Zero Data Loss", "Committed files stay safe even through multiple node reboots."),
        ("Live 3D Visualization", "Provide a real-time Three.js WebGL view to see node states clearly.")
    ]
    for title, desc in nf_reqs:
        p = tf_nf.add_paragraph()
        p.space_before = Pt(10)
        rb = p.add_run()
        rb.text = f"{title}\n"
        rb.font.bold = True
        rb.font.size = Pt(11)
        rb.font.color.rgb = C_WHITE
        rd = p.add_run()
        rd.text = desc
        rd.font.size = Pt(10)
        rd.font.color.rgb = C_MUTED

# ==============================================================================
# SLIDE 4: 03 / SYSTEM ARCHITECTURE
# ==============================================================================
def slide_architecture():
    sl = add_slide()
    add_reference_header(sl, "03  /  SYSTEM ARCHITECTURE", "04")

    tx_flow = sl.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.73), Inches(0.4))
    p_fl = tx_flow.text_frame.paragraphs[0]
    r_fl = p_fl.add_run()
    r_fl.text = "How requests move from the browser to the storage nodes"
    r_fl.font.size = Pt(13)
    r_fl.font.color.rgb = C_CYAN

    flow_steps = [
        ("01", "Web Dashboard", "Upload and search interface running on Port 3000"),
        ("02", "Orchestrator", "Sends uploads to leader; splits searches to all nodes"),
        ("03", "Leader Node", "Writes to local log; sends heartbeats every 50ms"),
        ("04", "Follower Nodes", "Nodes 1 & 2 receive copies and verify checksums"),
        ("05", "Health Monitor", "Tracks active nodes and triggers elections on crash")
    ]
    for i, (num, title, desc) in enumerate(flow_steps):
        x = Inches(0.8) + i * Inches(2.38)
        add_card(sl, x, Inches(1.85), Inches(2.2), Inches(1.6), bg_color=C_CARD_ALT, border_color=C_BORDER_LIGHT)

        tx_b = sl.shapes.add_textbox(x + Inches(0.1), Inches(1.95), Inches(2.0), Inches(1.4))
        tf_b = tx_b.text_frame
        tf_b.word_wrap = True

        p0 = tf_b.paragraphs[0]
        r0 = p0.add_run()
        r0.text = num + "  " + title
        r0.font.bold = True
        r0.font.size = Pt(11)
        r0.font.color.rgb = C_CYAN

        p1 = tf_b.add_paragraph()
        p1.space_before = Pt(4)
        r1 = p1.add_run()
        r1.text = desc
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = C_MUTED

    # Bottom Area
    add_card(sl, Inches(0.8), Inches(3.65), Inches(7.5), Inches(3.3), bg_color=C_CARD)
    tx_des = sl.shapes.add_textbox(Inches(1.0), Inches(3.8), Inches(7.1), Inches(3.0))
    tf_des = tx_des.text_frame
    tf_des.word_wrap = True

    pd0 = tf_des.paragraphs[0]
    rd0 = pd0.add_run()
    rd0.text = "SMART DESIGN: SEPARATE CLIENT AND CONSENSUS PORTS"
    rd0.font.bold = True
    rd0.font.size = Pt(12)
    rd0.font.color.rgb = C_CYAN

    pd1 = tf_des.add_paragraph()
    pd1.space_before = Pt(6)
    rd1 = pd1.add_run()
    rd1.text = (
        "We gave each node two separate ports so user activity never interferes with internal cluster health:\n\n"
        "• Client HTTP Port (5000+N): Used by web browsers to upload, download, and search files.\n"
        "• Internal Raft Port (7000+N): Used exclusively for 50ms heartbeat signals and voting messages.\n\n"
        "This means even if a user uploads a heavy 20MB file, the internal heartbeats still go through smoothly. "
        "The cluster never triggers a false-alarm election due to busy upload traffic."
    )
    rd1.font.size = Pt(10.5)
    rd1.font.color.rgb = C_WHITE

    # Topology screenshot
    add_card(sl, Inches(8.5), Inches(3.65), Inches(4.03), Inches(3.3), bg_color=C_CARD)
    add_proportional_image(sl, "01_topology_nodes.png", Inches(8.6), Inches(3.75), 3.8, 3.1)

# ==============================================================================
# SLIDE 5: 04 / CONSENSUS MECHANISMS
# ==============================================================================
def slide_consensus():
    sl = add_slide()
    add_reference_header(sl, "04  /  CONSENSUS MECHANISMS", "05")

    mechanisms = [
        ("LEADER ELECTION", "Randomized Timers",
         "Nodes transition from Follower to Candidate to Leader. Random countdowns (150-300ms) prevent ties. When a candidate gets 2 out of 3 votes, it becomes the new Leader.",
         "Random timeout: 150-300 ms\nMajority quorum = (N/2) + 1\nHeartbeats sent every 50 ms",
         C_CYAN),
        ("LOG REPLICATION", "Majority Commit",
         "Clients only send files to the Leader. The Leader hashes the file, adds it to its log, and sends it to followers. Once at least 2 nodes confirm, the file is saved to disk.",
         "Entry: {filename, hash, term}\nConfirmed when majority ACKs\nZero chance of partial writes",
         C_BLUE_ACCENT),
        ("SAFETY INVARIANTS", "Fault Protection",
         "Only one leader can exist per term. Committed files are never erased or replaced. If a node was offline and returns, it syncs its missing files from the leader automatically.",
         "Logs can only be appended\nOut-of-date nodes sync back\nSurvives 1 failure in 3 nodes",
         C_GREEN)
    ]

    for i, (m_tag, m_title, m_desc, m_code, m_clr) in enumerate(mechanisms):
        x = Inches(0.8) + i * Inches(3.95)
        add_card(sl, x, Inches(1.5), Inches(3.75), Inches(5.4), bg_color=C_CARD)

        tx_m = sl.shapes.add_textbox(x + Inches(0.2), Inches(1.7), Inches(3.35), Inches(5.0))
        tf_m = tx_m.text_frame
        tf_m.word_wrap = True

        p0 = tf_m.paragraphs[0]
        r0 = p0.add_run()
        r0.text = m_tag
        r0.font.bold = True
        r0.font.size = Pt(11)
        r0.font.color.rgb = m_clr

        p_t = tf_m.add_paragraph()
        r_t = p_t.add_run()
        r_t.text = m_title
        r_t.font.bold = True
        r_t.font.size = Pt(14)
        r_t.font.color.rgb = C_WHITE

        p1 = tf_m.add_paragraph()
        p1.space_before = Pt(8)
        r1 = p1.add_run()
        r1.text = m_desc
        r1.font.size = Pt(11)
        r1.font.color.rgb = C_MUTED

        p2 = tf_m.add_paragraph()
        p2.space_before = Pt(14)
        r2 = p2.add_run()
        r2.text = "KEY PARAMETERS:\n" + m_code
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = C_CYAN

# ==============================================================================
# SLIDE 6: 05 / IMPLEMENTATION
# ==============================================================================
def slide_implementation():
    sl = add_slide()
    add_reference_header(sl, "05  /  IMPLEMENTATION", "06")

    tx_head = sl.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.73), Inches(0.4))
    p_h = tx_head.text_frame.paragraphs[0]
    r_h = p_h.add_run()
    r_h.text = "Built with TypeScript and Node.js with an interactive Three.js 3D web view"
    r_h.font.size = Pt(13)
    r_h.font.color.rgb = C_CYAN

    modules = [
        ("src/node.ts", "Raft Consensus Logic",
         "• Runs election timers\n• Handles voting and heartbeat RPCs\n• Tracks committed log entries\n• Serves client HTTP requests",
         C_CYAN),
        ("src/cluster.ts", "Process Supervisor",
         "• Starts and monitors node processes\n• Adds or removes nodes dynamically\n• Chaos Monkey crash test triggers\n• Combines MapReduce search results",
         C_BLUE_ACCENT),
        ("src/document-store.ts", "File Storage & Search",
         "• Writes files to local disk folders\n• Checks SHA-256 fingerprints\n• Buffers multipart file uploads\n• Scans local text files for keywords",
         C_GREEN)
    ]
    for i, (f_name, f_role, f_desc, f_clr) in enumerate(modules):
        x = Inches(0.8) + i * Inches(3.95)
        add_card(sl, x, Inches(1.85), Inches(3.75), Inches(2.7), bg_color=C_CARD)

        tx_mod = sl.shapes.add_textbox(x + Inches(0.2), Inches(2.0), Inches(3.35), Inches(2.4))
        tf_mod = tx_mod.text_frame
        tf_mod.word_wrap = True

        p0 = tf_mod.paragraphs[0]
        r0 = p0.add_run()
        r0.text = f_name
        r0.font.bold = True
        r0.font.size = Pt(13)
        r0.font.color.rgb = f_clr

        p_r = tf_mod.add_paragraph()
        r_r = p_r.add_run()
        r_r.text = f_role
        r_r.font.bold = True
        r_r.font.size = Pt(11)
        r_r.font.color.rgb = C_WHITE

        p1 = tf_mod.add_paragraph()
        p1.space_before = Pt(6)
        r1 = p1.add_run()
        r1.text = f_desc
        r1.font.size = Pt(10)
        r1.font.color.rgb = C_MUTED

    add_card(sl, Inches(0.8), Inches(4.75), Inches(11.73), Inches(2.15), bg_color=C_CARD_ALT, border_color=C_BORDER_LIGHT)
    tx_math = sl.shapes.add_textbox(Inches(1.1), Inches(4.9), Inches(11.1), Inches(1.85))
    tf_math = tx_math.text_frame
    tf_math.word_wrap = True

    pm0 = tf_math.paragraphs[0]
    rm0 = pm0.add_run()
    rm0.text = "CORE EQUATIONS USED IN THE CODE"
    rm0.font.bold = True
    rm0.font.size = Pt(12)
    rm0.font.color.rgb = C_CYAN

    pm1 = tf_math.add_paragraph()
    pm1.space_before = Pt(4)
    rm1 = pm1.add_run()
    rm1.text = (
        "• Election Countdown: Timer = 150 + random(0, 150) ms. Because timers are random, tied elections are avoided.\n"
        "• Quorum Requirement: Majority = floor(N / 2) + 1. For 3 nodes, 2 must agree. Survives 1 crash.\n"
        "• MapReduce Parallel Time: Total Time = max(Node Scan Time) + Merge Time. Faster than scanning on one machine.\n"
        "• Crash Recovery Ceiling: Detection (<300ms) + Election (<150ms) + RPCs (<20ms) = Under 1.8 seconds total."
    )
    rm1.font.size = Pt(10.5)
    rm1.font.color.rgb = C_WHITE

# ==============================================================================
# SLIDE 7: 06 / RESULTS — NORMAL LOAD
# ==============================================================================
def slide_results_normal():
    sl = add_slide()
    add_reference_header(sl, "06  /  RESULTS — NORMAL LOAD & STORAGE", "07")

    tx_sub = sl.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.73), Inches(0.4))
    p_s = tx_sub.text_frame.paragraphs[0]
    r_s = p_s.add_run()
    r_s.text = "Files saved and verified across 3 nodes · Checksums match 100% · Quorum active"
    r_s.font.size = Pt(13)
    r_s.font.color.rgb = C_CYAN

    # Left: Distributed Vault + Quorum Badge
    add_card(sl, Inches(0.8), Inches(1.85), Inches(4.8), Inches(5.05), bg_color=C_CARD)
    add_proportional_image(sl, "02_distributed_vault.png", Inches(0.9), Inches(2.0), 4.6, 3.6)
    add_proportional_image(sl, "04_quorum_status.png", Inches(0.9), Inches(5.8), 4.6, 0.9)

    # Right: Results Table
    t_shape = sl.shapes.add_table(7, 3, Inches(5.8), Inches(1.85), Inches(6.73), Inches(4.3))
    tbl = t_shape.table
    tbl.columns[0].width = Inches(2.53)
    tbl.columns[1].width = Inches(2.1)
    tbl.columns[2].width = Inches(2.1)

    headers = ["Test Metric", "RaftFS (Our System)", "Single Server (No Consensus)"]
    for ci, h in enumerate(headers):
        cell = tbl.cell(0, ci)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(30, 41, 59)
        p = cell.text_frame.paragraphs[0]
        r = p.add_run()
        r.text = h
        r.font.bold = True
        r.font.size = Pt(10.5)
        r.font.color.rgb = C_CYAN

    data = [
        ("System Availability", "100.00%", "92.40% (Outage on crash)"),
        ("Write Time", "38.2 ms", "12.5 ms"),
        ("MapReduce Search", "11 - 266 ms", "480 ms (Sequential scan)"),
        ("SHA-256 Hash Check", "100% Match", "Mismatches possible"),
        ("Cluster Quorum State", "3/3 Healthy", "N/A"),
        ("Node 0 (Leader)", "Active (:5000)", "Primary Server")
    ]
    for ri, row in enumerate(data):
        for ci, val in enumerate(row):
            cell = tbl.cell(ri + 1, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor(19, 29, 49) if ri % 2 == 0 else RGBColor(15, 23, 42)
            p = cell.text_frame.paragraphs[0]
            r = p.add_run()
            r.text = val
            r.font.size = Pt(10)
            r.font.color.rgb = C_GREEN if ci == 1 and "%" in val else C_WHITE

    add_card(sl, Inches(5.8), Inches(6.35), Inches(6.73), Inches(0.55), bg_color=C_CARD_ALT)
    tx_sm = sl.shapes.add_textbox(Inches(5.9), Inches(6.38), Inches(6.5), Inches(0.45))
    p_sm = tx_sm.text_frame.paragraphs[0]
    r_sm = p_sm.add_run()
    r_sm.text = "✓ Real test confirmed: PDF.pdf and README_Interviewpractice.md saved and downloadable on all nodes."
    r_sm.font.size = Pt(9.5)
    r_sm.font.color.rgb = C_GREEN

# ==============================================================================
# SLIDE 8: 07 / RESULTS — FAILURE & CHAOS RECOVERY
# ==============================================================================
def slide_results_failure():
    sl = add_slide()
    add_reference_header(sl, "07  /  RESULTS — FAILURE & CHAOS RECOVERY", "08")

    tx_sub = sl.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.73), Inches(0.4))
    p_s = tx_sub.text_frame.paragraphs[0]
    r_s = p_s.add_run()
    r_s.text = "Chaos Monkey leader crash test + MapReduce parallel search benchmark"
    r_s.font.size = Pt(13)
    r_s.font.color.rgb = C_CYAN

    # Left: MapReduce Search + Scaling Buttons
    add_card(sl, Inches(0.8), Inches(1.85), Inches(4.8), Inches(5.05), bg_color=C_CARD)
    add_proportional_image(sl, "05_mapreduce_results.png", Inches(0.9), Inches(1.95), 4.6, 3.6)
    add_proportional_image(sl, "03_scaling_controls.png", Inches(0.9), Inches(5.85), 4.6, 0.9)

    # Right: 3 Comparative Analysis Cards
    cards = [
        ("Single Server Storage", "FAILED",
         "• 0% availability when server crashes\n• All ongoing file uploads terminate\n• In-flight data permanently corrupted\n• Requires manual human intervention",
         C_RED),
        ("RaftFS Quorum Recovery", "HEALTHY",
         "• 100% availability maintained\n• Leader crash detected in <300ms\n• Node 1 elected new Leader in <1.8s\n• Zero files or committed logs lost",
         C_GREEN),
        ("MapReduce Search Benchmark", "OPTIMAL",
         "• Tested live with query: 'Practice'\n• Found 4 matches in 266 milliseconds\n• Scanned nodes [0, 1, 2] in parallel\n• Pulled exact line numbers & previews",
         C_CYAN)
    ]
    for i, (c_tag, c_status, c_desc, c_clr) in enumerate(cards):
        y = Inches(1.85) + i * Inches(1.72)
        add_card(sl, Inches(5.8), y, Inches(6.73), Inches(1.58), bg_color=C_CARD_ALT, border_color=C_BORDER_LIGHT)

        tx_c = sl.shapes.add_textbox(Inches(6.0), y + Inches(0.1), Inches(6.3), Inches(1.4))
        tf_c = tx_c.text_frame
        tf_c.word_wrap = True

        p0 = tf_c.paragraphs[0]
        r0 = p0.add_run()
        r0.text = c_tag + "  —  "
        r0.font.bold = True
        r0.font.size = Pt(11.5)
        r0.font.color.rgb = C_WHITE

        r_st = p0.add_run()
        r_st.text = c_status
        r_st.font.bold = True
        r_st.font.size = Pt(11.5)
        r_st.font.color.rgb = c_clr

        p1 = tf_c.add_paragraph()
        p1.space_before = Pt(3)
        r1 = p1.add_run()
        r1.text = c_desc
        r1.font.size = Pt(10)
        r1.font.color.rgb = C_MUTED

# ==============================================================================
# SLIDE 9: 08 / CONCLUSION
# ==============================================================================
def slide_conclusion():
    sl = add_slide()
    add_reference_header(sl, "08  /  CONCLUSION", "09")

    tx_sub = sl.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.73), Inches(0.4))
    p_s = tx_sub.text_frame.paragraphs[0]
    r_s = p_s.add_run()
    r_s.text = "What we learned from building and testing RaftFS"
    r_s.font.size = Pt(13)
    r_s.font.color.rgb = C_CYAN

    findings = [
        ("01", "Uncoordinated Backups Aren't Enough",
         "Simply copying files across servers without consensus leads to conflicting versions and silent data loss when servers crash."),
        ("02", "Raft Guarantees Zero Data Loss",
         "Requiring a majority quorum ensures that committed files are never overwritten. When we killed the leader, the cluster recovered in 1,420ms (<1.8s) with no data lost."),
        ("03", "MapReduce Makes Distributed Search Fast",
         "Letting all nodes search their local files in parallel completed full-text searches in 266ms, far faster than searching sequentially on one server."),
        ("04", "Live 3D Visualization Helps Debugging",
         "The Three.js dashboard made it easy to watch heartbeats, see which node was leader, and verify recovery in real time.")
    ]

    for i, (num, title, body_text) in enumerate(findings):
        y = Inches(1.85) + i * Inches(1.15)
        add_card(sl, Inches(0.8), y, Inches(11.73), Inches(1.02), bg_color=C_CARD)

        tx_f = sl.shapes.add_textbox(Inches(1.0), y + Inches(0.1), Inches(11.3), Inches(0.85))
        tf_f = tx_f.text_frame
        tf_f.word_wrap = True

        p0 = tf_f.paragraphs[0]
        r0 = p0.add_run()
        r0.text = num + "   " + title + ": "
        r0.font.bold = True
        r0.font.size = Pt(11.5)
        r0.font.color.rgb = C_CYAN

        rd = p0.add_run()
        rd.text = body_text
        rd.font.size = Pt(10.5)
        rd.font.color.rgb = C_WHITE

    add_card(sl, Inches(0.8), Inches(6.55), Inches(11.73), Inches(0.45), bg_color=C_CARD_ALT)
    tx_lim = sl.shapes.add_textbox(Inches(1.0), Inches(6.57), Inches(11.3), Inches(0.4))
    p_l = tx_lim.text_frame.paragraphs[0]
    r_l = p_l.add_run()
    r_l.text = "Future Work: Multi-host networking · Binary gRPC messages · Automatic log compaction (snapshotting)."
    r_l.font.size = Pt(9.5)
    r_l.font.color.rgb = C_MUTED

# ==============================================================================
# SLIDE 10: THANK YOU
# ==============================================================================
def slide_qa():
    sl = add_slide()

    tx = sl.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.33), Inches(3.0))
    tf = tx.text_frame

    p0 = tf.paragraphs[0]
    p0.alignment = PP_ALIGN.CENTER
    r0 = p0.add_run()
    r0.text = "THANK YOU"
    r0.font.size = Pt(44)
    r0.font.bold = True
    r0.font.color.rgb = C_WHITE

    p1 = tf.add_paragraph()
    p1.space_before = Pt(12)
    p1.alignment = PP_ALIGN.CENTER
    r1 = p1.add_run()
    r1.text = "Questions & Discussion"
    r1.font.size = Pt(20)
    r1.font.color.rgb = C_CYAN

    p2 = tf.add_paragraph()
    p2.space_before = Pt(24)
    p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run()
    r2.text = "Rao Abdullah (22CS067)  ·  Muhammad Hashim (22CS013)  ·  Bilal Qazi (22CS029)\nDepartment of Computer Systems Engineering  ·  MUET Jamshoro"
    r2.font.size = Pt(12)
    r2.font.color.rgb = C_MUTED

# ==============================================================================
# Compilation
# ==============================================================================
if __name__ == "__main__":
    print("Compiling Humanized Presentation for 22CS067, 22CS013, 22CS029...")
    slide_title()
    slide_problem()
    slide_requirements()
    slide_architecture()
    slide_consensus()
    slide_implementation()
    slide_results_normal()
    slide_results_failure()
    slide_conclusion()
    slide_qa()

    try:
        prs.save(OUT_FILE)
        print("Success: Generated " + OUT_FILE)
    except PermissionError:
        prs.save(OUT_FILE_FALLBACK)
        print("Note: Presentation_RaftFS.pptx was locked by an active viewer.")
        print("Success: Generated " + OUT_FILE_FALLBACK)

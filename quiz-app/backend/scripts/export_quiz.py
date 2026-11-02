import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(backend_dir, '.env'))

import firebase_admin
from firebase_admin import credentials, firestore

cred_path = os.path.join(backend_dir, os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.Client(database=os.getenv('DB_NAME'))

weeks_data = {}
all_questions = []

for w in range(19, 25):
    wid = f"2026-W{w:02d}"
    docs = list(db.collection("questions").where(field_path="week_id", op_string="==", value=wid).stream())
    docs_sorted = sorted([d.to_dict() for d in docs], key=lambda x: x.get('order', 0))
    
    week_list = []
    for q in docs_sorted:
        order = q.get('order', len(week_list) + 1)
        text = q.get('text', '').strip()
        options = q.get('options', [])
        raw_ans = q.get('correct_answer', '').strip()
        
        opt_a = options[0] if len(options) > 0 else ''
        opt_b = options[1] if len(options) > 1 else ''
        opt_c = options[2] if len(options) > 2 else ''
        opt_d = options[3] if len(options) > 3 else ''
        
        # Match option
        ans_letter = ''
        ans_text = raw_ans
        letters = ['A', 'B', 'C', 'D']
        for i, opt in enumerate([opt_a, opt_b, opt_c, opt_d]):
            if opt.strip().lower() == raw_ans.lower():
                ans_letter = letters[i]
                ans_text = opt
                break
        
        correct_formatted = f"Option {ans_letter}: {ans_text}" if ans_letter else raw_ans
        
        item = {
            'week': f"Week {w}",
            'week_id': wid,
            'order': order,
            'question': text,
            'option_a': opt_a,
            'option_b': opt_b,
            'option_c': opt_c,
            'option_d': opt_d,
            'correct_letter': ans_letter,
            'correct_answer': correct_formatted,
            'ans_text': ans_text,
            'category': q.get('category', 'General')
        }
        week_list.append(item)
        all_questions.append(item)
    weeks_data[f"Week {w}"] = week_list

print(f"Fetched {len(all_questions)} questions across {len(weeks_data)} weeks.")

# Build Excel Workbook
wb = openpyxl.Workbook()
wb.remove(wb.active) # remove default sheet

# Color palette & styling
navy_fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Deep blue
header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

data_font = Font(name='Segoe UI', size=10)
bold_font = Font(name='Segoe UI', size=10, bold=True)
ans_font = Font(name='Segoe UI', size=10, bold=True, color='166534') # Dark green

zebra_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
white_fill = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')
ans_fill = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid') # Soft emerald green
badge_fill = PatternFill(start_color='EFF6FF', end_color='EFF6FF', fill_type='solid') # Soft blue

thin_border = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

def populate_sheet(ws, items, is_master=False):
    if is_master:
        headers = ['Week', 'DB Week ID', 'Q#', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']
    else:
        headers = ['Q#', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']
    
    ws.append(headers)
    ws.row_dimensions[1].height = 28
    
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = navy_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = thin_border
        
    for r_idx, q in enumerate(items, start=2):
        if is_master:
            row_data = [
                q['week'],
                q['week_id'],
                q['order'],
                q['question'],
                q['option_a'],
                q['option_b'],
                q['option_c'],
                q['option_d'],
                q['correct_answer']
            ]
        else:
            row_data = [
                q['order'],
                q['question'],
                q['option_a'],
                q['option_b'],
                q['option_c'],
                q['option_d'],
                q['correct_answer']
            ]
        ws.append(row_data)
        ws.row_dimensions[r_idx].height = 45 # generous height for reading question
        
        row_fill = zebra_fill if (r_idx % 2 == 0) else white_fill
        for c_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.border = thin_border
            
            is_ans_col = (c_idx == len(row_data))
            if is_ans_col:
                cell.fill = ans_fill
                cell.font = ans_font
                cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            else:
                cell.fill = row_fill
                cell.font = data_font
                val = row_data[c_idx - 1]
                if isinstance(val, int) or (isinstance(val, str) and (val.startswith('Week') or val.startswith('2026-W'))):
                    cell.alignment = Alignment(horizontal='center', vertical='center')
                    if isinstance(val, str) and val.startswith('Week'):
                        cell.font = bold_font
                else:
                    cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions
    
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        h_name = str(col[0].value)
        if h_name in ['Week', 'DB Week ID', 'Q#']:
            ws.column_dimensions[col_letter].width = 12
        elif h_name == 'Question':
            ws.column_dimensions[col_letter].width = 54
        elif h_name.startswith('Option'):
            ws.column_dimensions[col_letter].width = 30
        elif h_name == 'Correct Answer':
            ws.column_dimensions[col_letter].width = 34
        else:
            ws.column_dimensions[col_letter].width = 20

# 1. Master sheet
ws_master = wb.create_sheet(title='All Weeks (19-24)')
populate_sheet(ws_master, all_questions, is_master=True)

# 2. Individual sheets
for week_name, items in weeks_data.items():
    ws_week = wb.create_sheet(title=week_name)
    populate_sheet(ws_week, items, is_master=False)

workspace_dir = os.path.dirname(backend_dir)
excel_out = os.path.join(workspace_dir, 'quiz_questions_w19_to_w24.xlsx')
wb.save(excel_out)
print(f"Excel saved to {excel_out}")

# Write Markdown file
md_out = os.path.join(workspace_dir, 'quiz_questions_w19_to_w24.md')
with open(md_out, 'w', encoding='utf-8') as f:
    f.write("# Quiz Questions & Answers (Weeks 19 to 24)\n\n")
    f.write("This document contains all **60 quiz questions**, answer choices, and correct answers from **Week 19 to Week 24** (`2026-W19` to `2026-W24`).\n\n")
    f.write(f"- **Excel Spreadsheet:** [quiz_questions_w19_to_w24.xlsx](quiz_questions_w19_to_w24.xlsx)\n")
    f.write(f"- **Total Weeks:** 6 weeks (10 questions per week)\n")
    f.write(f"- **Total Questions:** 60 questions\n\n")
    f.write("---\n\n")
    
    for week_name, items in weeks_data.items():
        wid = items[0]['week_id']
        f.write(f"## {week_name} (`{wid}`)\n\n")
        
        # Summary table for the week
        f.write("| Q# | Question | Correct Answer |\n")
        f.write("|---|---|---|\n")
        for q in items:
            q_clean = q['question'].replace('|', '\\|')
            ans_clean = q['correct_answer'].replace('|', '\\|')
            f.write(f"| **Q{q['order']}** | {q_clean} | **{ans_clean}** |\n")
        f.write("\n\n### Detailed Breakdown\n\n")
        
        for q in items:
            f.write(f"#### Q{q['order']}. {q['question']}\n\n")
            opts = [
                ('A', q['option_a']),
                ('B', q['option_b']),
                ('C', q['option_c']),
                ('D', q['option_d']),
            ]
            for letter, opt in opts:
                if letter == q['correct_letter']:
                    f.write(f"- [x] **{letter}:** **{opt}** *(Correct Answer)*\n")
                else:
                    f.write(f"- [ ] **{letter}:** {opt}\n")
            f.write(f"\n> **Correct Answer:** **{q['correct_answer']}**\n\n")
        f.write("---\n\n")

print(f"Markdown saved to {md_out}")

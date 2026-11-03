#!/usr/bin/env python3
"""Validate provenance/coverage, not linguistic truth."""
from pathlib import Path
import json, csv, hashlib, subprocess, collections
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'research/reports'
r=json.loads((OUT/'RESEARCH_REGISTRY.json').read_text());commit=r['git_commit'];checks={}
expected=subprocess.check_output(['git','ls-tree','-r','--name-only',commit,'research'],cwd=ROOT,text=True).splitlines()
assert set(expected)=={m['path'] for m in r['materials']}
for m in r['materials']:
 actual=(ROOT/m['path']).read_bytes();original=subprocess.check_output(['git','show',commit+':'+m['path']],cwd=ROOT)
 assert actual==original and hashlib.sha256(actual).hexdigest()==m['sha256'],m['path']
checks['original_files_identical_to_audited_git_commit']=len(expected)
assert r['counts']['pdf_pages']==135 and len(r['pdf_reading_inventory'])==8
for p in r['pdf_reading_inventory']:assert all(page['chars']>0 for page in p['pages'])
checks['nonempty_original_pdf_pages']=135
assert len(r['words'])==58 and len({w['lemma'] for w in r['words']})==58
assert all(w['publication_gate']=='blocked_pending_primary_source_verification_and_user_review' for w in r['words'])
assert len([w for w in r['words'] if w['candidate_gate']=='NOT_VERIFIED'])==50
with (OUT/'CANDIDATE_50_AUDIT.csv').open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
assert len(rows)==50 and all('NOT_VERIFIED' in row['Статус строки-кандидата'] for row in rows)
checks['word_review_records']=58;checks['candidate_rows_preserved_not_verified']=50
assert len(r['duplicate_checks'])==3 and all(d['equal_ignoring_trailing_whitespace'] for d in r['duplicate_checks'])
checks['xlsx_md_duplicate_pairs']=3
assert len(r['reviewed_claim_groups'])==81
for claim in r['reviewed_claim_groups']:
 assert claim['verified_external_sources']==[]
 for e in claim['evidence']:
  assert (ROOT/e['material']).exists()
  if e.get('pages'):
   material=next(m for m in r['materials'] if m['path']==e['material'])
   assert all(1<=p<=material['pages'] for p in e['pages'])
checks['claim_group_source_locations']=81
url_ids={u['id'] for u in r['external_url_register']};ids=set();page_coverage=collections.defaultdict(set);count=0
for line in (OUT/'RESEARCH_EVIDENCE.jsonl').open():
 u=json.loads(line);count+=1;assert u['id'] not in ids;ids.add(u['id']);assert u['citation_url_ids']==list(dict.fromkeys(u['citation_url_ids']))
 assert (ROOT/u['material']).exists()
 assert set(u['citation_url_ids'])<=url_ids
 loc=u['locator']
 if 'page' in loc:page_coverage[u['material']].add(loc['page'])
 elif 'line_start' in loc:assert 1<=loc['line_start']<=loc['line_end']<=len((ROOT/u['material']).read_text().splitlines())
 elif 'sheet' in loc:
  book=r['workbooks'][Path(u['material']).name];assert loc['sheet'] in book
  assert any(c['cell']==loc['cell'] for row in book[loc['sheet']]['rows'] for c in row)
for p in r['pdf_reading_inventory']:assert page_coverage[p['path']]==set(range(1,len(p['pages'])+1))
assert count==r['counts']['raw_evidence_units']
checks['evidence_units_with_valid_unique_ids_and_locations']=count
checks['external_primary_sources_newly_verified']=0
checks['linguistic_truth_validation']='Не заменяется техническими проверками; внешние оригиналы не открыты заново.'
(OUT/'AUDIT_VALIDATION.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(checks,ensure_ascii=False,indent=2))

#!/usr/bin/env python3
"""Read-only source audit. Requires PyMuPDF and openpyxl; never saves workbooks/PDFs.
Regenerates derived registries, not the editorial audit report or WORD_REVIEWS.json.
"""
from pathlib import Path
import hashlib, json, re, csv, subprocess, unicodedata
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode, unquote
import fitz
import openpyxl
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'research/reports'
# Pin the examined source snapshot; later audit commits must not ingest their own outputs.
COMMIT='e623664711202cdc5c791f35e4c75507ed2b2d5c'
SOURCE_LIST=subprocess.check_output(['git','ls-tree','-r','--name-only',COMMIT,'research'],cwd=ROOT,text=True).splitlines()
materials=[]; units=[]; urls={}; books={}; pdfs=[]; source_rows=[]; derivative_checks=[]
def canon(url):
 try:
  p=urlsplit(url); return urlunsplit((p.scheme,p.netloc,p.path,urlencode([(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if not k.startswith('utm_')]),p.fragment))
 except ValueError:return url
def urlid(url,location):
 clean=canon(url); key='URL-'+hashlib.sha256(clean.encode()).hexdigest()[:12]
 row=urls.setdefault(key,{'id':key,'url':clean,'raw_urls':[],'occurrences':[],'external_verification':'not_performed','warning':'Наличие ссылки и HTTP-доступ не доказывают утверждение.'})
 if url not in row['raw_urls']:row['raw_urls'].append(url)
 if location not in row['occurrences']:row['occurrences'].append(location)
 return key
def refs(text):return sorted(set(re.findall(r'(?:SPT-S|[SM])\d+|turn\d+(?:search|view)\d+|【[^】]+】',text)))
def unit(uid,path,locator,text,kind,cited=(),extra=None):
 detected=re.findall(r'https?://[^\s<>\]"`]+',text)
 targets=[urlid(u,{'path':path,**locator}) for u in dict.fromkeys([*cited,*detected])]
 row={'id':uid,'material':path,'locator':locator,'kind':kind,'text':text,'citation_markers':refs(text),'citation_groups_raw':re.findall(r'\[[^\]\n]{0,80}S\d[^\]\n]{0,80}\]',text),'citation_url_ids':list(dict.fromkeys(targets)),'audit_status':'требует дополнительной проверки','evidence_scope':'Свидетельство того, что утверждение содержится в локальном материале; не проверка внешнего первоисточника.'}
 if extra:row.update(extra)
 units.append(row)
for rel in SOURCE_LIST:
 p=ROOT/rel; data=p.read_bytes(); item={'id':'MAT-'+hashlib.sha256(rel.encode()).hexdigest()[:10],'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_commit':COMMIT}
 if data!=subprocess.check_output(['git','show',COMMIT+':'+rel],cwd=ROOT):raise RuntimeError('Source changed: '+rel)
 if p.name=='.DS_Store':item['role']='служебные метаданные macOS, не научный материал'
 elif p.suffix=='.pdf':
  item['role']='исходное исследовательское PDF-досье; не вложенные первичные словари';doc=fitz.open(p);item['pages']=len(doc);item['images']=sum(len(pg.get_images()) for pg in doc);page_info=[]
  for n,pg in enumerate(doc,1):
   links=[l for l in pg.get_links() if l.get('uri')];text=pg.get_text(sort=True);page_info.append({'page':n,'chars':len(text),'links':len(links)})
   for l in links:urlid(l['uri'],{'path':rel,'page':n,'rect':list(l['from'])})
   for i,block in enumerate(pg.get_text('blocks',sort=True),1):
    txt=block[4].strip()
    if not txt:continue
    rect=fitz.Rect(block[:4]);targets=[l['uri'] for l in links if (l['from'] & rect).get_area()>0]
    unit(f'PDF-{p.stem}-p{n:03d}-b{i:03d}',rel,{'page':n,'block':i,'rect':list(rect)},txt,'pdf-block',targets,{'citation_warning':'Ссылка пересекает блок; её предметная релевантность требует ручной проверки. Позиция S# локальна данному досье.'})
  pdfs.append({'path':rel,'pages':page_info})
 elif p.suffix in ['.md','.txt']:
  item['role']='инструкция/манифест' if '/reports/' not in rel else 'производный текст / сохранённый исследовательский отчёт'
  lines=p.read_text().splitlines(); item['lines']=len(lines)
  start=1;para=[]
  def flush(end):
   if para:unit('TXT-'+item['id']+f'-L{start:04d}',rel,{'line_start':start,'line_end':end},'\n'.join(para),'text-paragraph',extra={'independence':'Не считать текстовую копию независимым подтверждением PDF.'})
  for n,line in enumerate(lines,1):
   if not line.strip():flush(n-1);para=[];start=n+1
   else:
    if not para:start=n
    para.append(line)
  flush(len(lines))
 elif p.suffix=='.xlsx':
  item['role']='рабочая таблица; не самостоятельная аттестация иностранной формы';wb=openpyxl.load_workbook(p,data_only=False);book={}
  for sh in wb:
   rows=[]
   for row in sh:
    cells=[{'cell':c.coordinate,'value':c.value,'hyperlink':c.hyperlink.target if c.hyperlink else None,'comment':c.comment.text if c.comment else None} for c in row if c.value is not None or c.hyperlink or c.comment]
    if cells:rows.append(cells)
   book[sh.title]={'max_row':sh.max_row,'max_column':sh.max_column,'state':sh.sheet_state,'nonempty_cells':sum(len(r) for r in rows),'rows':rows}
   duplicate={'Полное досье':'samovar','Досье — спутник':'sputnik','Досье — матрёшка':'matryoshka'}.get(sh.title)
   if duplicate:
    text='\n'.join(str(next((c['value'] for c in r if c['cell'].startswith('B')),'')) for r in rows[1:]);md=f'research/original_pdfs/reports/{duplicate}.md';same=text.rstrip()==(ROOT/md).read_text().rstrip();derivative_checks.append({'path':rel,'sheet':sh.title,'same_text_as':md,'equal_ignoring_trailing_whitespace':same})
   for row in rows:
    n=int(re.search(r'\d+',row[0]['cell'])[0]);d={re.sub(r'\d+','',c['cell']):c['value'] for c in row}
    if p.name.startswith('workbook') and sh.title=='Источники' and n>4 and d.get('C'):
     source_rows.append({'id':'WB-'+str(d.get('A')),'legacy_id':d.get('A'),'word_number':d.get('B'),'source_path':rel,'sheet':sh.title,'row':n,'cells':row,'verification':'reported_only'})
    # ID-only template rows and duplicate full-dossier sheets are retained in workbook data,
    # but are not multiplied into independent evidence units.
    if duplicate or (p.name.startswith('workbook') and sh.title in ['Слова — 200','Языковые формы','Источники'] and n>4 and len(row)<3):continue
    for c in row:
     unit('XLS-'+item['id']+'-'+sh.title+'-'+c['cell'],rel,{'sheet':sh.title,'cell':c['cell']},str(c['value']),'xlsx-cell',[c['hyperlink']] if c['hyperlink'] else [],{'comment':c['comment'],'verification':'Только наличие в таблице; исходный статус не перенесён в verified.'})
  books[p.name]=book;item['sheets']=[{'name':s,**{k:v for k,v in sh.items() if k!='rows'}} for s,sh in book.items()]
 materials.append(item)
reviews=json.loads((OUT/'WORD_REVIEWS.json').read_text());review_map={r['lemma']:r for r in reviews}
cb=books['reconstructed_50_candidates_NOT_VERIFIED.xlsx']
def dictrow(row):return {re.sub(r'\d+','',c['cell']):c['value'] for c in row}
candidates=[dictrow(r)|{'row':i+1} for i,r in enumerate(cb['Главный реестр']['rows']) if i>0]
ev=[dictrow(r)|{'row':i+1} for i,r in enumerate(cb['Языковые свидетельства']['rows']) if i>0]
extra=[dictrow(r)|{'row':i+1} for i,r in enumerate(cb['Спорные случаи']['rows']) if i>0]
words=[]
for lemma in sorted(set([c['C'] for c in candidates]+[e['B'] for e in extra]+list(review_map))):
 c=next((c for c in candidates if c['C']==lemma),None);review=review_map.get(lemma);langs=[e for e in ev if e['B']==lemma];dispute=next((e for e in extra if e['B']==lemma),None)
 words.append({'id':'WORD-'+hashlib.sha256(lemma.encode()).hexdigest()[:10],'lemma':lemma,'review_key':review['key'] if review else None,'audit_status':review['overall_status'] if review else ('спорно' if dispute else 'недостаточно данных'),'publication_gate':'blocked_pending_primary_source_verification_and_user_review','candidate_row':c,'reported_forms_not_verified':langs,'dispute_row':dispute,'open_fields':([] if review else ['происхождение/русское посредничество','подтверждённая иностранная форма','языковая локализация','семантика','фонетика','графика/нормативность','грамматика','хронология','постатейная библиография']),'candidate_gate':'NOT_VERIFIED' if c else None})
claims=[]
for review in reviews:
 for field in ['origin','forms','semantic','phonetic','graphic','grammar','chronology','sources','issues']:
  pp=review['pages'][field];path=f"research/original_pdfs/{review['key']}_dossier.pdf" if review['key']!='balalaika' else 'research/original_pdfs/reports/balalaika_current.md'
  secondary=[]
  if review['key']=='balalaika':secondary=['research/original_pdfs/reports/balalaika_earlier.md']
  claims.append({'id':f"CLAIM-{review['key']}-{field}",'lemma':review['lemma'],'field':field,'assessment':review[field],'status':'спорно' if field=='issues' or review['key']=='balalaika' else 'частично подтверждено','evidence':[{'material':path,'pages':pp},*[{'material':p} for p in secondary]],'bibliography_as_reported':review['sources'],'verified_external_sources':[],'warning':'Групповой обзор утверждений досье; подробные дословные единицы и URL находятся в RESEARCH_EVIDENCE.jsonl. Не production-запись.'})
checks=json.loads((OUT/'SOURCE_ACCESS_CHECKS.json').read_text()) if (OUT/'SOURCE_ACCESS_CHECKS.json').exists() else []
reg={'schema_version':1,'audit_date':'2026-11-03','timezone':'Asia/Novosibirsk','git_commit':COMMIT,'direction':'Русский → иностранные языки; глубокая этимология хранится отдельно от непосредственного донора.','status_definition':'verified_external_sources пуст: первичные внешние страницы заново не открыты. Подтверждён факт наличия локального текста, а не автоматически истинность его вывода.','materials':materials,'pdf_reading_inventory':pdfs,'duplicate_checks':derivative_checks,'external_url_register':list(urls.values()),'workbook_bibliographic_records':source_rows,'words':words,'reviewed_claim_groups':claims,'workbooks':books,'access_checks':checks,'counts':{'materials':len(materials),'pdfs':len(pdfs),'pdf_pages':sum(len(p['pages']) for p in pdfs),'word_review_records':len(words),'detailed_reviews':len(reviews),'candidate_rows':len(candidates),'candidate_form_rows':len(ev),'workbook_bibliography_rows':len(source_rows),'external_url_records':len(urls),'raw_evidence_units':len(units),'new_independently_verified_borrowings':0}}
(OUT/'RESEARCH_REGISTRY.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2,default=str)+'\n')
with (OUT/'RESEARCH_EVIDENCE.jsonl').open('w') as f:
 for row in units:f.write(json.dumps(row,ensure_ascii=False,default=str)+'\n')
with (OUT/'CANDIDATE_50_AUDIT.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.writer(f,lineterminator="\n");writer.writerow(['ID','Лемма','Исходная строка','Заявленные формы — НЕ подтверждены','Восстановленные URL','Статус строки-кандидата','Независимое досье в пакете','Пробелы'])
 for c in candidates:
  forms='; '.join(str(e['C'])+': '+str(e.get('D',''))+f" (Языковые свидетельства!D{e['row']})" for e in ev if e['B']==c['C']);writer.writerow([c['A'],c['C'],f"Главный реестр!C{c['row']}:I{c['row']}",forms,'Нет','требует дополнительной проверки; NOT_VERIFIED',review_map[c['C']]['key'] if c['C'] in review_map else 'Нет','Проверить каждую форму и русский маршрут по оригинальной статье; не наследовать A/B, R и ранги как достоверность'])
print(json.dumps(reg['counts'],ensure_ascii=False,indent=2))

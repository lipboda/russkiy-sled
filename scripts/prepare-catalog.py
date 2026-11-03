"""Build a research-only reading layer. Never upgrades audit publication gates."""
import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
r=json.loads((root/'research/reports/RESEARCH_REGISTRY.json').read_text())
sha=subprocess.check_output(['git','rev-parse','origin/main'],cwd=root,text=True).strip()
sources={};words=[]
langs={'Американский английский':'en-US','Французский':'fr-FR','Восточноармянский':'hy-AM'}
for w in r['words']:
 claims=[c for c in r['reviewed_claim_groups'] if c['lemma']==w['lemma']]
 notes=[];ids=[]
 for c in claims:
  refs=[]
  for ev in c['evidence']:
   sid=ev['material']; sources[sid]={'id':sid,'title':pathlib.Path(sid).name,'url':f'https://github.com/lipboda/russkiy-sled/blob/{sha}/{sid}','accessLevel':'full','notes':'Локальное досье; не независимая проверка цитируемого первоисточника.'}
   refs.append({'sourceId':sid,'pages':ev.get('pages',[])})
   if sid not in ids:ids.append(sid)
  if c['field']!='forms':
   a=c['assessment'];notes.append({'field':c['field'],'text':a if isinstance(a,str) else '\n'.join(a),'status':'disputed' if c['status']=='спорно' else 'pending','references':refs,'bibliography':c['bibliography_as_reported']})
 forms=next((c['assessment'] for c in claims if c['field']=='forms'),{})
 languages=[]
 for code,country in [('en-US','US'),('fr-FR','FR'),('hy-AM','AM')]:
  variants=forms.get(code,[])
  if not variants:
   variants=[str(f['D']) for f in w['reported_forms_not_verified'] if langs.get(f['C'])==code and f.get('D')]
  fc=next((c for c in claims if c['field']=='forms'),None)
  languages.append({'languageCode':code,'countryCode':country,'reportedForms':variants,'attestationStatus':'pending' if variants else 'unknown','sourceIds':ids if variants else [],'references':[{'sourceId':e['material'],'pages':e.get('pages',[])} for e in fc['evidence']] if fc else []})
 if not ids:
  sid='research/reports/CANDIDATE_50_AUDIT.csv'; sources[sid]={'id':sid,'title':'Реестр кандидатов — NOT_VERIFIED','url':f'https://github.com/lipboda/russkiy-sled/blob/{sha}/{sid}','accessLevel':'full','notes':'Список для проверки, не подтверждённый словарь.'};ids=[sid]
 for f in languages:
  if f['reportedForms'] and not f['sourceIds']:f['sourceIds']=ids
 themes={'samovar':'Быт и культура','matryoshka':'Быт и культура','dacha':'Быт и культура','balalaika':'Искусство','sputnik':'Наука и техника','kalashnikov':'История и общество','intelligentsia':'История и общество','samizdat':'История и общество','pogrom':'История и общество'}
 words.append({'id':w['id'],'slug':w['review_key'] or w['id'].lower(),'russianLemma':w['lemma'],'originKind':'unknown','themes':[themes.get(w['review_key'],'Тема уточняется')],'articleDepth':'full' if claims else 'short','publicationStatus':'provisional' if claims else 'draft','researchIncluded':bool(claims),'languages':languages,'sourceIds':ids,'notes':notes,'auditStatus':w['audit_status'],'isDemo':False})
(root/'src/data/catalog.json').write_text(json.dumps({'words':words,'sources':list(sources.values()),'auditCommit':r['git_commit']},ensure_ascii=False,indent=2)+'\n')

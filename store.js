/* =========================================================================
   store.js — shared, localStorage-backed data layer for the whole app.

   Every page (master-data-manager, master-parameter, master-program,
   eligibility_config_v5, workflow_config_new, worklist, workflow_management)
   loads this file *before* Vue mounts, then reads/writes `MCRM.db` instead
   of keeping its own private copy of the data. Because it's one Vue
   `reactive()` object persisted to localStorage, adding / editing / removing
   a row on one page is immediately visible on any other page that reads the
   same collection (after that page loads / re-mounts).

   Collections in MCRM.db:
     rows          - master data catalog: SYS_TYPE / ENTITY / LEAD_TYPE / PROGRAM / PARAMETER
     assignments   - which PROGRAMs are enabled for an ENTITY + LEAD_TYPE
     paramConfigs  - per PROGRAM + ENTITY parameter setup (base keys used)
     criteriaRows  - value sets (with per base-key operator/value) for a paramConfig
     cfgVersions   - "version" groupings shown before Parameter Master Setup
     fieldMeta     - dataType + example values for every PARAMETER base key,
                     shared between Parameter Master Setup and Lead Eligible Config
     fieldGroups   - how fieldMeta entries are grouped in the eligibility condition builder
     eligibility   - Lead Eligible Config records (condition groups)
     workflows     - Workflow Config records (flow nodes/edges)
     worklist      - Lead Management worklist entries
     executionLogs - Workflow Execution Log entries
   ========================================================================= */
   (function (global) {
    const STORAGE_KEY = 'mcrm_store_v1';
  
    const TXT = 0, NUM = 'number';
    const S = s => s.split(',').map(v => v.trim()).filter(Boolean);
    const RANGE = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(String(i)); return r; };
  
    function nowStr() {
      const d = new Date();
      return d.toLocaleDateString('en-US') + ' ' + d.toTimeString().slice(0, 5);
    }
  
    /* ---- parameter (base key) metadata: dataType + example values -------- */
    const FIELD_META = {
      company_code:      { label:'company_code',      dataType:TXT, values:S('GECAL') },
      product_id:        { label:'product_id',         dataType:TXT, values:S('HP,AL') },
      branch_code:       { label:'branch_code',        dataType:NUM, values:S('16,42,23,51,33,11,44,45,25,34,14,47,31,85,17,18,75,56,43,27,41,55,32,28,53,62,49,84,76,54,39,37,13,21,24,52,83,35,22,19') },
      model_type_group:  { label:'model_type_group',   dataType:TXT, values:S('PAL,PU,PUPA,PAM,PAS,SUV') },
      model_group:       { label:'model_group',        dataType:TXT, values:S('MG EP,VIGO_2DR,D-MAX_2DR,REVO_2DR,REVO_4DR,ALTIS,VIOS,MAZDA2,YARIS,ZS,CAMRY,YARIS ATIV,GS,VIGO_4DR,TRITON_2DR,XPANDER,HILUX_2DR,RANGER_2DR,PAJERO,ATTRAGE,D-MAX_4DR,MIRAGE,DOLPHIN,CIVIC,JAZZ,CITY,TRITON_4DR,HR-V,MAZDA3,ALMERA,MARCH,SWIFT,MG5,NAVARA_2DR,HILANDER_2DR,3 SERIES,MG3 HATCHBACK') },
      model:             { label:'model',              dataType:TXT, values:S('MG EP PLUS,HILUX VIGO 3.0,D-MAX_2DR,REVO_2DR,DMAX ISU41,HILUX REVO 4DR,ALTIS,D-MAX,VIOS,MAZDA2,YARIS,MG ZS 20C,CAMRY,YARIS ATIV 20B,MG GS 15X,HILUX VIGO 4DR,TRITON,XPANDER 20D,YARIS ATIV Y222,HILUX,DMAX M20 SPB,RANGER,PAJERO SPORT,ATTRAGE 19D,D-MAX 4DR,REVO B21 A3 03,HILUX_2DR,MIRAGE 20C,VIGO,DOLPHIN 2302,CIVIC Y18 F,CIVIC,XPANDER C20A,JAZZ,RANGER_2DR,CITY HAT 20F,DMAX,TRITON4DR,HRV 18H,MG ZS 22 03,DMAX Y20 H2D,HILUX VIGO,MAZDA 3,ALMERA,MAZDA2 Y21 5C1,CITY,MIRAGE 20D,CITY HAT 20D,YARIS Y23 12,MARCH,SWIFT,TRITON DC CNG W,MG5 22B,NAVARA,MG ZS 20B,HILANDER CAB,MAZDA2 Y18 5M,DMAX CAB,XPANDER 19C,JAZZ MINOR 16D,320I,MG3 18D') },
      car_cc:            { label:'car_cc',             dataType:NUM, values:S('0,2494,2499,2393,1898,1794,1497,1499,1197,1998,1490,1496,2477,2442,1193,2999,1393,1799,2198,988,1798,1498,2755,1598,1198,1299,1242,2488,2982,1995,2500') },
      region:            { label:'area',               dataType:TXT, values:S('BKK,UPC') },
      product_base:      { label:'sub_product_base',   dataType:TXT, values:S('New,Refin Non Topup,Used,Refin Topup,AL'), note:'New / Used / Refin Non Topup / Refin Topup / AL' },
      age:               { label:'age',                dataType:NUM, values:[], hint:'e.g. 20' },
      nationality:       { label:'nationality',        dataType:TXT, values:S('TH') },
      customer_type:     { label:'customer_type',      dataType:TXT, values:S('individual,corperate'), note:'1 = individual, 2 = corperate' },
      specialty_flag:    { label:'vip',                dataType:TXT, values:S('N,Y') },
      car_brand:         { label:'car_brand',          dataType:TXT, values:S('MG,TOY,ISU,MAZ,MIT,FOR,BYD,HON,NIS,SUZ,BMW') },
      car_age:           { label:'car_age',            dataType:NUM, values:[], hint:'e.g. 5' },
      engine_type_group: { label:'engine_type_group',  dataType:TXT, values:S('HEV,BEV,PHEV,ICE,NULL') },
  
      account_type:          { label:'account_type',          dataType:TXT, values:S('ACTIVE,CLOSED') },
      receipt_term:          { label:'receipt_term',          dataType:NUM, values:[], hint:'e.g. 12' },
      total_income:          { label:'total_income',          dataType:NUM, values:[], hint:'e.g. 15000' },
      occupations:           { label:'occupations',           dataType:TXT, values:S('พนักงานเอกชน (ประจำ),ราชการ/พนักงานรัฐวิสาหกิจ,เจ้าของกิจการ-ไม่มีทะเบียนการค้า') },
      remaining_term:        { label:'remaining_term',        dataType:NUM, values:RANGE(0,84) },
      paid_term:             { label:'paid_term',             dataType:NUM, values:[], hint:'e.g. 6' },
      no_month_after_closed: { label:'no_month_after_closed', dataType:TXT, values:RANGE(1,21) },
  
      max_dq:                     { label:'max_delinquency',            dataType:TXT, values:S('NULL,CURRENT,30 DAYS,60 DAYS,90 DAYS,120 DAYS,150 DAYS,180 DAYS,365+ DAYS,X DAYS'), note:'through loan life' },
      delinquency_status:         { label:'delinquency_status',         dataType:TXT, values:S('NULL,CURRENT,30 DAYS,60 DAYS,90 DAYS,120 DAYS,150 DAYS,180 DAYS,365+ DAYS,X DAYS'), note:'current' },
      gbi_account:                { label:'gbi_account',                dataType:TXT, values:S('G,B,I') },
      gbi_customer:               { label:'gbi_customer',               dataType:TXT, values:S('G,B,I') },
      b_score_customer:           { label:'b_score_customer',           dataType:TXT, values:S('A,B,C,D,E') },
      b_score_m_customer:         { label:'b_score_marketing_customer', dataType:TXT, values:S('NULL,NA,1_VL,2_L,3_M,4_H,5_VH') },
      b_score_account:            { label:'b_score_account',            dataType:TXT, values:S('A,B,C,D,E') },
      b_score_marketing_account:  { label:'b_score_marketing_account',  dataType:TXT, values:S('NULL,NA,1_VL,2_L,3_M,4_H,5_VH') },
      collection_code:            { label:'collection_code',            dataType:TXT, values:S('21700,21205,21105,23205,22105,21100,30000,22115,21210,22210,30025,32700,28315,21305,21905,23115,24805,22505,22120,22705,24110,21720,25710,21405,25101,23505,21715,28400,24210,30703,24100,25205,22205,24905,24310,23405,24201,22301,24910,21915,28305,21320,24120,24415,21515,21625,22101,24610,21120,24315,26105,22201,25115,24605,30704,21610,21910,21125,30056,24305,25310,25301,22501,21425,23810,24010,24115,22410,25601,28415,26501,21225,21600,21615,25605,24215,21925,21620,22401,22701,23201,26510,21601,21815,25215,26305,26415,26710,26605,21801,24701,25125,23720,21500,26215,22601,25615,30715,23815,23101') },
      consignment_flag:           { label:'consignment_flag',           dataType:TXT, values:S('Y,N') },
      account_status:             { label:'account_status',             dataType:TXT, values:S('NORMAL,CLOSED,CANCEL,TRANSFER,STOP VAT,NULL') },
      write_off_criteria:         { label:'write_off_criteria',         dataType:TXT, values:S('Y,N') },
      blacklist_customer:         { label:'blacklist_customer',         dataType:TXT, values:S('Y,N') },
      reject_from_product:        { label:'reject_from_product',        dataType:NUM, values:[], hint:'days e.g. 195' },
      recently_apply:             { label:'recently_apply',             dataType:NUM, values:[], hint:'days e.g. 105' },
      debt_re_status:             { label:'debt_re_status',             dataType:TXT, values:S('RCL,BR,RE,RC,NULL') },
  
      cash_offer: { label:'cash_offer', dataType:NUM, values:[] },
      iir:        { label:'iir',        dataType:NUM, values:[] },
      auto_group: { label:'auto_group', dataType:TXT, values:[] },
      pay_slip:   { label:'pay_slip',   dataType:TXT, values:[] },
    };
  
    /* ---- how those base keys are grouped in the eligibility condition builder */
    const FIELD_GROUP_LAYOUT = [
      { group:'Demographic Criteria', fields:['company_code','product_id','branch_code','model_type_group','model_group','model','car_cc','region','product_base','age','nationality','customer_type','specialty_flag','car_brand','car_age','engine_type_group'] },
      { group:'Retention Criteria',   fields:['account_type','receipt_term','total_income','occupations','remaining_term','paid_term','no_month_after_closed'] },
      { group:'Risk Criteria',        fields:['max_dq','delinquency_status','gbi_account','gbi_customer','b_score_customer','b_score_m_customer','b_score_account','b_score_marketing_account','collection_code','consignment_flag','account_status','write_off_criteria','blacklist_customer','reject_from_product','recently_apply','debt_re_status'] },
    ];
  
    /* ---- default Lead Eligible Config profiles (condition groups) ----
       Built from FIELD_META above so labels/dataTypes always match the
       shared dictionary. eligibility_config_v5.html uses the same shape
       when a user adds a brand-new profile. */
    let _eligUidSeq = 0;
    const _eligUid = () => 'c' + (++_eligUidSeq) + '_seed';
    function _cond(fieldId, op, vals, enabled){
      const meta = FIELD_META[fieldId] || {};
      return { type:'cond', uid:_eligUid(), fieldId, label: meta.label || fieldId, dataType: meta.dataType ?? TXT, op, vals: vals || [], enabled: enabled !== false };
    }
    function _ncond(fieldId, op, vals, enabled){ const c = _cond(fieldId, op, vals, enabled); delete c.type; return c; }
    function defaultEligibilityGroups(){
      return [
        { id:'demo', label:'Demographic Criteria', badge:'gb-d', dot:'#8A6F5C', accent:'accent-d', cardAcc:'acc-d',
          items:[
            _cond('product_id','in',['HP','AL']),
            _cond('product_base','in',['New','Refin Topup']),
            _cond('age','between',['20','64']),
            _cond('nationality','=',['TH']),
            _cond('region','in',['BKK']),
            _cond('branch_code','not in',['16','42']),
            _cond('customer_type','=',['individual']),
            _cond('car_age','<=',['12']),
            _cond('specialty_flag','!=',['Y'], false),
          ] },
        { id:'ret', label:'Retention Criteria', badge:'gb-r', dot:'#2F9E5F', accent:'accent-r', cardAcc:'acc-r',
          items:[
            { type:'group', uid:_eligUid(), label:'Occupation & Income Group', connector:'AND', enabled:true,
              conds:[ _ncond('occupations','not in',['เจ้าของกิจการ-ไม่มีทะเบียนการค้า']), _ncond('total_income','>=',['15000']) ] },
            _cond('account_type','=',['ACTIVE']),
            _cond('remaining_term','>=',['6']),
            _cond('paid_term','>=',['6']),
          ] },
        { id:'risk', label:'Risk Criteria', badge:'gb-k', dot:'#D64C4C', accent:'accent-k', cardAcc:'acc-k',
          items:[
            _cond('delinquency_status','=',['CURRENT']),
            _cond('max_dq','not in',['90 DAYS','120 DAYS','150 DAYS','180 DAYS','365+ DAYS']),
            _cond('gbi_customer','=',['G']),
            _cond('b_score_customer','in',['A','B','C']),
            _cond('collection_code','not in',['21700','21205']),
            _cond('consignment_flag','!=',['Y']),
            _cond('account_status','=',['NORMAL']),
            _cond('write_off_criteria','=',['N']),
            _cond('blacklist_customer','=',['N']),
            _cond('debt_re_status','not in',['RE','RCL'], false),
            _cond('reject_from_product','>=',['195']),
            _cond('recently_apply','>=',['105']),
          ] },
      ];
    }
  
    /* ---- default Workflow Execution Log transactions ----
       Snapshots of a flow's steps at the moment the transaction was created,
       copied from `workflows` (in-flight run history, independent of the
       design-time template so later template edits don't rewrite history). */
    function buildExecutionLogsSeed(workflows){
      function cloneSteps(flow, overrides){
        return flow.steps.map((s, i) => ({
          name: s.name || `Step${i+1}`, type: s.type || 'AUTO', status: (overrides && overrides[i]) || s.status || 'Wait',
          detail: s.detail || '', category: s.category || 'ELIGIBLE', code: s.code || '',
          leadType: s.leadType || '', entity: s.entity || '', program: s.program || '',
          params: Array.isArray(s.params) ? s.params.slice() : [],
        }));
      }
      const f5 = workflows.find(f => f.flow_id === 'F00005');
      const f6 = workflows.find(f => f.flow_id === 'F00006');
      const logs = [];
      if (f5){
        logs.push({
          trans_id:'T00001', flow_id:f5.flow_id, flow_name:f5.flow_name,
          create_date:'26/08/2026 09:00', start_date:'26/08/2026 09:00', end_date:'',
          steps: cloneSteps(f5, { 0:'Completed', 1:'Completed', 2:'Inprogress' }),
        });
      }
      if (f6){
        logs.push({
          trans_id:'T00002', flow_id:f6.flow_id, flow_name:f6.flow_name,
          create_date:'25/08/2026 14:00', start_date:'25/08/2026 14:00', end_date:'25/08/2026 14:12',
          steps: cloneSteps(f6, {}).map(s => Object.assign(s, { status:'Completed' })),
        });
      }
      return logs;
    }
  
    function seed() {
      const db = {
        rows: [
          { TYPE:'SYS_TYPE', CODE:'ENTITY',    NAME:'Entity',    DESCRIPTION:'ประเภทข้อมูลองค์กร / นิติบุคคล',            ORDER:'1', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'12/25/2023 10:07', UPDATE_BY:'SYSTEM', UPDATE_DATE:'12/25/2023 10:07' },
          { TYPE:'SYS_TYPE', CODE:'LEAD_TYPE', NAME:'Lead Type', DESCRIPTION:'ประเภทของลีด / ช่องทางแคมเปญ',              ORDER:'2', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'12/25/2023 10:07', UPDATE_BY:'SYSTEM', UPDATE_DATE:'12/25/2023 10:07' },
          { TYPE:'SYS_TYPE', CODE:'PROGRAM',   NAME:'Program',   DESCRIPTION:'แคตตาล็อกชื่อโปรแกรมทั้งหมดในระบบ',       ORDER:'3', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'SYS_TYPE', CODE:'PARAMETER', NAME:'Parameter', DESCRIPTION:'พจนานุกรม Base Key ที่ใช้ประกอบเงื่อนไข', ORDER:'4', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { TYPE:'ENTITY', CODE:'KA', NAME:'KA', DESCRIPTION:'KA entity', ORDER:'1', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'12/25/2023 10:07', UPDATE_BY:'SYSTEM', UPDATE_DATE:'12/25/2023 10:07' },
          { TYPE:'ENTITY', CODE:'AY', NAME:'AY', DESCRIPTION:'AYCAL entity', ORDER:'2', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'12/25/2023 10:07', UPDATE_BY:'SYSTEM', UPDATE_DATE:'12/25/2023 10:07' },
  
          { TYPE:'LEAD_TYPE', CODE:'CRM_X_SELL_POOL', NAME:'CRM_X_SELL_POOL', DESCRIPTION:'', ORDER:'1', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'LEAD_TYPE', CODE:'INS_PPI',         NAME:'INS_PPI',         DESCRIPTION:'', ORDER:'2', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'LEAD_TYPE', CODE:'EV_NETA',         NAME:'EV_NETA',         DESCRIPTION:'', ORDER:'3', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'LEAD_TYPE', CODE:'RETENTION',       NAME:'RETENTION',       DESCRIPTION:'', ORDER:'4', ACTIVE:'N', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { TYPE:'PROGRAM', CODE:'TOPUP',          NAME:'Topup',             DESCRIPTION:'สินเชื่อเพิ่มวงเงิน',        ORDER:'1', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'REVOLVING_LOAN', NAME:'Revolving Loan',    DESCRIPTION:'สินเชื่อหมุนเวียน',          ORDER:'2', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PRE_APPROVE_R',  NAME:'Pre-Approve (R)',   DESCRIPTION:'อนุมัติล่วงหน้า - Renew',    ORDER:'3', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PRE_APPROVE_NU', NAME:'Pre-Approve (N/U)', DESCRIPTION:'อนุมัติล่วงหน้า - New/Used', ORDER:'4', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PRE_APPROVE_MC', NAME:'Pre-Approve (MC)',  DESCRIPTION:'อนุมัติล่วงหน้า - MC',       ORDER:'5', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PRIVILEGE_NUR',  NAME:'Privilege (N/U/R)', DESCRIPTION:'สิทธิพิเศษ - N/U/R',          ORDER:'6', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PRIVILEGE_MC',   NAME:'Privilege (MC)',    DESCRIPTION:'สิทธิพิเศษ - MC',             ORDER:'7', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PPI_PA_LIFE',    NAME:'PPI_PA and LIFE',   DESCRIPTION:'ประกัน PA และ LIFE',          ORDER:'8', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PROGRAM', CODE:'PPI_PA',         NAME:'PPI_PA',            DESCRIPTION:'ประกัน PA',                   ORDER:'9', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { TYPE:'PARAMETER', CODE:'account_type',      NAME:'account_type',          DESCRIPTION:'ประเภทบัญชี',                  ORDER:'1',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'auto_group',         NAME:'auto_group',            DESCRIPTION:'กลุ่มรถยนต์',                  ORDER:'2',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'b_score_account',    NAME:'b_score_account',       DESCRIPTION:'B-Score ระดับบัญชี',           ORDER:'3',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'b_score_customer',   NAME:'b_score_customer',      DESCRIPTION:'B-Score ระดับลูกค้า',          ORDER:'4',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'b_score_m_customer', NAME:'B-Score band_MKT_Cust', DESCRIPTION:'B-Score ระดับลูกค้าฝั่งการตลาด', ORDER:'5', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'car_age',            NAME:'car_age',               DESCRIPTION:'อายุรถ',                       ORDER:'6',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'cash_offer',         NAME:'cash_offer',            DESCRIPTION:'วงเงินที่เสนอ',                ORDER:'7',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'iir',                NAME:'iir',                   DESCRIPTION:'Internal Interest Rate',       ORDER:'8',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'model_type_group',   NAME:'model_type_group',      DESCRIPTION:'กลุ่มรุ่นรถ',                  ORDER:'9',  ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'pay_slip',           NAME:'pay_slip',              DESCRIPTION:'สลิปเงินเดือน',                ORDER:'10', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'product_base',       NAME:'product_base',          DESCRIPTION:'ผลิตภัณฑ์หลัก',                ORDER:'11', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'receipt_term',       NAME:'receipt_term',          DESCRIPTION:'งวดการรับเอกสาร',              ORDER:'12', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'region',             NAME:'region',                DESCRIPTION:'ภูมิภาค',                      ORDER:'13', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { TYPE:'PARAMETER', CODE:'remaining_term',     NAME:'remaining_term',        DESCRIPTION:'งวดคงเหลือ',                  ORDER:'14', ACTIVE:'Y', DEPEND_ON:'', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
        ],
  
        assignments: [
          { ENTITY:'KA', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'TOPUP',          ORDER:'1', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'KA', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'REVOLVING_LOAN', ORDER:'2', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'KA', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'PRE_APPROVE_R',  ORDER:'3', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'KA', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'PRE_APPROVE_NU', ORDER:'4', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'KA', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'PRIVILEGE_NUR',  ORDER:'5', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'AY', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'TOPUP',          ORDER:'1', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'AY', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'PRE_APPROVE_R',  ORDER:'2', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'AY', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'PRE_APPROVE_MC', ORDER:'3', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'AY', LEAD_TYPE:'CRM_X_SELL_POOL', PROGRAM_CODE:'PRIVILEGE_MC',   ORDER:'4', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'KA', LEAD_TYPE:'INS_PPI',         PROGRAM_CODE:'PPI_PA_LIFE',    ORDER:'1', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { ENTITY:'AY', LEAD_TYPE:'INS_PPI',         PROGRAM_CODE:'PPI_PA',         ORDER:'1', STATUS:'Y', CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
        ],
  
        paramConfigs: [
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'TOPUP_OPTION',       PARAMETER_NAME:'Topup Option',      ORDER:'1',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer','cash_offer','iir','product_base'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'MAX_LTV',            PARAMETER_NAME:'Max LTV',           ORDER:'2',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer','product_base'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'RECEIPT_TERM',       PARAMETER_NAME:'Receipt Term',      ORDER:'3',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer','product_base'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'X_INSTALLMENT_OPT1', PARAMETER_NAME:'X Installment OPT1',ORDER:'4',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'X_INSTALLMENT_OPT2', PARAMETER_NAME:'X Installment OPT2',ORDER:'5',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'X_INSTALLMENT_OPT3', PARAMETER_NAME:'X Installment OPT3',ORDER:'6',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'X_INSTALLMENT_OPT4', PARAMETER_NAME:'X Installment OPT4',ORDER:'7',  ACTIVE:'Y', KEY_BASE:['b_score_m_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'FLAT_RATE_OPT1',     PARAMETER_NAME:'Flat rate OPTT1',   ORDER:'8',  ACTIVE:'Y', KEY_BASE:['b_score_account','product_base','auto_group','region'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'FLAT_RATE_OPT2',     PARAMETER_NAME:'Flat rate OPTT2',   ORDER:'9',  ACTIVE:'Y', KEY_BASE:['b_score_account','product_base','auto_group','region'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'FLAT_RATE_OPT3',     PARAMETER_NAME:'Flat rate OPTT3',   ORDER:'10', ACTIVE:'Y', KEY_BASE:['b_score_account','product_base','auto_group','region'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'FLAT_RATE_OPT4',     PARAMETER_NAME:'Flat rate OPTT4',   ORDER:'11', ACTIVE:'Y', KEY_BASE:['b_score_account','product_base','auto_group','region'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'NCB',                PARAMETER_NAME:'NCB',               ORDER:'12', ACTIVE:'Y', KEY_BASE:['b_score_m_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'TOPUP_OPTION',       PARAMETER_NAME:'Topup Option',      ORDER:'1', ACTIVE:'Y', KEY_BASE:['b_score_customer','auto_group','cash_offer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'MAX_LTV',            PARAMETER_NAME:'Max LTV',           ORDER:'2', ACTIVE:'Y', KEY_BASE:['b_score_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'X_INSTALLMENT_OPT1', PARAMETER_NAME:'X Installment OPT1',ORDER:'3', ACTIVE:'Y', KEY_BASE:['b_score_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'X_INSTALLMENT_OPT2', PARAMETER_NAME:'X Installment OPT2',ORDER:'4', ACTIVE:'Y', KEY_BASE:['b_score_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'X_INSTALLMENT_OPT3', PARAMETER_NAME:'X Installment OPT3',ORDER:'5', ACTIVE:'Y', KEY_BASE:['b_score_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'X_INSTALLMENT_OPT4', PARAMETER_NAME:'X Installment OPT4',ORDER:'6', ACTIVE:'Y', KEY_BASE:['b_score_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'FLAT_RATE_OPT1',     PARAMETER_NAME:'Flat rate OPTT1',   ORDER:'7', ACTIVE:'Y', KEY_BASE:['b_score_customer','model_type_group'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'FLAT_RATE_OPT2',     PARAMETER_NAME:'Flat rate OPTT2',   ORDER:'8', ACTIVE:'Y', KEY_BASE:['b_score_customer','model_type_group'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'FLAT_RATE_OPT3',     PARAMETER_NAME:'Flat rate OPTT3',   ORDER:'9', ACTIVE:'Y', KEY_BASE:['b_score_customer','model_type_group'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'FLAT_RATE_OPT4',     PARAMETER_NAME:'Flat rate OPTT4',   ORDER:'10',ACTIVE:'Y', KEY_BASE:['b_score_customer','model_type_group'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'AY', PARAMETER_CODE:'NCB',                PARAMETER_NAME:'NCB',               ORDER:'11',ACTIVE:'Y', KEY_BASE:['b_score_customer'], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { PROGRAM_CODE:'REVOLVING_LOAN', ENTITY:'KA', PARAMETER_CODE:'RL_OPTION',       PARAMETER_NAME:'Revolving Loan Option', ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'REVOLVING_LOAN', ENTITY:'KA', PARAMETER_CODE:'FLAT_RATE_TP_RH', PARAMETER_NAME:'Flat rate TP_RH',       ORDER:'2', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'REVOLVING_LOAN', ENTITY:'AY', PARAMETER_CODE:'RL_OPTION',       PARAMETER_NAME:'Revolving Loan Option', ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { PROGRAM_CODE:'PRE_APPROVE_R', ENTITY:'KA', PARAMETER_CODE:'PA_R_OPTION',     PARAMETER_NAME:'Pre-Approve (R) Option',     ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'PRE_APPROVE_R', ENTITY:'KA', PARAMETER_CODE:'PA_R_FLAT_RATE',  PARAMETER_NAME:'Pre-Approve (R) Flat Rate',  ORDER:'2', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'PRE_APPROVE_R', ENTITY:'AY', PARAMETER_CODE:'PA_R_OPTION',     PARAMETER_NAME:'Pre-Approve (R) Option',     ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { PROGRAM_CODE:'PRE_APPROVE_NU', ENTITY:'KA', PARAMETER_CODE:'PA_NU_OPTION',    PARAMETER_NAME:'Pre-Approve (N/U) Option',    ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'PRE_APPROVE_NU', ENTITY:'KA', PARAMETER_CODE:'PA_NU_FLAT_RATE', PARAMETER_NAME:'Pre-Approve (N/U) Flat Rate', ORDER:'2', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'PRE_APPROVE_NU', ENTITY:'AY', PARAMETER_CODE:'PA_NU_OPTION',    PARAMETER_NAME:'Pre-Approve (N/U) Option',    ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
  
          { PROGRAM_CODE:'PRE_APPROVE_MC', ENTITY:'KA', PARAMETER_CODE:'PA_MC_OPTION',    PARAMETER_NAME:'Pre-Approve (MC) Option',    ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'PRE_APPROVE_MC', ENTITY:'KA', PARAMETER_CODE:'PA_MC_FLAT_RATE', PARAMETER_NAME:'Pre-Approve (MC) Flat Rate', ORDER:'2', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'PRE_APPROVE_MC', ENTITY:'AY', PARAMETER_CODE:'PA_MC_OPTION',    PARAMETER_NAME:'Pre-Approve (MC) Option',    ORDER:'1', ACTIVE:'Y', KEY_BASE:[], CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
        ],
  
        criteriaRows: [
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'TOPUP_OPTION', VALUE:'TP_Option 1', ORDER:'1', ACTIVE:'Y',
            KEY_VALUES:{ b_score_m_customer:{ op:'IN', value:'1_VL,2_L,3_M,4_H,5_VH' }, cash_offer:{ op:'>=', value:'50000' }, iir:{ op:'N/A', value:'' }, product_base:{ op:'N/A', value:'' } },
            CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'TOPUP_OPTION', VALUE:'TP_Option 2', ORDER:'2', ACTIVE:'Y',
            KEY_VALUES:{ b_score_m_customer:{ op:'IN', value:'1_VL,2_L' }, cash_offer:{ op:'N/A', value:'' }, iir:{ op:'N/A', value:'' }, product_base:{ op:'IN', value:'New,Refin Topup' } },
            CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'TOPUP_OPTION', VALUE:'TP_Option 3', ORDER:'3', ACTIVE:'Y',
            KEY_VALUES:{ b_score_m_customer:{ op:'IN', value:'1_VL,2_L' }, cash_offer:{ op:'>=', value:'50000' }, iir:{ op:'>=', value:'2.40' }, product_base:{ op:'=', value:'Used' } },
            CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
          { PROGRAM_CODE:'TOPUP', ENTITY:'KA', PARAMETER_CODE:'MAX_LTV', VALUE:'LTV150', ORDER:'1', ACTIVE:'Y',
            KEY_VALUES:{ b_score_m_customer:{ op:'IN', value:'1_VL,2_L' }, product_base:{ op:'N/A', value:'' } },
            CREATE_BY:'SYSTEM', CREATE_DATE:'01/10/2024 09:00', UPDATE_BY:'SYSTEM', UPDATE_DATE:'01/10/2024 09:00' },
        ],
  
        cfgVersions: [
          { VERSION_ID:'V0001', PROGRAMS:['Topup','Revolving Loan','Pre-Approve (R)','Pre-Approve (N/U)','Pre-Approve (MC)'] },
        ],
  
        // filled in by later pages as they're converted (eligibility, workflows, worklist, executionLogs)
        eligibility: [
          { code:'EL00001', name:'X SELL POOL', profile:'X SELL POOL TOPUP 4W', desc:'Top-up pool for 4-wheel HP/AL customers', status:'Active', updated:'15/02/2025, 14:34', groups:defaultEligibilityGroups() },
          { code:'EL00002', name:'X SELL POOL', profile:'X SELL POOL TOPUP 2W', desc:'Top-up pool for 2-wheel motorcycle customers', status:'Active', updated:'12/02/2025, 09:12', groups:defaultEligibilityGroups() },
          { code:'EL00003', name:'Retention Refinance', profile:'X SELL POOL TOPUP 4W', desc:'Refinance retention base — 4W near-end term', status:'Active', updated:'08/02/2025, 16:45', groups:defaultEligibilityGroups() },
          { code:'EL00004', name:'PPI PA', profile:'X SELL POOL TOPUP 2W', desc:'PPI / PA insurance cross-sell base', status:'Draft', updated:'05/02/2025, 11:20', groups:defaultEligibilityGroups() },
          { code:'EL00005', name:'Insurance Motor', profile:'X SELL POOL TOPUP 4W', desc:'Motor insurance renewal lead pool', status:'Draft', updated:'01/02/2025, 10:05', groups:defaultEligibilityGroups() },
        ],
        eligibleNames: ['X SELL POOL','PPI PA','Insurance Motor','Retention Refinance','Priviledge'],
        eligibleProfiles: ['X SELL POOL','INSURANCE PPI_PA','INSURANCE MOTOR'],
        workflows: [
          { flow_id:'F00001', flow_name:'Select Base X_Sell_Pool (KA)', run_type:'AUTO', schedule:'0 1 * * *', steps:[
            { order:1, type:'AUTO', name:'mcrm_select_base_topup_tele', status:'Wait' },
            { order:2, type:'AUTO', name:'mcrm_select_base_topup_tele_config', status:'Wait' },
            { order:3, type:'AUTO', name:'mcrm_select_base_topup_rh', status:'Wait' },
            { order:4, type:'AUTO', name:'mcrm_select_base_topup_dtu', status:'Wait' },
            { order:5, type:'AUTO', name:'mcrm_select_base_preapprove_refin', status:'Wait' },
            { order:6, type:'AUTO', name:'mcrm_select_base_feedback', status:'Wait' },
          ] },
          { flow_id:'F00002', flow_name:'Select Base X_Sell_Pool (AY)', run_type:'AUTO', schedule:'30 2 * * 1-5', steps:[
            { order:1, type:'AUTO', name:'mcrm_select_base_topmc', status:'Wait' },
            { order:2, type:'AUTO', name:'mcrm_select_base_feedback', status:'Wait' },
          ] },
          { flow_id:'F00003', flow_name:'Gen X_SELL_POOL (by program)', run_type:'AUTO', schedule:'0 3 1,15 * *', steps:[
            { order:1, type:'AUTO', name:'DWH-program Topup', status:'Wait' },
            { order:2, type:'AUTO', name:'DWH-program Revolving loan', status:'Wait' },
            { order:3, type:'AUTO', name:'DWH-program Pre-Approve (R)', status:'Wait' },
            { order:4, type:'AUTO', name:'DWH-program Pre-Approve (N/U)', status:'Wait' },
            { order:5, type:'AUTO', name:'DWH-program Pre-Approve (MC)', status:'Wait' },
          ] },
          { flow_id:'F00004', flow_name:'Gen X_SELL_POOL (by parameter)', run_type:'AUTO', schedule:'*/30 * * * *', steps:[
            { order:1, type:'AUTO', name:'DWH-Max LTV', status:'Wait', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['MAX_LTV'] },
            { order:2, type:'AUTO', name:'DWH-Receipt Term', status:'Wait', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['RECEIPT_TERM'] },
            { order:3, type:'AUTO', name:'DWH-FOIR', status:'Wait', category:'PARAMETER' },
            { order:4, type:'AUTO', name:'DWH-Flat rate,Flat rate TP_RH', status:'Wait', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['FLAT_RATE_OPT1','FLAT_RATE_OPT2','FLAT_RATE_OPT3','FLAT_RATE_OPT4'] },
            { order:5, type:'AUTO', name:'DWH-Flat rate OPTT%', status:'Wait', category:'PARAMETER' },
            { order:6, type:'AUTO', name:'DWH-X Installment%', status:'Wait', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['X_INSTALLMENT_OPT1','X_INSTALLMENT_OPT2','X_INSTALLMENT_OPT3','X_INSTALLMENT_OPT4'] },
            { order:7, type:'AUTO', name:'DWH-NCB', status:'Wait', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['NCB'] },
            { order:8, type:'AUTO', name:'DWH-Minimum down payment', status:'Wait', category:'PARAMETER' },
            { order:9, type:'AUTO', name:'DWH-Minimum Credit line (Threshold)', status:'Wait', category:'PARAMETER' },
          ] },
          { flow_id:'F00005', flow_name:'Gen X_SELL_POOL (Final)', run_type:'MANUAL', schedule:null, steps:[
            { order:1, type:'AUTO', name:'Inquiry Data X Sell Pool', detail:'Retain all condition columns defined in the proposal that filter basic conditions', category:'ELIGIBLE', code:'EL00001', status:'Wait' },
            { order:2, type:'AUTO', name:'Update data of Topup program per parameter', detail:'update Loan offer Parameters for Topup, parameter:all(exclude: Flat rate%)', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['TOPUP_OPTION','MAX_LTV','RECEIPT_TERM','X_INSTALLMENT_OPT1','X_INSTALLMENT_OPT2','X_INSTALLMENT_OPT3','X_INSTALLMENT_OPT4','NCB'], status:'Wait' },
            { order:3, type:'AUTO', name:'dev-mcrm-program-topup-flat-rate1', detail:'update Loan offer Parameters for Topup, parameter:Flat rate option 1', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['FLAT_RATE_OPT1'], status:'Wait' },
            { order:4, type:'AUTO', name:'dev-mcrm-program-topup-flat-rate2', detail:'update Loan offer Parameters for Flat rate option 2', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['FLAT_RATE_OPT2'], status:'Wait' },
            { order:5, type:'AUTO', name:'dev-mcrm-program-topup-flat-rate3', detail:'update Loan offer Parameters for Flat rate option 3', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['FLAT_RATE_OPT3'], status:'Wait' },
            { order:6, type:'AUTO', name:'dev-mcrm-program-topup-flat-rate4', detail:'update Loan offer Parameters for Flat rate option 4', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'TOPUP', params:['FLAT_RATE_OPT4'], status:'Wait' },
            { order:7, type:'AUTO', name:'dev-mcrm-program-revolving-loan', detail:'update program Loan offer Parameters for revoling Loan', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'REVOLVING_LOAN', params:['RL_OPTION'], status:'Wait' },
            { order:8, type:'AUTO', name:'dev-mcrm-program-revolving-loan-flat-rate-tp_rh', detail:'update Loan offer Parameters for Flat Rate', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'REVOLVING_LOAN', params:['FLAT_RATE_TP_RH'], status:'Wait' },
            { order:9, type:'AUTO', name:'dev-mcrm-program-pre-approve-r', detail:'Update Loan offer Parameters for pre-approve r', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'PRE_APPROVE_R', params:['PA_R_OPTION'], status:'Wait' },
            { order:10, type:'AUTO', name:'dev-mcrm-program-pre-approve-r-flat-rate', detail:'Update Loan offer Parameters for flat-rate pre-approve r', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'PRE_APPROVE_R', params:['PA_R_FLAT_RATE'], status:'Wait' },
            { order:11, type:'AUTO', name:'dev-mcrm-program-pre-approve-nu', detail:'Update Loan offer Parameters for pre-approve N/U', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'PRE_APPROVE_NU', params:['PA_NU_OPTION'], status:'Wait' },
            { order:12, type:'AUTO', name:'dev-mcrm-program-pre-approve-nu-flat-rate', detail:'Update Loan offer Parameters for flat-rate pre-approve N/U', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'PRE_APPROVE_NU', params:['PA_NU_FLAT_RATE'], status:'Wait' },
            { order:13, type:'AUTO', name:'dev-mcrm-program-pre-approve-mc', detail:'Update Loan offer Parameters for pre-approve MC', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'PRE_APPROVE_MC', params:['PA_MC_OPTION'], status:'Wait' },
            { order:14, type:'AUTO', name:'dev-mcrm-program-pre-approve-mc-flat-rate', detail:'Update Loan offer Parameters for pre-approve MC flag rate', category:'PARAMETER', leadType:'CRM_X_SELL_POOL', entity:'KA', program:'PRE_APPROVE_MC', params:['PA_MC_FLAT_RATE'], status:'Wait' },
            { order:15, type:'AUTO', name:'dev-mcrm-cap-max-special-criteria', detail:'Run special logic of Cap Max Flat Rate and Max LTV for Topup program', category:'PARAMETER', code:'', status:'Wait' },
            { order:16, type:'AUTO', name:'credit line calculations Top up programs (X Sell Pool)', detail:'calculate credit line and cash offer', category:'PARAMETER', code:'', status:'Wait' },
            { order:17, type:'AUTO', name:'credit line calculations Revolving Loan programs (X Sell Pool)', detail:'', category:'PARAMETER', code:'', status:'Wait' },
            { order:18, type:'AUTO', name:'credit line calculations Pre-Approve (R) programs (X Sell Pool)', detail:'', category:'PARAMETER', code:'', status:'Wait' },
            { order:19, type:'AUTO', name:'credit line calculations Pre-Approve (N/U) programs (X Sell Pool)', detail:'', category:'PARAMETER', code:'', status:'Wait' },
            { order:20, type:'AUTO', name:'Flag Program Top up', detail:'Flag Program Top up', category:'PARAMETER', code:'', status:'Wait' },
            { order:21, type:'AUTO', name:'Flag Program Revolving Loan', detail:'Flag Program Revolving Loan', category:'PARAMETER', code:'', status:'Wait' },
            { order:22, type:'AUTO', name:'Flag Program Pre-Approve (R)', detail:'Flag Program Pre-Approve (R)', category:'PARAMETER', code:'', status:'Wait' },
            { order:23, type:'AUTO', name:'Flag Program Pre-Approve (N/U) ', detail:'Flag Program Pre-Approve (N/U) ', category:'PARAMETER', code:'', status:'Wait' },
          ] },
          { flow_id:'F00006', flow_name:'GEN LEAD INS_PPI', run_type:'MANUAL', schedule:null, steps:[
            { order:1,  type:'AUTO', name:'STEP 0',  detail:'BASE LEAD (No Condition)', category:'ELIGIBLE', code:'EL00001', status:'Wait' },
            { order:2,  type:'AUTO', name:'STEP 1',  detail:'SUPPRESS AGE,REMAINING_TERM,DELINQUENCY,TOTAL_INCOME,BLACKLIST', category:'ELIGIBLE', code:'EL00002', status:'Wait' },
            { order:3,  type:'AUTO', name:'STEP 2',  detail:'SUPPRESS BILL CODE', category:'ELIGIBLE', code:'EL00003', status:'Wait' },
            { order:4,  type:'AUTO', name:'STEP 3',  detail:'SUPPRESS DEBT_RE + VR', category:'ELIGIBLE', code:'EL00004', status:'Wait' },
            { order:5,  type:'AUTO', name:'STEP 4',  detail:'SUPPRESS PPI_EFFECTIVE', category:'ELIGIBLE', code:'EL00005', status:'Wait' },
            { order:6,  type:'AUTO', name:'STEP 5',  detail:'SUPPRESS INSURANCE_PPI', category:'ELIGIBLE', code:'EL00001', status:'Wait' },
            { order:7,  type:'AUTO', name:'STEP 6',  detail:'SUPPRESS CONSENT (Customer Level)', category:'ELIGIBLE', code:'EL00002', status:'Wait' },
            { order:8,  type:'AUTO', name:'STEP 7',  detail:'SUPPRESS PPI ACTIVE', category:'ELIGIBLE', code:'EL00003', status:'Wait' },
            { order:9,  type:'AUTO', name:'STEP 8',  detail:'SUPPRESS PPI CANCEL', category:'ELIGIBLE', code:'EL00004', status:'Wait' },
            { order:10, type:'AUTO', name:'STEP 9',  detail:'SUPPRESS WRITE_OFF_TYPE', category:'ELIGIBLE', code:'EL00005', status:'Wait' },
            { order:11, type:'AUTO', name:'STEP 10', detail:'SUPPRESS CUSTOMER_WRITE_OFF_TYPE', category:'ELIGIBLE', code:'EL00001', status:'Wait' },
            { order:12, type:'AUTO', name:'STEP 11', detail:'SUPPRESS ADVANCE PERIOD', category:'ELIGIBLE', code:'EL00002', status:'Wait' },
            { order:13, type:'AUTO', name:'STEP 12', detail:'PREPARE FOR REGISTER INS PPI', category:'ELIGIBLE', code:'EL00003', status:'Wait' },
          ] },
        ],
        worklist: [],
        executionLogs: [],
      };
      db.executionLogs = buildExecutionLogsSeed(db.workflows);
      return db;
    }
  
    function loadDb() {
      const base = seed();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          Object.keys(base).forEach(key => {
            if (saved && Object.prototype.hasOwnProperty.call(saved, key)) base[key] = saved[key];
          });
        }
      } catch (e) {
        console.warn('MCRM store: failed to read localStorage, using defaults', e);
      }
      return base;
    }
  
    const db = Vue.reactive(loadDb());
  
    function persist() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
      catch (e) { console.warn('MCRM store: failed to persist to localStorage', e); }
    }
  
    // auto-save on every mutation
    Vue.watch(db, persist, { deep: true });
  
    // pick up changes made by another tab / iframe writing to the same key
    global.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const saved = JSON.parse(e.newValue);
        Object.keys(db).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(saved, key)) db[key] = saved[key];
        });
      } catch (err) { /* ignore malformed payloads */ }
    });
  
    function resetToDefaults() {
      const fresh = seed();
      Object.keys(db).forEach(key => { db[key] = fresh[key]; });
      persist();
    }
  
    global.MCRM = {
      db,
      persist,
      resetToDefaults,
      nowStr,
      TXT, NUM,
      FIELD_META,
      FIELD_GROUP_LAYOUT,
      // generic helpers shared across pages
      nameOf(list, code) { return (list.find(x => x.CODE === code)?.NAME) || code; },
      slugify(s) { return String(s).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); },
    };
  })(window);
  
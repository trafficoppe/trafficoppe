/**
 * CCTV Request System v2 — แยกหน่วยงาน MLC / LA / PMH  (ไฟล์หลังบ้านสำหรับ Sheet ทดสอบ)
 * ---------------------------------------------------------------------------------------
 * สถานะ: ร่างสำหรับตรวจทาน ยังไม่ได้ Deploy และยังไม่ได้รันกับ Sheet ใด
 *        ทดสอบแล้วเฉพาะฟังก์ชันคำนวณด้วยข้อมูลสมมติ (v2/tests/cctv.test.js)
 *
 * สิ่งที่ไฟล์นี้ทำ
 *  - บันทึกคำขอแยกแท็บตามหน่วยงาน: REQ_MLC, REQ_LA, REQ_PMH (+ REQ_CENTRAL สำหรับข้อมูลเดิมของส่วนกลาง)
 *  - แท็บ ALL_REQUESTS รวมทุกหน่วยงานด้วยสูตร (อ่านอย่างเดียว) และ STATS สำหรับสถิติรวม
 *  - แท็บ UNIT_OFFICERS กำหนดเจ้าหน้าที่ผู้รับผิดชอบแยกหน่วยงาน (ตอนนี้เป็น placeholder)
 *  - แท็บ NOTIFY_QUEUE เก็บ "คิวแจ้งเตือน" — ยังไม่ส่งอีเมล/ข้อความจริง (NOTIFY_SEND_ENABLED = false)
 *  - API สาธารณะ (?action=stats) ส่งเฉพาะยอดรวม ไม่ส่งชื่อ/เลขบัตร/เบอร์โทร
 *
 * สิ่งที่ไฟล์นี้ไม่ทำ
 *  - ไม่แตะ Sheet จริง “CCTV Request System - มหาวิทยาลัยมหิดล” (setup() จะหยุดทันทีถ้าชี้ไปที่ไฟล์นั้น)
 *  - ไม่มีรหัสผ่านในโค้ด: รหัสผู้ดูแลเก็บเป็นค่า hash ใน Script Properties
 *
 * Script Properties ที่ต้องตั้ง (Project Settings → Script properties)
 *   CCTV_V2_SHEET_ID   = ID ของ Sheet ทดสอบ (ไฟล์ใหม่หรือสำเนา ห้ามใช้ไฟล์จริง)
 *   LEGACY_SHEET_ID    = ID ของ Sheet เดิม (ใช้เฉพาะ migrateLegacyDryRun ซึ่งอ่านอย่างเดียว)
 *   ADMIN_TOKEN_SHA256 = ค่า SHA-256 (hex) ของรหัสผู้ดูแล — สร้างด้วย makeAdminHash('รหัสใหม่') แล้วคัดลอกจาก Log
 *   ALLOW_MIGRATION    = yes  (ตั้งเฉพาะตอนจะคัดลอกข้อมูลเดิมเข้า Sheet ใหม่จริง)
 */
var CCTV = {
  TZ: 'Asia/Bangkok',
  PRODUCTION_SHEET_ID: '1y1opqw6CWILLoaLf-JMJIm2HLzx6Nlv8kvBmtUWZtPE',
  NOTIFY_SEND_ENABLED: false,
  UNITS: {
    MLC: { tab: 'REQ_MLC', name: 'อาคารศูนย์การเรียนรู้มหิดล (MLC)' },
    LA: { tab: 'REQ_LA', name: 'อาคารสิริวิทยา (LA)' },
    PMH: { tab: 'REQ_PMH', name: 'มหิดลสิทธาคาร (PMH)' },
    CEN: { tab: 'REQ_CENTRAL', name: 'ส่วนกลาง (งานจราจรและความปลอดภัย)' }
  },
  /* 44 คอลัมน์เดิมของ CCTV_Requests ตามลำดับเดิมทุกประการ (ใช้ชื่อเดิมเพื่อย้ายข้อมูลได้ตรงคอลัมน์) */
  LEGACY_HEADERS: ['refCode', 'timestamp', 'pdpaConsent', 'prefix', 'fname', 'lname', 'gender', 'requesterType', 'idCard', 'faculty', 'muEmail', 'officialOrg', 'officialDoc', 'phone', 'email', 'purpose', 'purposeDetail', 'evidenceTypes', 'dateStart', 'timeStart', 'dateEnd', 'timeEnd', 'locations', 'vehiclePlate', 'vehicleDesc', 'requestFile', 'fileReason', 'deliveryMethod', 'docs', 'attachedFiles', 'additionalNote', 'urgency', 'serviceOfficerName', 'serviceOfficerEmail', 'officerName', 'cctvResult', 'footageFound', 'fileGiven', 'actionTaken', 'closedDate', 'satisfactionScore', 'officerNote', 'status', 'พบภาพ/ไม่พบภาพ'],
  EXTRA_HEADERS: ['unit', 'unitName', 'formVersion', 'legacyRow'],          // ต่อท้าย เพื่อไม่ให้ตำแหน่งคอลัมน์เดิมเลื่อน
  MAX_FIELD: 2000
};
function headers_() { return CCTV.LEGACY_HEADERS.concat(CCTV.EXTRA_HEADERS); }

/* ============================== ฟังก์ชันคำนวณ (ทดสอบได้นอก Apps Script) ============================== */
function normalizeUnit(v) {
  var u = String(v == null ? '' : v).trim().toUpperCase();
  return (u && Object.prototype.hasOwnProperty.call(CCTV.UNITS, u)) ? u : '';
}
/** ตรวจข้อมูลขั้นต่ำฝั่งเซิร์ฟเวอร์ — คืน {ok, unit, errors[]} */
function validatePayload(p) {
  var e = [], unit = normalizeUnit(p && p.unit);
  if (!p || typeof p !== 'object') return { ok: false, unit: '', errors: ['รูปแบบข้อมูลไม่ถูกต้อง'] };
  if (!unit || unit === 'CEN') e.push('ไม่ได้ระบุหน่วยงาน (MLC / LA / PMH)');
  if (!/^CCTV-[A-Z]{2,3}-\d{8}-[A-Z0-9]{4}$/.test(String(p.refCode || ''))) e.push('เลขอ้างอิงไม่ถูกต้อง');
  else if (unit && String(p.refCode).split('-')[1] !== unit) e.push('เลขอ้างอิงไม่ตรงกับหน่วยงาน');
  ['fname', 'lname', 'requesterType', 'phone', 'dateStart', 'locations'].forEach(function (k) { if (!String(p[k] || '').trim()) e.push('ขาดข้อมูล: ' + k); });
  if (p.pdpaConsent !== 'ยินยอม') e.push('ยังไม่ได้ยินยอม PDPA');
  return { ok: e.length === 0, unit: unit, errors: e };
}
/** ป้องกันสูตรแฝง (formula injection) และตัดความยาว */
function clean(v) {
  var s = String(v == null ? '' : v).slice(0, CCTV.MAX_FIELD);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
function rowFromPayload(p, unit) {
  return headers_().map(function (h) {
    if (h === 'unit') return unit;
    if (h === 'unitName') return CCTV.UNITS[unit].name;
    if (h === 'formVersion') return 'v2';
    if (h === 'legacyRow') return '';
    if (h === 'status') return 'รอดำเนินการ';
    if (h === 'พบภาพ/ไม่พบภาพ' || ['officerName', 'cctvResult', 'footageFound', 'fileGiven', 'actionTaken', 'closedDate', 'satisfactionScore', 'officerNote'].indexOf(h) >= 0) return '';
    return clean(p[h]);
  });
}
/** จับคู่แถวเดิมกับหน่วยงาน: ข้อมูลเดิมไม่มีคอลัมน์หน่วยงาน จึงจัดเป็น CEN เสมอ และ "แนะนำ" หน่วยงานจากชื่อสถานที่ให้คนตรวจเท่านั้น */
function mapLegacyRow(row, rowNumber) {
  var loc = String(row[22] || ''), hint = /ศูนย์การเรียนรู้|MLC/i.test(loc) ? 'MLC' : /สิริวิทยา/.test(loc) ? 'LA' : /สิทธาคาร|PMH/i.test(loc) ? 'PMH' : '';
  var out = CCTV.LEGACY_HEADERS.map(function (_, i) { return row[i] == null ? '' : row[i]; });
  return { unit: 'CEN', suggestedUnit: hint, row: out.concat(['CEN', CCTV.UNITS.CEN.name, 'legacy', rowNumber]) };
}
/** สถิติรวม (ไม่มีข้อมูลรายบุคคล) จากแถวของทุกแท็บ */
function statsFromRows(rows, tz) {
  var H = headers_(), iUnit = H.indexOf('unit'), iStatus = H.indexOf('status'), iTs = H.indexOf('timestamp'), iRef = H.indexOf('refCode'), iFound = H.indexOf('พบภาพ/ไม่พบภาพ');
  var out = { total: 0, byUnit: {}, byStatus: {}, byUnitStatus: {}, byMonth: {}, footage: { 'พบ': 0, 'ไม่พบ': 0, 'ไม่ได้ระบุ': 0 } };
  Object.keys(CCTV.UNITS).forEach(function (u) { out.byUnit[u] = 0; out.byUnitStatus[u] = {}; });
  rows.forEach(function (r) {
    if (!String(r[iRef] || '').trim()) return;
    var u = normalizeUnit(r[iUnit]) || 'CEN', s = String(r[iStatus] || '').trim() || 'รอดำเนินการ', d = new Date(r[iTs]), f = String(r[iFound] || '').trim();
    out.total++; out.byUnit[u]++; out.byStatus[s] = (out.byStatus[s] || 0) + 1; out.byUnitStatus[u][s] = (out.byUnitStatus[u][s] || 0) + 1;
    out.footage[f === 'พบ' || f === 'ไม่พบ' ? f : 'ไม่ได้ระบุ']++;
    if (!isNaN(d)) { var m = monthKey_(d, tz); out.byMonth[m] = (out.byMonth[m] || 0) + 1; }
  });
  return out;
}
function monthKey_(d, tz) {
  if (typeof Utilities !== 'undefined') return Utilities.formatDate(d, tz, 'yyyy-MM');
  var p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
  return p.year + '-' + p.month;
}
/** ผู้รับแจ้งเตือนของหน่วยงาน จากแถวในแท็บ UNIT_OFFICERS: [unit, role, name, email, notify(TRUE/FALSE), note] */
function recipientsFor(unit, officerRows) {
  return officerRows.filter(function (r) { return normalizeUnit(r[0]) === unit && String(r[4]).toUpperCase() === 'TRUE' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r[3] || '')) && !/example\.|placeholder/i.test(String(r[3])); })
    .map(function (r) { return String(r[3]).trim(); });
}

/* ============================== ส่วนที่ทำงานใน Apps Script ============================== */
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('CCTV_V2_SHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า CCTV_V2_SHEET_ID');
  if (id === CCTV.PRODUCTION_SHEET_ID) throw new Error('CCTV_V2_SHEET_ID ชี้ไปที่ Sheet จริง — ต้องใช้ Sheet ทดสอบเท่านั้น');
  return SpreadsheetApp.openById(id);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** สร้างโครงสร้างแท็บใน Sheet ทดสอบ (รันครั้งเดียว รันซ้ำได้ ไม่ลบข้อมูล) */
function setup() {
  var ss = ss_(), H = headers_(), last = columnLetter_(H.length);
  Object.keys(CCTV.UNITS).forEach(function (u) { ensureTab_(ss, CCTV.UNITS[u].tab, H); });
  var all = ensureTab_(ss, 'ALL_REQUESTS', H);
  if (!all.getRange('A2').getFormula()) {
    var parts = Object.keys(CCTV.UNITS).map(function (u) { return "'" + CCTV.UNITS[u].tab + "'!A2:" + last; }).join(';');
    all.getRange('A2').setFormula('=IFERROR(QUERY({' + parts + '},"select * where Col1 is not null",0),"")');
  }
  var off = ensureTab_(ss, 'UNIT_OFFICERS', ['unit', 'role', 'name', 'email', 'notify', 'note']);
  if (off.getLastRow() < 2) off.getRange(2, 1, 3, 6).setValues([
    ['MLC', 'ผู้รับผิดชอบหลัก', '(รอรายชื่อ)', 'placeholder-mlc@example.invalid', false, 'placeholder — ยังไม่ส่งจริง'],
    ['LA', 'ผู้รับผิดชอบหลัก', '(รอรายชื่อ)', 'placeholder-la@example.invalid', false, 'placeholder — ยังไม่ส่งจริง'],
    ['PMH', 'ผู้รับผิดชอบหลัก', '(รอรายชื่อ)', 'placeholder-pmh@example.invalid', false, 'placeholder — ยังไม่ส่งจริง']]);
  ensureTab_(ss, 'NOTIFY_QUEUE', ['queuedAt', 'unit', 'refCode', 'recipients', 'state', 'note']);
  var st = ensureTab_(ss, 'STATS', ['หน่วยงาน', 'คำขอทั้งหมด', 'รอดำเนินการ', 'ปิดเคส']);
  if (st.getLastRow() < 2) Object.keys(CCTV.UNITS).forEach(function (u, i) {
    var t = "'" + CCTV.UNITS[u].tab + "'", iS = columnLetter_(H.indexOf('status') + 1);
    st.getRange(i + 2, 1, 1, 4).setFormulas([['="' + CCTV.UNITS[u].name + '"', '=COUNTA(' + t + '!A2:A)', '=COUNTIF(' + t + '!' + iS + '2:' + iS + ',"รอดำเนินการ")', '=COUNTIF(' + t + '!' + iS + '2:' + iS + ',"ปิดเคส")']]);
  });
  Logger.log('สร้างโครงสร้างใน Sheet ทดสอบ “' + ss.getName() + '” เรียบร้อย');
}
function ensureTab_(ss, name, header) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function columnLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents || '{}');
    if (p.action === 'adminList') return adminList_(p);
    var v = validatePayload(p);
    if (!v.ok) return json_({ ok: false, errors: v.errors });
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var ss = ss_(), sh = ss.getSheetByName(CCTV.UNITS[v.unit].tab);
      if (!sh) throw new Error('ยังไม่ได้รัน setup()');
      var refs = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
      if (refs.indexOf(p.refCode) >= 0) return json_({ ok: true, refCode: p.refCode, duplicate: true });       // ส่งซ้ำ: ไม่บันทึกซ้ำ
      sh.appendRow(rowFromPayload(p, v.unit));
      queueNotification_(ss, v.unit, p.refCode);
    } finally { lock.releaseLock(); }
    return json_({ ok: true, refCode: p.refCode, unit: v.unit });
  } catch (err) { return json_({ ok: false, errors: ['ระบบขัดข้อง กรุณาลองใหม่'] }); }
}
/** เข้าคิวแจ้งเตือน — ยังไม่ส่งจริงจนกว่า NOTIFY_SEND_ENABLED = true และมีผู้รับที่ไม่ใช่ placeholder */
function queueNotification_(ss, unit, refCode) {
  var rows = ss.getSheetByName('UNIT_OFFICERS').getDataRange().getValues().slice(1), to = recipientsFor(unit, rows);
  var state = !CCTV.NOTIFY_SEND_ENABLED ? 'QUEUED_NOT_SENT (ปิดการส่ง)' : to.length ? 'READY' : 'NO_RECIPIENT';
  ss.getSheetByName('NOTIFY_QUEUE').appendRow([new Date(), unit, refCode, to.join(', '), state, 'ไม่มีข้อมูลผู้ขอในคิวนี้']);
  /* จุดเชื่อมต่อในอนาคต: เมื่อเปิดใช้ ให้ส่งเฉพาะ "เลขอ้างอิง + หน่วยงาน + ลิงก์หน้าผู้ดูแล" ห้ามใส่ชื่อ/เลขบัตร/เบอร์โทรในอีเมล */
}
function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || 'health';
  if (a === 'health') return json_({ ok: true, version: 'cctv-v2-draft', now: new Date().toISOString() });
  if (a === 'stats') {
    var ss = ss_(), rows = [];
    Object.keys(CCTV.UNITS).forEach(function (u) { var sh = ss.getSheetByName(CCTV.UNITS[u].tab); if (sh && sh.getLastRow() > 1) rows = rows.concat(sh.getRange(2, 1, sh.getLastRow() - 1, headers_().length).getValues()); });
    return json_({ ok: true, generatedAt: new Date().toISOString(), stats: statsFromRows(rows, CCTV.TZ) });
  }
  return json_({ ok: false, errors: ['ไม่รู้จักคำสั่ง'] });      // ไม่มี getData แบบไม่ล็อกอินเหมือนระบบเดิม
}
function sha256Hex_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function makeAdminHash(secret) { Logger.log(sha256Hex_(String(secret))); }
/** รายการของหน่วยงานเดียว สำหรับผู้ดูแลที่มีรหัส (ตรวจฝั่งเซิร์ฟเวอร์) */
function adminList_(p) {
  var want = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN_SHA256'), unit = normalizeUnit(p.unit);
  if (!want || sha256Hex_(String(p.token || '')) !== want) return json_({ ok: false, errors: ['ไม่ได้รับอนุญาต'] });
  if (!unit) return json_({ ok: false, errors: ['ต้องระบุหน่วยงาน'] });
  var sh = ss_().getSheetByName(CCTV.UNITS[unit].tab);
  return json_({ ok: true, unit: unit, headers: headers_(), rows: sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, headers_().length).getDisplayValues() : [] });
}

/* ============================== การย้ายข้อมูลเดิม ============================== */
/** อ่าน Sheet เดิมแบบอ่านอย่างเดียว แล้วรายงานว่าแต่ละแถวจะไปอยู่แท็บใด — ไม่เขียนอะไรเลย */
function migrateLegacyDryRun() {
  var id = PropertiesService.getScriptProperties().getProperty('LEGACY_SHEET_ID');
  var sh = SpreadsheetApp.openById(id).getSheetByName('CCTV_Requests'), v = sh.getDataRange().getValues(), head = v[0].map(String);
  var same = CCTV.LEGACY_HEADERS.every(function (h, i) { return head[i] === h; });
  Logger.log('หัวตารางตรงกับที่คาดไว้: ' + same + ' | จำนวนแถวข้อมูล: ' + (v.length - 1));
  if (!same) { Logger.log('หยุด: โครงสร้างคอลัมน์เปลี่ยนไปจากที่สำรวจไว้ ต้องตรวจก่อนย้าย'); return; }
  v.slice(1).forEach(function (r, i) { if (!String(r[0] || '').trim()) return; var m = mapLegacyRow(r, i + 2); Logger.log('แถว ' + (i + 2) + ' → ' + CCTV.UNITS[m.unit].tab + (m.suggestedUnit ? ' (สถานที่ใกล้เคียงหน่วยงาน ' + m.suggestedUnit + ' — ให้เจ้าหน้าที่ยืนยัน)' : '')); });
}
/** คัดลอกข้อมูลเดิมเข้า REQ_CENTRAL ของ Sheet ใหม่ (ไม่ลบ/ไม่แก้ Sheet เดิม) — ทำงานเมื่อ ALLOW_MIGRATION = yes เท่านั้น */
function migrateLegacyCopy() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ALLOW_MIGRATION') !== 'yes') throw new Error('ยังไม่ได้อนุญาตการย้ายข้อมูล (ALLOW_MIGRATION)');
  var src = SpreadsheetApp.openById(props.getProperty('LEGACY_SHEET_ID')).getSheetByName('CCTV_Requests').getDataRange().getValues();
  var dst = ss_().getSheetByName(CCTV.UNITS.CEN.tab), H = headers_(), iLegacy = H.indexOf('legacyRow');
  var done = dst.getLastRow() > 1 ? dst.getRange(2, iLegacy + 1, dst.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var rows = [];
  src.slice(1).forEach(function (r, i) { if (!String(r[0] || '').trim() || done.indexOf(String(i + 2)) >= 0) return; rows.push(mapLegacyRow(r, i + 2).row); });
  if (rows.length) dst.getRange(dst.getLastRow() + 1, 1, rows.length, H.length).setValues(rows);
  Logger.log('คัดลอก ' + rows.length + ' แถว | แถวข้อมูลใน Sheet เดิม ' + (src.length - 1) + ' | ใน REQ_CENTRAL หลังคัดลอก ' + (dst.getLastRow() - 1));
}

if (typeof module !== 'undefined') module.exports = { CCTV: CCTV, headers_: headers_, normalizeUnit: normalizeUnit, validatePayload: validatePayload, clean: clean, rowFromPayload: rowFromPayload, mapLegacyRow: mapLegacyRow, statsFromRows: statsFromRows, recipientsFor: recipientsFor };

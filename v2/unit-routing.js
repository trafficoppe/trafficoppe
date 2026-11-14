/* unit-routing.js — กำหนดหน่วยงานของคำขอจาก URL ตั้งแต่เริ่มกรอก
 *   index.html?unit=mlc | ?unit=la | ?unit=pmh   (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
 * ถ้าไม่มี/ไม่ถูกต้อง จะแสดงหน้าเลือกหน่วยงานและซ่อนแบบฟอร์ม เพื่อไม่ให้คำขอถูกบันทึกผิดหน่วยงาน */
(function () {
  'use strict';
  var units = window.CCTV_UNITS || [];
  var q = (new URLSearchParams(location.search).get('unit') || '').trim().toLowerCase();
  var unit = units.filter(function (u) { return u.slug === q || u.code.toLowerCase() === q; })[0] || null;
  var form = document.getElementById('cctvForm'), bar = document.getElementById('unitBar'), chooser = document.getElementById('unitChooser');
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }

  var live = !!(window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.scriptUrl);
  document.getElementById('testModeBar').hidden = live;

  if (!unit) {
    if (form) form.style.display = 'none';
    chooser.hidden = false;
    chooser.appendChild(node('h2', '', 'เลือกหน่วยงานที่ต้องการขอดูกล้องวงจรปิด'));
    chooser.appendChild(node('p', '', q ? 'ไม่พบหน่วยงาน “' + q + '” กรุณาเลือกจากรายการด้านล่าง' : 'คำขอจะถูกส่งถึงเจ้าหน้าที่ของหน่วยงานที่เลือกเท่านั้น'));
    var grid = node('div', 'unit-grid');
    units.forEach(function (u) {
      var a = node('a', 'unit-card', u.nameTh); a.href = '?unit=' + u.slug; a.appendChild(node('small', '', u.nameEn)); grid.appendChild(a);
    });
    chooser.appendChild(grid);
    return;
  }

  window.CCTV_UNIT = unit;
  bar.hidden = false;
  var left = node('span'); left.appendChild(document.createTextNode('หน่วยงานที่รับคำขอ: ')); left.appendChild(node('strong', '', unit.nameTh));
  var change = node('a', '', 'เปลี่ยนหน่วยงาน'); change.href = location.pathname;
  bar.appendChild(left); bar.appendChild(change);
  document.title = 'ขอดูกล้องวงจรปิด – ' + unit.nameTh;

  /* รายชื่อเจ้าหน้าที่: ใช้เฉพาะของหน่วยงานนี้ (ไม่ปนกับรายชื่อส่วนกลางเดิม) */
  try {
    if (typeof OFFICER_DB !== 'undefined' && Array.isArray(OFFICER_DB)) {
      OFFICER_DB.length = 0;
      (unit.officers || []).forEach(function (o) { OFFICER_DB.push({ name: o.name, email: o.email }); });
      if (!OFFICER_DB.length) {
        var sec = document.getElementById('officerKnownSection');
        if (sec) sec.appendChild(node('p', 'unit-officer-hint', 'ยังไม่ได้กำหนดรายชื่อเจ้าหน้าที่ของ ' + unit.nameTh + ' — กรุณาเลือก “อื่นๆ” แล้วกรอกชื่อและอีเมลเจ้าหน้าที่ผู้ให้บริการ'));
      }
    }
  } catch (e) { /* รายชื่อเดิมไม่อยู่ในขอบเขตที่แก้ได้ — ปล่อยตามเดิม */ }
})();

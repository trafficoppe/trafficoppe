/* units.js — รายการหน่วยงานของระบบขอดูกล้องวงจรปิด (แหล่งเดียวที่ใช้ทั้งหน้าแบบฟอร์ม และหน้า QR)
 * เพิ่ม/แก้หน่วยงานที่ไฟล์นี้ที่เดียว แล้วแก้ค่าเดียวกันใน apps-script/Code.gs (CCTV.UNITS)
 * officers: รายชื่อเจ้าหน้าที่ผู้ให้บริการที่แสดงในแบบฟอร์ม — เว้นว่างไว้จนกว่าจะได้รับรายชื่อจริง
 *           รูปแบบ { name: 'ชื่อ-นามสกุล', email: 'อีเมลหน่วยงาน' }  (ห้ามใส่เบอร์โทร/ข้อมูลส่วนตัวอื่น)
 */
window.CCTV_UNITS = [
  { code: 'MLC', slug: 'mlc', nameTh: 'อาคารศูนย์การเรียนรู้มหิดล (MLC)', nameEn: 'Mahidol Learning Center (MLC)', officers: [] },
  { code: 'LA',  slug: 'la',  nameTh: 'อาคารสิริวิทยา (LA)',              nameEn: 'Sirivithaya Building (LA)',     officers: [] },
  { code: 'PMH', slug: 'pmh', nameTh: 'มหิดลสิทธาคาร (PMH)',              nameEn: 'Prince Mahidol Hall (PMH)',      officers: [] }
];
/* ค่าเชื่อมต่อของรุ่น v2 — เว้น scriptUrl ว่างไว้ = โหมดทดสอบ (ไม่ส่งข้อมูล)
 * ใส่ URL /exec ของ Apps Script รุ่น v2 (ที่ผูกกับ Sheet ทดสอบ) เมื่อพร้อมทดสอบการบันทึกเท่านั้น */
window.CCTV_V2_CONFIG = { scriptUrl: '' };

// frontend/src/lib/api/department.ts
"use client";
import { api } from "@/lib/api";

const ROOT = "/departments";

// Some endpoints return a paginated DRF response; unwrap either shape.
async function unwrapList<T>(p: Promise<{ data: T[] | { results: T[] } }>): Promise<T[]> {
  const r = await p;
  return Array.isArray(r.data) ? r.data : (r.data as { results: T[] }).results;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeptStatus = "active" | "inactive";

export interface Department {
  id:           number;
  name:         string;
  code:         string;
  type:         string;       // "OPD" | "IPD" | "Diagnostic" | "Support" | "Admin"
  head_doctor:  string;
  extension:    string;
  location:     string;       // e.g. "Block A, 2nd Floor"
  beds:         number;
  occupied_beds:number;
  staff_count:  number;
  status:       DeptStatus;
  description:  string;
  services:     string[];
}

export interface DepartmentForm {
  name:        string;
  code:        string;
  type:        string;
  head_doctor: string;
  extension:   string;
  location:    string;
  beds:        number | "";
  status:      DeptStatus;
  description: string;
  services:    string;       // comma-separated in the form
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const departmentApi = {
  list: () =>
    unwrapList<Department>(
      api.get<Department[] | { results: Department[] }>(`${ROOT}/`),
    ),
  create: (b: DepartmentForm) =>
    api.post<Department>(`${ROOT}/`, b).then(r => r.data),
  update: (id: number, b: Partial<DepartmentForm>) =>
    api.patch<Department>(`${ROOT}/${id}/`, b).then(r => r.data),
  delete: (id: number) =>
    api.delete(`${ROOT}/${id}/`).then(() => undefined),
};

// ─── Mock data ───────────────────────────────────────────────────────────────

export const DEPARTMENT_MOCK: Department[] = [
  {
    id:1, name:"General Medicine", code:"GM-001", type:"OPD",
    head_doctor:"Dr. Arvind Sharma", extension:"101", location:"Block A, Ground Floor",
    beds:0, occupied_beds:0, staff_count:12, status:"active",
    description:"Primary outpatient care covering a broad range of non-surgical conditions.",
    services:["OPD Consultations","Health Check-ups","Chronic Disease Management","Referrals"],
  },
  {
    id:2, name:"Cardiology", code:"CARD-002", type:"OPD",
    head_doctor:"Dr. Rajesh Gupta", extension:"102", location:"Block B, 1st Floor",
    beds:0, occupied_beds:0, staff_count:8, status:"active",
    description:"Specialist cardiac care including ECG, Echo, stress tests and cardiac rehab.",
    services:["ECG","Echocardiography","Stress Test","Cardiac Rehab","Holter Monitoring"],
  },
  {
    id:3, name:"General Surgery", code:"GS-003", type:"IPD",
    head_doctor:"Dr. Sunil Arora", extension:"201", location:"Block C, 2nd Floor",
    beds:30, occupied_beds:22, staff_count:15, status:"active",
    description:"Full spectrum of surgical procedures including emergency and elective surgeries.",
    services:["Appendectomy","Cholecystectomy","Hernia Repair","Laparoscopy","Wound Care"],
  },
  {
    id:4, name:"Gynaecology & Obstetrics", code:"GYNOB-004", type:"IPD",
    head_doctor:"Dr. Sneha Mehta", extension:"202", location:"Block D, 2nd Floor",
    beds:20, occupied_beds:12, staff_count:10, status:"active",
    description:"Complete women's health services from routine gynaecology to high-risk obstetrics.",
    services:["Antenatal Care","Normal Delivery","C-Section","Laparoscopic Surgery","Infertility Consult"],
  },
  {
    id:5, name:"Paediatrics", code:"PED-005", type:"IPD",
    head_doctor:"Dr. Vinay Kumar", extension:"203", location:"Block D, 1st Floor",
    beds:20, occupied_beds:10, staff_count:9, status:"active",
    description:"Comprehensive child health care from newborns to adolescents.",
    services:["NICU","Well-baby Clinic","Vaccination","Developmental Assessment","PICU"],
  },
  {
    id:6, name:"Laboratory & Pathology", code:"LAB-006", type:"Diagnostic",
    head_doctor:"Dr. Meera Joshi", extension:"301", location:"Block A, Basement",
    beds:0, occupied_beds:0, staff_count:14, status:"active",
    description:"Full-service diagnostic laboratory covering haematology, biochemistry, microbiology and histopathology.",
    services:["CBC","LFT/RFT","Culture & Sensitivity","Histopathology","Hormone Assays"],
  },
  {
    id:7, name:"Radiology & Imaging", code:"RAD-007", type:"Diagnostic",
    head_doctor:"Dr. Prakash Nair", extension:"302", location:"Block B, Ground Floor",
    beds:0, occupied_beds:0, staff_count:10, status:"active",
    description:"Advanced imaging including digital X-ray, USG, CT and MRI.",
    services:["X-Ray","Ultrasound","CT Scan","MRI","Mammography","Fluoroscopy"],
  },
  {
    id:8, name:"Pharmacy", code:"PHARM-008", type:"Support",
    head_doctor:"Mr. Rajan Das (PharmD)", extension:"401", location:"Block A, Ground Floor",
    beds:0, occupied_beds:0, staff_count:8, status:"active",
    description:"Inpatient and outpatient dispensing, clinical pharmacy, and inventory management.",
    services:["OPD Dispensing","IPD Medication","Clinical Review","IV Admixture","Drug Information"],
  },
  {
    id:9, name:"Orthopaedics", code:"ORTHO-009", type:"IPD",
    head_doctor:"Dr. Priya Patel", extension:"204", location:"Block C, 3rd Floor",
    beds:20, occupied_beds:15, staff_count:11, status:"active",
    description:"Bone, joint, and spine care including trauma, arthroplasty, and sports medicine.",
    services:["Fracture Management","Joint Replacement","Spine Surgery","Sports Injuries","Physiotherapy"],
  },
  {
    id:10, name:"ICU / Critical Care", code:"ICU-010", type:"IPD",
    head_doctor:"Dr. Amit Verma", extension:"205", location:"Block B, 3rd Floor",
    beds:10, occupied_beds:8, staff_count:20, status:"active",
    description:"Level III ICU providing round-the-clock critical and life-support care.",
    services:["Mechanical Ventilation","Haemodynamic Monitoring","CRRT","Post-op Care","Sepsis Management"],
  },
];

// frontend/src/types/ipd.ts
//
// MIGRATED: this used to be 180 lines of hand-written interfaces. It's now
// a thin re-export from @/types/api, which derives the same types from the
// auto-generated OpenAPI schema.
//
// Existing consumers (lib/api/ipd.ts, pages under /dashboard/ipd/, etc.)
// keep their `import { Admission } from "@/types/ipd"` lines and work
// unchanged. New code should prefer `@/types/api` directly.

export type {
  Ward, WardList,
  Room, RoomList,
  Bed, BedList,
  Admission, AdmissionList, AdmissionCreatePayload,
  DailyCharge, AdmissionService,
  BedAvailability, IPDDashboard, DischargeSummary,
} from "@/types/api";


// ─── Enum string-literal aliases ────────────────────────────────────────────
//
// These narrow-string types were defined locally and consumed by the pages
// (e.g. switch statements on `bed.status`). The generated schema represents
// them as untagged string literal unions on the bare field type, which is
// less ergonomic for `case "AVAILABLE":` branches.
//
// Kept as named aliases for ergonomics. If the backend ever adds/removes a
// value, update here — tsc will flag every consumer.

export type WardType =
  | "GENERAL" | "PRIVATE" | "SEMI_PRIVATE" | "ICU" | "HDU"
  | "MATERNITY" | "PAEDIATRIC" | "ISOLATION" | "DAY_CARE";

export type BedStatus =
  | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export type AdmissionStatus =
  | "ADMITTED" | "DISCHARGED" | "ABSCONDED" | "DAMA"
  | "EXPIRED" | "TRANSFERRED" | "CANCELLED";

export type AdmissionType =
  | "PLANNED" | "EMERGENCY" | "REFERRAL" | "MATERNITY";

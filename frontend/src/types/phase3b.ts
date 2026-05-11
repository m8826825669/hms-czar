// Phase 3b types — Ambulance, Dietary, Laundry, Gas Cylinder

// ═══════════════════════════════════════════════
// Ambulance
// ═══════════════════════════════════════════════
export type AmbulanceType =
  | "BLS" | "ALS" | "CARDIAC" | "MORTUARY" | "PT" | "NEONATAL";
export type AmbulanceStatus =
  | "AVAILABLE" | "DISPATCHED" | "MAINTENANCE" | "OUT_OF_SERVICE";
export type DispatchStatus =
  | "REQUESTED" | "ASSIGNED" | "EN_ROUTE" | "ON_SCENE"
  | "PATIENT_PICKED" | "AT_HOSPITAL" | "COMPLETED" | "CANCELLED";
export type DispatchPriority = "CRITICAL" | "URGENT" | "ROUTINE";
export type CallType =
  | "EMERGENCY" | "INTER_HOSPITAL" | "DISCHARGE" | "MORTUARY" | "OTHER";

export interface Ambulance {
  id: number;
  code: string;
  registration_number: string;
  ambulance_type: AmbulanceType;
  type_label: string;
  make_model: string;
  year: number;
  status: AmbulanceStatus;
  status_label: string;
  equipment_list: string;
  base_location: string;
  base_price: string;
  per_km_rate: string;
  is_active: boolean;
  notes: string;
}

export interface AmbulanceDriver {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string;
  role: string;
  role_label: string;
  shift: string;
  shift_label: string;
  is_on_duty: boolean;
  is_active: boolean;
}

export interface Dispatch {
  id: number;
  code: string;
  call_type: CallType;
  call_type_label: string;
  priority: DispatchPriority;
  priority_label: string;
  patient: number | null;
  patient_name: string;
  patient_name_temp: string;
  patient_phone_temp: string;
  caller_name: string;
  caller_phone: string;
  caller_relation: string;
  pickup_address: string;
  pickup_landmark: string;
  drop_address: string;
  chief_complaint: string;
  age_estimate: number | null;
  ambulance: number | null;
  ambulance_code: string | null;
  ambulance_reg: string | null;
  driver: number | null;
  driver_name: string | null;
  paramedic: number | null;
  paramedic_name: string | null;
  requested_at: string;
  assigned_at: string | null;
  en_route_at: string | null;
  on_scene_at: string | null;
  patient_picked_at: string | null;
  at_hospital_at: string | null;
  completed_at: string | null;
  status: DispatchStatus;
  status_label: string;
  distance_km: string | null;
  invoice: number | null;
  invoice_code: string | null;
  cancellation_reason: string;
  notes: string;
  response_time_seconds: number | null;
  logs: any[];
}


// ═══════════════════════════════════════════════
// Dietary
// ═══════════════════════════════════════════════
export type MealType =
  | "BREAKFAST" | "MORNING_SNACK" | "LUNCH"
  | "EVENING_SNACK" | "DINNER" | "BEDTIME";
export type MealStatus =
  | "PLANNED" | "IN_KITCHEN" | "READY" | "DELIVERED"
  | "CONSUMED" | "REFUSED" | "CANCELLED";
export type DietPlanStatus = "ACTIVE" | "PAUSED" | "ENDED";

export interface DietType {
  id: number;
  code: string;
  name: string;
  description: string;
  calories_per_day: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_diabetic_safe: boolean;
  is_renal_safe: boolean;
  is_cardiac_safe: boolean;
  is_low_sodium: boolean;
  is_gluten_free: boolean;
  is_active: boolean;
}

export interface MealItem {
  id: number;
  code: string;
  name: string;
  meal_type: MealType;
  meal_type_label: string;
  description: string;
  calories: number;
  is_vegetarian: boolean;
  is_jain: boolean;
  cost_per_serving: string;
  is_active: boolean;
}

export interface PatientMeal {
  id: number;
  diet_plan: number;
  meal_date: string;
  meal_type: MealType;
  meal_type_label: string;
  item: number;
  item_name: string;
  item_code: string;
  status: MealStatus;
  status_label: string;
  delivered_at: string | null;
  delivered_by: string;
  consumed_percentage: number;
  refusal_reason: string;
  patient_name: string;
  bed_label: string | null;
  notes: string;
}

export interface DietPlan {
  id: number;
  admission: number;
  admission_code: string | null;
  patient: number;
  patient_name: string;
  diet_type: number;
  diet_type_name: string;
  prescribed_by: number | null;
  is_vegetarian: boolean;
  is_jain: boolean;
  is_diabetic: boolean;
  allergies: string;
  food_preferences: string;
  fluid_restriction_ml: number | null;
  npo_until: string | null;
  npo_reason: string;
  started_at: string;
  ended_at: string | null;
  status: DietPlanStatus;
  status_label: string;
  notes: string;
  meals?: PatientMeal[];
}

export interface KitchenSummary {
  date: string;
  by_meal_type: {
    [k: string]: Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      quantity: number;
      is_finalized: boolean;
    }>;
  };
  total_meals: number;
  total_servings: number;
}


// ═══════════════════════════════════════════════
// Laundry
// ═══════════════════════════════════════════════
export interface LinenItem {
  id: number;
  code: string;
  name: string;
  category: string;
  category_label: string;
  unit_value: string;
  total_in_circulation: number;
  is_active: boolean;
}

export interface LaundryBatch {
  id: number;
  code: string;
  department: number | null;
  department_name: string | null;
  status: string;
  status_label: string;
  collected_at: string;
  sent_to_laundry_at: string | null;
  received_back_at: string | null;
  notes: string;
  items?: any[];
}


// ═══════════════════════════════════════════════
// Gas Cylinder
// ═══════════════════════════════════════════════
export type GasType =
  | "O2" | "N2O" | "MED_AIR" | "CO2" | "HELIUM" | "ENTONOX" | "VACUUM";
export type CylinderStatus =
  | "AVAILABLE" | "PARTIAL" | "EMPTY" | "AT_VENDOR"
  | "IN_USE" | "MAINTENANCE" | "RETIRED";

export interface CylinderType {
  id: number;
  code: string;
  gas_type: GasType;
  gas_type_label: string;
  size: string;
  size_label: string;
  capacity_litres: number;
  refill_cost: string;
  deposit_amount: string;
  is_active: boolean;
}

export interface Cylinder {
  id: number;
  cylinder_type: number;
  type_code: string;
  type_gas: string;
  type_size: string;
  serial_number: string;
  barcode: string;
  status: CylinderStatus;
  status_label: string;
  fill_percentage: number;
  current_location: string;
  current_department: number | null;
  current_department_name: string | null;
  manufacture_date: string | null;
  manufacturer: string;
  last_hydro_test: string | null;
  next_hydro_test_due: string | null;
  is_hydro_test_due: boolean;
  last_refilled_at: string | null;
  refill_count: number;
  is_active: boolean;
  notes: string;
}

export interface CylinderInventory {
  as_of: string;
  stock_by_gas_status: { [gas: string]: { [status: string]: number } };
  totals: {
    available: number;
    in_use: number;
    empty: number;
    at_vendor: number;
    hydro_due_30d: number;
  };
  hydro_due: Array<{
    id: number;
    serial_number: string;
    next_hydro_test_due: string;
    cylinder_type__gas_type: string;
    cylinder_type__size: string;
  }>;
}

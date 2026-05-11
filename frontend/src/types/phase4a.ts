// Phase 4a types — Inventory, Assets, Housekeeping

// ═══ Inventory ═══
export interface StoreLocation {
  id: number;
  code: string;
  name: string;
  store_type: string;
  store_type_label: string;
  department: number | null;
  department_name: string | null;
  is_active: boolean;
}

export interface StockItem {
  id: number;
  code: string;
  name: string;
  category: number;
  category_name: string;
  item_type: string;
  item_type_label: string;
  uom: string;
  uom_label: string;
  gst_rate: string;
  reorder_level: string;
  minimum_stock: string;
  default_purchase_price: string;
  default_issue_rate: string;
  is_active: boolean;
}

export interface StockBatch {
  id: number;
  item: number;
  item_name: string;
  item_code: string;
  item_uom: string;
  store: number;
  store_name: string;
  batch_number: string;
  supplier_name: string | null;
  received_quantity: string;
  current_quantity: string;
  purchase_rate: string;
  mrp: string;
  issue_rate: string;
  expiry_date: string | null;
  received_date: string;
  is_active: boolean;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  gstin: string;
  rating: string;
  is_active: boolean;
  is_blacklisted: boolean;
}

export interface PurchaseOrder {
  id: number;
  code: string;
  supplier: number;
  supplier_name: string;
  store: number;
  store_name: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  status_label: string;
  subtotal: string;
  gst_amount: string;
  total_amount: string;
  lines?: any[];
}

export interface StockRequisition {
  id: number;
  code: string;
  requesting_dept: number;
  requesting_dept_name: string;
  source_store: number;
  source_store_name: string;
  requested_date: string;
  urgency: string;
  urgency_label: string;
  status: string;
  status_label: string;
  purpose: string;
  lines?: any[];
}

export interface StockSummaryRow {
  item: number;
  item__code: string;
  item__name: string;
  item__uom: string;
  item__reorder_level: string;
  store: number;
  store__code: string;
  total_qty: string;
}


// ═══ Assets ═══
export interface AssetCategory {
  id: number;
  code: string;
  name: string;
  category_type: string;
  category_type_label: string;
  default_depreciation_pct: string;
  is_active: boolean;
}

export interface Asset {
  id: number;
  asset_code: string;
  name: string;
  category: number;
  category_name: string;
  category_type: string;
  description: string;
  serial_number: string;
  model_number: string;
  manufacturer: string;
  purchase_date: string | null;
  purchase_cost: string;
  warranty_end_date: string | null;
  is_under_warranty: boolean;
  department: number | null;
  department_name: string | null;
  location: string;
  status: string;
  status_label: string;
  condition: string;
  condition_label: string;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  book_value: string;
  age_years: number;
}

export interface AssetMaintenanceLog {
  id: number;
  asset: number;
  asset_code: string;
  asset_name: string;
  maintenance_type: string;
  type_label: string;
  status: string;
  status_label: string;
  scheduled_date: string;
  completed_at: string | null;
  description: string;
  work_performed: string;
  cost: string;
  vendor_name: string;
  next_due_date: string | null;
}

export interface AssetMetrics {
  total_assets: number;
  active_assets: number;
  under_repair: number;
  disposed: number;
  total_book_value: string;
  amcs_expiring_30d: number;
  maintenance_due_30d: number;
  by_status: { [k: string]: number };
  by_category: Array<{
    category__code: string;
    category__name: string;
    count: number;
    value: string;
  }>;
}


// ═══ Housekeeping ═══
export interface HKZone {
  id: number;
  code: string;
  name: string;
  zone_type: string;
  zone_type_label: string;
  criticality: string;
  criticality_label: string;
  floor: string;
  area_sqft: number;
  is_active: boolean;
}

export interface HKStaff {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string;
  role: string;
  role_label: string;
  shift: string;
  shift_label: string;
  is_on_duty: boolean;
}

export interface HKTaskTemplate {
  id: number;
  code: string;
  name: string;
  task_type: string;
  task_type_label: string;
  zone: number;
  zone_name: string;
  frequency: string;
  frequency_label: string;
  duration_minutes: number;
  is_active: boolean;
}

export interface HKTaskAssignment {
  id: number;
  template: number;
  template_name: string;
  template_task_type: string;
  zone: number;
  zone_name: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  status_label: string;
  quality_rating: number | null;
}

export interface HKTodaySummary {
  date: string;
  counts: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    missed: number;
    rejected: number;
  };
  by_zone: Array<{
    zone__code: string;
    zone__name: string;
    status: string;
    count: number;
  }>;
}

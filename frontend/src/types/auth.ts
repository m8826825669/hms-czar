export interface Hospital {
  id: number;
  code: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  gst_number: string;
  currency: string;
}

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  employee_code: string;
  designation: string;
  must_change_password: boolean;
  hospital: Hospital | null;
  roles: string[];
  permissions: string[];
  is_superuser: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

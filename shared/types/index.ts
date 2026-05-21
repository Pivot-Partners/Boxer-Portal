// Shared types used by both frontend and backend

export type Role = 'employee' | 'store_manager' | 'm1_admin' | 'm2_admin' | 'm2_reviewer' | 'super_admin';

export type StoreCategory =
  | 'supermarket_mini'
  | 'liquor'
  | 'build'
  | 'distribution_center'
  | 'meat_factory'
  | 'head_office';

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  supermarket_mini: 'Boxer Supermarket or Boxer Mini',
  liquor: 'Boxer Liquor',
  build: 'Boxer Build',
  distribution_center: 'Distribution Center',
  meat_factory: 'Meat Factory',
  head_office: 'Head Office',
};

export type EmploymentType = 'permanent' | 'flexi';

export type ApplicationStatus =
  | 'pending'
  | 'cancelled_by_employee'
  | 'superseded'
  | 'cancelled_no_whitelist'
  | 'cancelled_no_stock'
  | 'validated'
  | 'converted_to_order'
  | 'rejected';

export type BatchStatus =
  | 'open'
  | 'closed'
  | 'processing'
  | 'awaiting_approval'
  | 'approved'
  | 'orders_submitted'
  | 'completed';

export type OrderStatus =
  | 'created'
  | 'submitted_to_suppliers'
  | 'acknowledged'
  | 'dispatched'
  | 'delivered_to_store'
  | 'handed_to_employee';

export type RentalStatus = 'active' | 'leaver' | 'completed' | 'cancelled' | 'written_off';

export interface PhoneModel {
  id: string;
  model_name: string;
  model_code: string | null;
  retail_price: number;
  upfront_amount: number;
  rental_amount_7m: number;
  rental_amount_13m: number;
  display_order: number;
  is_active: boolean;
}

export interface Store {
  id: string;
  category: StoreCategory;
  name: string;
  store_code: string | null;
  is_active: boolean;
}

// API response wrapper
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  total_pages: number;
  page: number;
  per_page: number;
}

export interface ApiError {
  detail: string | { code: string; message: string };
  code?: string;
}

export type Term = 'first' | 'second' | 'third';
export type Gender = 'male' | 'female';

export interface SelectOption {
  value: string;
  label: string;
}

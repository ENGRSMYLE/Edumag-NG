'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { studentsApi } from '@/lib/api';

type Step = 1 | 2 | 3 | 4;

const REQUIRED_COLS = ['admission_number', 'first_name', 'last_name', 'date_of_birth', 'gender'];
const ALL_COLS = [
  'admission_number', 'first_name', 'last_name', 'middle_name',
  'date_of_birth', 'gender', 'class_name', 'state_of_origin',
  'religion', 'blood_group', 'genotype', 'address', 'admission_date',
];

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
}

interface UploadResult {
  created: number;
  errors: { row: number; message: string }[];
}

function validateRow(row: Record<string, unknown>, index: number): ParsedRow {
  const data: Record<string, string> = {};
  const errors: string[] = [];

  for (const col of ALL_COLS) {
    data[col] = String(row[col] ?? '').trim();
  }

  for (const col of REQUIRED_COLS) {
    if (!data[col]) errors.push(`${col.replace(/_/g, ' ')} is required`);
  }

  if (data.gender && !['male', 'female'].includes(data.gender.toLowerCase())) {
    errors.push('Gender must be "male" or "female"');
  } else if (data.gender) {
    data.gender = data.gender.toLowerCase();
  }

  if (data.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(data.date_of_birth)) {
    errors.push('Date of birth must be YYYY-MM-DD');
  }

  return { index, data, errors };
}

export default function BulkUploadPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([ALL_COLS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'edumag_student_template.xlsx');
  };

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        if (rows.length === 0) {
          toast.error('The file appears to be empty');
          return;
        }

        const parsed = rows.map((row, i) => validateRow(row, i + 2));
        setParsedRows(parsed);
        setStep(3);
      } catch {
        toast.error('Could not parse the file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    disabled: step !== 2,
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => {
      const payload = validRows.map((r) => r.data);
      return studentsApi.bulkUpload(payload as Record<string, unknown>[]);
    },
    onSuccess: (res) => {
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setStep(4);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Upload failed';
      toast.error(typeof msg === 'string' ? msg : 'Upload failed');
    },
  });

  const exportErrors = () => {
    const rows = errorRows.map((r) => ({
      row: r.index,
      ...r.data,
      errors: r.errors.join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'upload_errors.xlsx');
  };

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Download Template' },
    { n: 2, label: 'Upload File' },
    { n: 3, label: 'Review & Confirm' },
    { n: 4, label: 'Done' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bulk Upload Students"
        description="Import multiple students at once from a spreadsheet"
        breadcrumbs={[
          { label: 'Students', href: '/dashboard/admin/students' },
          { label: 'Bulk Upload' },
        ]}
      />

      {/* Step indicator */}
      <div className="card-shell">
        <div className="card-core px-5 py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div
                    className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                      step > s.n
                        ? 'bg-emerald-500 text-white'
                        : step === s.n
                          ? 'bg-[var(--color-navy)] text-white'
                          : 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
                    )}
                  >
                    {step > s.n ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> : s.n}
                  </div>
                  <span
                    className={clsx(
                      'text-xs font-medium hidden sm:block',
                      step === s.n
                        ? 'text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-muted)]',
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1 — Download Template */}
      {step === 1 && (
        <div className="card-shell">
          <div className="card-core p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-navy)]/10 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-[var(--color-navy)]" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                Download the Template
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto">
                Fill in the provided Excel template with your student data. Required columns are marked with *.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={downloadTemplate}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
                  'bg-[var(--color-navy)] text-white',
                  'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                  'transition-all duration-200',
                )}
              >
                <Download className="w-4 h-4" strokeWidth={1.5} />
                Download Template
              </button>
              <button
                onClick={() => setStep(2)}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
                  'transition-all duration-200',
                )}
              >
                Skip — I already have a file
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Upload */}
      {step === 2 && (
        <div className="card-shell">
          <div className="card-core p-6">
            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 text-center cursor-pointer',
                'transition-all duration-200',
                isDragActive
                  ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-navy)]/30 hover:bg-[var(--color-surface)]',
              )}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-gold)]/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-[var(--color-gold)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop your XLSX file here'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">or click to browse</p>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">Supports .xlsx files only</p>
            </div>
            <div className="flex justify-start mt-4">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-navy)] transition-colors duration-150 cursor-pointer"
              >
                Back to template download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-shell">
              <div className="card-core p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">Valid Rows</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)] font-mono">{validRows.length}</p>
                </div>
              </div>
            </div>
            <div className="card-shell">
              <div className="card-core p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4.5 h-4.5 text-red-600" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">Rows with Errors</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)] font-mono">{errorRows.length}</p>
                </div>
              </div>
            </div>
            <div className="card-shell">
              <div className="card-core p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-[var(--color-navy)]" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">File</p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-[120px]">{fileName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Preview table */}
          <div className="card-shell overflow-hidden">
            <div className="card-core">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Preview ({parsedRows.length} rows)
                </h3>
                {errorRows.length > 0 && (
                  <button
                    onClick={exportErrors}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 cursor-pointer transition-colors"
                  >
                    <Download className="w-3 h-3" strokeWidth={1.5} />
                    Export error rows
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)] w-12">#</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)]">Admission No.</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)]">First Name</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)]">Last Name</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)]">Gender</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)]">Class</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-muted)] w-48">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {parsedRows.slice(0, 100).map((row) => (
                      <tr
                        key={row.index}
                        className={clsx(
                          row.errors.length > 0 ? 'bg-red-50' : 'hover:bg-[var(--color-surface)]',
                        )}
                      >
                        <td className="px-4 py-2.5 font-mono text-[var(--color-text-muted)]">{row.index}</td>
                        <td className="px-4 py-2.5 font-mono text-[var(--color-text-secondary)]">{row.data.admission_number || '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-primary)]">{row.data.first_name || '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-primary)]">{row.data.last_name || '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-secondary)] capitalize">{row.data.gender || '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">{row.data.class_name || '—'}</td>
                        <td className="px-4 py-2.5">
                          {row.errors.length === 0 ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                              Valid
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {row.errors.map((e, i) => (
                                <span key={i} className="flex items-center gap-1 text-red-600">
                                  <X className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                                  {e}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 100 && (
                  <p className="px-5 py-3 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                    Showing first 100 of {parsedRows.length} rows.
                  </p>
                )}
              </div>
            </div>
          </div>

          {validRows.length === 0 && (
            <div className="card-shell">
              <div className="card-core p-5 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-[var(--color-text-primary)]">
                  No valid rows to import. Fix the errors in your file and upload again.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setParsedRows([]); setFileName(''); setStep(2); }}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
                'transition-all duration-200',
              )}
            >
              Upload Different File
            </button>
            <button
              onClick={() => submit()}
              disabled={isPending || validRows.length === 0}
              className={clsx(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Importing…' : `Import ${validRows.length} Students`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Results */}
      {step === 4 && result && (
        <div className="card-shell">
          <div className="card-core p-10 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Import Complete
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                <span className="font-medium text-emerald-600">{result.created} students</span> created successfully
                {result.errors.length > 0 && (
                  <>, <span className="font-medium text-red-600">{result.errors.length} rows</span> had errors</>
                )}.
              </p>
            </div>
            <div className="flex gap-3">
              {result.errors.length > 0 && (
                <button
                  onClick={exportErrors}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                    'bg-[var(--color-surface)] border border-[var(--color-border)]',
                    'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
                    'transition-all duration-200',
                  )}
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Download Error Report
                </button>
              )}
              <a
                href="/dashboard/admin/students"
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                  'bg-[var(--color-navy)] text-white',
                  'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                  'transition-all duration-200',
                )}
              >
                View Students
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

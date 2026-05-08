import { useState } from 'react';
import React from 'react';
import toast from 'react-hot-toast';

import { resultsApi, settingsApi } from '@/lib/api';

// ─── Blob download helper ─────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_.]/g, '_').toLowerCase();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReportCardPDF() {
  const [generatingIds, setGeneratingIds]   = useState<Set<string>>(new Set());
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const markStart = (id: string) =>
    setGeneratingIds((prev) => new Set([...prev, id]));

  const markDone = (id: string) =>
    setGeneratingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // ── Single student ────────────────────────────────────────────────────────

  const generateSingle = async (
    studentId: string,
    session: string,
    term: string,
  ): Promise<void> => {
    if (generatingIds.has(studentId)) return;
    markStart(studentId);

    try {
      const [
        { default: ReportCardDocument },
        { pdf },
        resultRes,
        schoolRes,
      ] = await Promise.all([
        import('@/components/modules/results/ReportCard'),
        import('@react-pdf/renderer'),
        resultsApi.studentResult(studentId, { academic_session: session, term }),
        settingsApi.school(),
      ]);

      const studentData = resultRes.data;
      const schoolData  = schoolRes.data;

      if (!studentData.subjects.length) {
        toast.error(`No scores entered for ${studentData.student_name} this term.`);
        return;
      }

      const element = React.createElement(ReportCardDocument, {
        data:   [studentData],
        school: schoolData,
      }) as Parameters<typeof pdf>[0];

      const blob = await pdf(element).toBlob();

      const termLabel = { first: '1st-term', second: '2nd-term', third: '3rd-term' }[term] ?? term;
      downloadBlob(
        blob,
        `report-card-${safeFilename(studentData.student_name)}-${termLabel}-${session.replace('/', '-')}.pdf`,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to generate report card PDF';
      toast.error(typeof msg === 'string' ? msg : 'Failed to generate report card PDF');
    } finally {
      markDone(studentId);
    }
  };

  // ── Bulk (entire class) ───────────────────────────────────────────────────

  const generateBulk = async (
    classId: string,
    session: string,
    term: string,
  ): Promise<void> => {
    if (isBulkGenerating) return;
    setIsBulkGenerating(true);

    try {
      const [
        { default: ReportCardDocument },
        { pdf },
        reportCardsRes,
        schoolRes,
      ] = await Promise.all([
        import('@/components/modules/results/ReportCard'),
        import('@react-pdf/renderer'),
        resultsApi.classReportCards(classId, { academic_session: session, term }),
        settingsApi.school(),
      ]);

      const reportCards = reportCardsRes.data;
      const schoolData  = schoolRes.data;

      if (!reportCards.length) {
        toast.error('No report cards found for this class.');
        return;
      }

      const element = React.createElement(ReportCardDocument, {
        data:   reportCards,
        school: schoolData,
      }) as Parameters<typeof pdf>[0];

      const blob = await pdf(element).toBlob();

      const termLabel  = { first: '1st-term', second: '2nd-term', third: '3rd-term' }[term] ?? term;
      const className  = safeFilename(reportCards[0]?.class_name ?? classId);
      downloadBlob(
        blob,
        `report-cards-${className}-${termLabel}-${session.replace('/', '-')}.pdf`,
      );

      toast.success(`${reportCards.length} report card${reportCards.length !== 1 ? 's' : ''} downloaded`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to generate PDF';
      toast.error(typeof msg === 'string' ? msg : 'Failed to generate PDF');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  return {
    generateSingle,
    generateBulk,
    isGeneratingId:  (id: string) => generatingIds.has(id),
    isBulkGenerating,
    isGenerating:    generatingIds.size > 0 || isBulkGenerating,
  };
}

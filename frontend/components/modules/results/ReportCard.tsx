import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { ResultSummary } from '@/lib/api';
import type { SchoolSettings } from '@/types/dashboard';

// ─── Colours ─────────────────────────────────────────────────────────────────

const NAVY   = '#1B3A6B';
const GOLD   = '#C5A028';
const CREAM  = '#FDF8EE';
const BORDER = '#CBD5E1';
const TEXT   = '#0F172A';
const MUTED  = '#64748B';
const WHITE  = '#FFFFFF';
const GREEN  = '#15803D';
const RED    = '#DC2626';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TERM_LABELS: Record<string, string> = {
  first:  '1st Term',
  second: '2nd Term',
  third:  '3rd Term',
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function gradeFromAverage(avg: number): { grade: string; remark: string } {
  if (avg >= 70) return { grade: 'A',  remark: 'Excellent'     };
  if (avg >= 60) return { grade: 'B',  remark: 'Very Good'     };
  if (avg >= 50) return { grade: 'C',  remark: 'Good'          };
  if (avg >= 45) return { grade: 'D',  remark: 'Average'       };
  if (avg >= 40) return { grade: 'E',  remark: 'Below Average' };
  return           { grade: 'F',  remark: 'Fail'          };
}

function fmt(n?: number): string {
  if (n === undefined || n === null) return '—';
  return String(Math.round(n * 10) / 10);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Page
  page: {
    backgroundColor: WHITE,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 22,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLogoWrap: {
    width: 64,
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: CREAM,
    border: `1pt solid ${BORDER}`,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerRight: {
    width: 64,
  },
  schoolName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  schoolAddress: {
    fontSize: 8,
    color: MUTED,
    textAlign: 'center',
    marginTop: 2,
  },
  schoolMotto: {
    fontSize: 8,
    color: GOLD,
    textAlign: 'center',
    marginTop: 2,
    fontFamily: 'Helvetica-Oblique',
  },

  // ── Divider ──
  divider: {
    height: 2,
    backgroundColor: NAVY,
    marginBottom: 2,
  },
  thinDivider: {
    height: 0.5,
    backgroundColor: GOLD,
    marginBottom: 8,
  },

  // ── Title strip ──
  titleStrip: {
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  titleText: {
    color: WHITE,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  termText: {
    color: GOLD,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },

  // ── Student info grid ──
  infoGrid: {
    flexDirection: 'row',
    borderRadius: 3,
    border: `0.5pt solid ${BORDER}`,
    backgroundColor: CREAM,
    marginBottom: 10,
    overflow: 'hidden',
  },
  infoCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRight: `0.5pt solid ${BORDER}`,
  },
  infoCellLast: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  infoLabel: {
    fontSize: 6.5,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: TEXT,
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  sectionHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Subjects table ──
  table: {
    border: `0.5pt solid ${BORDER}`,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  tableRowEven: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${BORDER}`,
    backgroundColor: CREAM,
  },
  tableSummaryRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderTop: `1pt solid ${NAVY}`,
  },
  // Column widths
  colSubject: { width: 175, paddingHorizontal: 7, paddingVertical: 4 },
  colCA:      { width: 47,  paddingHorizontal: 5, paddingVertical: 4, textAlign: 'center' as const },
  colExam:    { width: 47,  paddingHorizontal: 5, paddingVertical: 4, textAlign: 'center' as const },
  colTotal:   { width: 50,  paddingHorizontal: 5, paddingVertical: 4, textAlign: 'center' as const },
  colGrade:   { width: 40,  paddingHorizontal: 5, paddingVertical: 4, textAlign: 'center' as const },
  colRemark:  { flex: 1,    paddingHorizontal: 7, paddingVertical: 4 },

  thText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },
  thSub: {
    fontSize: 6,
    color: '#94A3B8',
    marginTop: 1,
  },
  tdText: {
    fontSize: 8,
    color: TEXT,
  },
  tdBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: TEXT,
  },
  tdMono: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: TEXT,
  },
  gradeGreen: { color: GREEN, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  gradeRed:   { color: RED,   fontFamily: 'Helvetica-Bold', fontSize: 8 },

  // ── Attendance ──
  attendanceRow: {
    flexDirection: 'row',
    backgroundColor: CREAM,
    border: `0.5pt solid ${BORDER}`,
    marginBottom: 10,
  },
  attendanceCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRight: `0.5pt solid ${BORDER}`,
  },
  attendanceCellLast: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  attendanceLabel: {
    fontSize: 6.5,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  attendanceValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },

  // ── Comments ──
  commentsSection: {
    marginBottom: 10,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 4,
    border: `0.5pt solid ${BORDER}`,
    borderRadius: 2,
    overflow: 'hidden',
  },
  commentLabel: {
    width: 130,
    backgroundColor: CREAM,
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderRight: `0.5pt solid ${BORDER}`,
  },
  commentLabelText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  commentBody: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  commentText: {
    fontSize: 8,
    color: TEXT,
    fontFamily: 'Helvetica-Oblique',
  },
  commentEmpty: {
    fontSize: 8,
    color: MUTED,
    fontFamily: 'Helvetica-Oblique',
  },

  // ── Signatures ──
  signaturesRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 20,
  },
  signatureBox: {
    flex: 1,
    paddingTop: 28,
    borderTop: `1pt solid ${TEXT}`,
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'center',
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 6,
    borderTop: `0.5pt solid ${BORDER}`,
  },
  stampBox: {
    width: 80,
    height: 80,
    border: `1pt dashed ${BORDER}`,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampText: {
    fontSize: 6.5,
    color: BORDER,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  footerPowered: {
    flex: 1,
    alignItems: 'flex-end',
  },
  footerPoweredText: {
    fontSize: 6.5,
    color: BORDER,
  },
});

// ─── Student page ─────────────────────────────────────────────────────────────

function StudentPage({ data, school }: { data: ResultSummary; school: SchoolSettings }) {
  const termLabel    = TERM_LABELS[data.term] ?? data.term;
  const overallGrade = gradeFromAverage(data.average);
  const issued       = new Date().toLocaleDateString('en-NG', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <Page size="A4" style={s.page}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLogoWrap}>
          {school.logo_url
            ? <Image src={school.logo_url} style={s.logo} />
            : <View style={s.logoPlaceholder} />
          }
        </View>
        <View style={s.headerCenter}>
          <Text style={s.schoolName}>{school.report_header ?? school.name}</Text>
          {school.address && <Text style={s.schoolAddress}>{school.address}</Text>}
          {school.motto && <Text style={s.schoolMotto}>{`"${school.motto}"`}</Text>}
        </View>
        <View style={s.headerRight} />
      </View>

      <View style={s.divider} />
      <View style={s.thinDivider} />

      {/* Report card title */}
      <View style={s.titleStrip}>
        <Text style={s.titleText}>Student Academic Report Card</Text>
        <Text style={s.termText}>
          {`${termLabel}  ·  Academic Session: ${data.academic_session}`}
        </Text>
      </View>

      {/* Student info */}
      <View style={s.infoGrid}>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Student Name</Text>
          <Text style={s.infoValue}>{data.student_name}</Text>
        </View>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Admission Number</Text>
          <Text style={s.infoValue}>{data.admission_number}</Text>
        </View>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Class</Text>
          <Text style={s.infoValue}>{data.class_name}</Text>
        </View>
        <View style={s.infoCell}>
          <Text style={s.infoLabel}>Position</Text>
          <Text style={s.infoValue}>
            {data.position != null ? ordinal(data.position) : '—'}
          </Text>
        </View>
        <View style={s.infoCellLast}>
          <Text style={s.infoLabel}>Date Issued</Text>
          <Text style={s.infoValue}>{issued}</Text>
        </View>
      </View>

      {/* Academic performance section */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>Academic Performance</Text>
      </View>
      <View style={s.table}>
        {/* Table header */}
        <View style={s.tableHeader}>
          <View style={s.colSubject}>
            <Text style={s.thText}>Subject</Text>
          </View>
          <View style={s.colCA}>
            <Text style={s.thText}>CA</Text>
            <Text style={s.thSub}>/40</Text>
          </View>
          <View style={s.colExam}>
            <Text style={s.thText}>Exam</Text>
            <Text style={s.thSub}>/60</Text>
          </View>
          <View style={s.colTotal}>
            <Text style={s.thText}>Total</Text>
            <Text style={s.thSub}>/100</Text>
          </View>
          <View style={s.colGrade}>
            <Text style={s.thText}>Grade</Text>
          </View>
          <View style={s.colRemark}>
            <Text style={s.thText}>Remark</Text>
          </View>
        </View>

        {/* Subject rows */}
        {data.subjects.map((subj, idx) => {
          const isPass = (subj.total_score ?? 0) >= 40;
          return (
            <View key={subj.subject} style={idx % 2 === 0 ? s.tableRow : s.tableRowEven}>
              <View style={s.colSubject}>
                <Text style={s.tdText}>{subj.subject}</Text>
              </View>
              <View style={s.colCA}>
                <Text style={s.tdMono}>{fmt(subj.ca_score)}</Text>
              </View>
              <View style={s.colExam}>
                <Text style={s.tdMono}>{fmt(subj.exam_score)}</Text>
              </View>
              <View style={s.colTotal}>
                <Text style={[s.tdMono, s.tdBold]}>{fmt(subj.total_score)}</Text>
              </View>
              <View style={s.colGrade}>
                <Text style={isPass ? s.gradeGreen : s.gradeRed}>
                  {subj.grade ?? '—'}
                </Text>
              </View>
              <View style={s.colRemark}>
                <Text style={s.tdText}>{subj.remark ?? '—'}</Text>
              </View>
            </View>
          );
        })}

        {/* Summary row */}
        <View style={s.tableSummaryRow}>
          <View style={s.colSubject}>
            <Text style={s.tdBold}>Overall Average</Text>
          </View>
          <View style={s.colCA}>
            <Text style={s.tdText} />
          </View>
          <View style={s.colExam}>
            <Text style={s.tdText} />
          </View>
          <View style={s.colTotal}>
            <Text style={[s.tdMono, s.tdBold]}>{fmt(data.average)}</Text>
          </View>
          <View style={s.colGrade}>
            <Text style={data.average >= 40 ? s.gradeGreen : s.gradeRed}>
              {overallGrade.grade}
            </Text>
          </View>
          <View style={s.colRemark}>
            <Text style={s.tdBold}>{overallGrade.remark}</Text>
          </View>
        </View>
      </View>

      {/* Attendance */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>Attendance Summary</Text>
      </View>
      <View style={s.attendanceRow}>
        <View style={s.attendanceCell}>
          <Text style={s.attendanceLabel}>Days Present</Text>
          <Text style={s.attendanceValue}>—</Text>
        </View>
        <View style={s.attendanceCell}>
          <Text style={s.attendanceLabel}>Days Absent</Text>
          <Text style={s.attendanceValue}>—</Text>
        </View>
        <View style={s.attendanceCellLast}>
          <Text style={s.attendanceLabel}>Attendance Rate</Text>
          <Text style={s.attendanceValue}>—</Text>
        </View>
      </View>

      {/* Comments */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>Comments</Text>
      </View>
      <View style={s.commentsSection}>
        <View style={s.commentRow}>
          <View style={s.commentLabel}>
            <Text style={s.commentLabelText}>Class Teacher's Comment</Text>
          </View>
          <View style={s.commentBody}>
            {data.teacher_comment
              ? <Text style={s.commentText}>{data.teacher_comment}</Text>
              : <Text style={s.commentEmpty}>No comment provided.</Text>
            }
          </View>
        </View>
        <View style={s.commentRow}>
          <View style={s.commentLabel}>
            <Text style={s.commentLabelText}>Principal's Comment</Text>
          </View>
          <View style={s.commentBody}>
            {data.principal_comment
              ? <Text style={s.commentText}>{data.principal_comment}</Text>
              : <Text style={s.commentEmpty}>No comment provided.</Text>
            }
          </View>
        </View>
      </View>

      {/* Signatures */}
      <View style={s.signaturesRow}>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Class Teacher's Signature</Text>
        </View>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Date</Text>
        </View>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Principal's Signature</Text>
        </View>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>School Stamp</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.stampBox}>
          <Text style={s.stampText}>School{'\n'}Stamp</Text>
        </View>
        <View style={s.footerPowered}>
          <Text style={s.footerPoweredText}>Generated by EduMag NG</Text>
        </View>
      </View>
    </Page>
  );
}

// ─── Document export ─────────────────────────────────────────────────────────

export interface ReportCardProps {
  data: ResultSummary[];
  school: SchoolSettings;
}

export default function ReportCardDocument({ data, school }: ReportCardProps) {
  return (
    <Document
      title={`Report Cards — ${school.name}`}
      author={school.name}
      subject="Academic Report Cards"
      creator="EduMag NG"
    >
      {data.map((student) => (
        <StudentPage key={student.student_id} data={student} school={school} />
      ))}
    </Document>
  );
}

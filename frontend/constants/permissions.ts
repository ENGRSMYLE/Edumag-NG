export const PERMISSIONS = {
  // Staff management
  CREATE_STAFF:                  'create_staff',
  CREATE_ADMIN:                  'create_admin',
  EDIT_USER_ROLES:               'edit_user_roles',
  DEACTIVATE_USERS:              'deactivate_users',

  // Students
  CREATE_STUDENT:                'create_student',
  EDIT_STUDENT:                  'edit_student',
  VIEW_ALL_STUDENTS:             'view_all_students',
  VIEW_OWN_CLASS_STUDENTS:       'view_own_class_students',
  ASSIGN_STUDENT_TO_CLASS:       'assign_student_to_class',
  REMOVE_STUDENT_FROM_CLASS:     'remove_student_from_class',
  TRANSFER_STUDENT:              'transfer_student',
  PROMOTE_STUDENT:               'promote_student',
  BULK_UPLOAD_STUDENTS:          'bulk_upload_students',

  // Parents
  ADD_PARENT:                    'add_parent',
  EDIT_PARENT:                   'edit_parent',
  VIEW_PARENT_CONTACT:           'view_parent_contact',
  MESSAGE_PARENTS_FULL:          'message_parents_full',
  MESSAGE_PARENTS_LIMITED:       'message_parents_limited',

  // Classes
  CREATE_CLASS:                  'create_class',
  ASSIGN_TEACHER_TO_CLASS:       'assign_teacher_to_class',
  EDIT_CLASS:                    'edit_class',
  VIEW_CLASS_LIST:               'view_class_list',

  // Attendance
  TAKE_ATTENDANCE:               'take_attendance',
  EDIT_ATTENDANCE:               'edit_attendance',
  VIEW_OWN_CLASS_ATTENDANCE:     'view_own_class_attendance',
  VIEW_ALL_ATTENDANCE:           'view_all_attendance',

  // Results
  ENTER_SCORES:                  'enter_scores',
  EDIT_SCORES:                   'edit_scores',
  APPROVE_RESULTS:               'approve_results',
  GENERATE_REPORT_CARDS:         'generate_report_cards',
  ADD_TEACHER_COMMENTS:          'add_teacher_comments',
  VIEW_OWN_CLASS_REPORTS:        'view_own_class_reports',
  VIEW_ALL_REPORTS:              'view_all_reports',

  // Finance
  RECORD_PAYMENT:                'record_payment',
  CONFIRM_BANK_TRANSFER:         'confirm_bank_transfer',
  VIEW_PAYMENT_STATUS:           'view_payment_status',
  EDIT_PAYMENT_RECORDS:          'edit_payment_records',
  GENERATE_FINANCIAL_REPORTS:    'generate_financial_reports',
  TRACK_DEBTORS:                 'track_debtors',

  // Assignments
  CREATE_ASSIGNMENT:             'create_assignment',
  GRADE_ASSIGNMENT:              'grade_assignment',
  UPLOAD_MATERIALS:              'upload_materials',
  VIEW_OWN_CLASS_ASSIGNMENTS:    'view_own_class_assignments',
  VIEW_ALL_ASSIGNMENTS:          'view_all_assignments',

  // Communication
  SEND_ANNOUNCEMENTS:            'send_announcements',
  MESSAGE_TEACHERS:              'message_teachers',
  MESSAGE_ADMIN:                 'message_admin',

  // Settings (super_admin only)
  CONFIGURE_GRADING:             'configure_grading',
  SET_SCHOOL_TERMS:              'set_school_terms',
  CUSTOMIZE_REPORT_FORMAT:       'customize_report_format',
  BACKUP_EXPORT_DATA:            'backup_export_data',
  VIEW_SYSTEM_LOGS:              'view_system_logs',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type UserRole = 'super_admin' | 'admin' | 'teacher';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  teacher: [
    PERMISSIONS.VIEW_OWN_CLASS_STUDENTS,
    PERMISSIONS.ASSIGN_STUDENT_TO_CLASS,
    PERMISSIONS.REMOVE_STUDENT_FROM_CLASS,
    PERMISSIONS.TRANSFER_STUDENT,
    PERMISSIONS.PROMOTE_STUDENT,
    PERMISSIONS.MESSAGE_PARENTS_LIMITED,
    PERMISSIONS.VIEW_CLASS_LIST,
    PERMISSIONS.TAKE_ATTENDANCE,
    PERMISSIONS.EDIT_ATTENDANCE,
    PERMISSIONS.VIEW_OWN_CLASS_ATTENDANCE,
    PERMISSIONS.ENTER_SCORES,
    PERMISSIONS.EDIT_SCORES,
    PERMISSIONS.ADD_TEACHER_COMMENTS,
    PERMISSIONS.VIEW_OWN_CLASS_REPORTS,
    PERMISSIONS.CREATE_ASSIGNMENT,
    PERMISSIONS.GRADE_ASSIGNMENT,
    PERMISSIONS.UPLOAD_MATERIALS,
    PERMISSIONS.VIEW_OWN_CLASS_ASSIGNMENTS,
    PERMISSIONS.MESSAGE_ADMIN,
  ],

  admin: [
    PERMISSIONS.DEACTIVATE_USERS,
    PERMISSIONS.CREATE_STUDENT,
    PERMISSIONS.EDIT_STUDENT,
    PERMISSIONS.VIEW_ALL_STUDENTS,
    PERMISSIONS.BULK_UPLOAD_STUDENTS,
    PERMISSIONS.ADD_PARENT,
    PERMISSIONS.EDIT_PARENT,
    PERMISSIONS.VIEW_PARENT_CONTACT,
    PERMISSIONS.MESSAGE_PARENTS_FULL,
    PERMISSIONS.CREATE_CLASS,
    PERMISSIONS.ASSIGN_TEACHER_TO_CLASS,
    PERMISSIONS.EDIT_CLASS,
    PERMISSIONS.VIEW_CLASS_LIST,
    PERMISSIONS.VIEW_OWN_CLASS_ATTENDANCE,
    PERMISSIONS.VIEW_ALL_ATTENDANCE,
    PERMISSIONS.GENERATE_REPORT_CARDS,
    PERMISSIONS.VIEW_ALL_REPORTS,
    PERMISSIONS.RECORD_PAYMENT,
    PERMISSIONS.CONFIRM_BANK_TRANSFER,
    PERMISSIONS.VIEW_PAYMENT_STATUS,
    PERMISSIONS.EDIT_PAYMENT_RECORDS,
    PERMISSIONS.GENERATE_FINANCIAL_REPORTS,
    PERMISSIONS.TRACK_DEBTORS,
    PERMISSIONS.VIEW_ALL_ASSIGNMENTS,
    PERMISSIONS.SEND_ANNOUNCEMENTS,
    PERMISSIONS.MESSAGE_TEACHERS,
    PERMISSIONS.MESSAGE_ADMIN,
    PERMISSIONS.BACKUP_EXPORT_DATA,
  ],

  // super_admin inherits every permission
  super_admin: Object.values(PERMISSIONS) as Permission[],
};

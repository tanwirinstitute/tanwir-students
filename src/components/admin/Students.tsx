import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { AuthService, AuthorizedUser } from '../../services/auth';
import '../../styles/students.css';

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

interface StudentWithDetails extends Omit<AuthorizedUser, 'CreatedAt'> {
  CreatedAt?: Date | FirestoreTimestamp;
  created?: Date | FirestoreTimestamp;
  createdAt?: Date | FirestoreTimestamp;
  studentInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    gender?: string;
    age?: string;
    studentType?: string;
    password?: string;
    [key: string]: any;
  };
  courses?: Array<{
    courseRef: string;
    courseId?: string;
    courseName?: string;
    courseType?: string;
    academicYear?: string;
    createdOn?: string;
    orderNumber?: string;
    metadata?: { lastUpdated?: string; orderNumber?: string; [key: string]: any };
    guidanceDetails?: {
      imageUrl?: string;
      module?: string;
      plan?: string;
      section?: string;
      status?: string;
      [key: string]: any;
    };
    placementInfo?: {
      arabicProficiency?: string;
      interestReason?: string;
      level?: string;
      listeningAbility?: string;
      plan?: string;
      previousTopics?: string;
      readingAbility?: string;
      section?: string;
      studiedIslamicSciences?: string;
      writingAbility?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }>;
}

type ViewMode = 'table' | 'stats';

interface Cohort {
  key: string;
  courseName: string;
  year: string;
  section: string;
  academicYear: string;
  students: StudentWithDetails[];
}

// --- Pure helpers ---

function extractCourseId(courseRef: string): string {
  if (!courseRef) return '';
  return courseRef.includes('/') ? courseRef.split('/').pop() || courseRef : courseRef;
}

function extractYearFromName(name: string): string {
  const match = name.match(/Year\s*(\d+)/i);
  return match ? match[1] : '';
}

function getCourseSection(course: any): string {
  return course.section || course.guidanceDetails?.section || course.placementInfo?.section || '';
}

function getCoursePlan(course: any): string {
  return course.plan || course.guidanceDetails?.plan || course.placementInfo?.plan || 'N/A';
}

function getCourseStatus(course: any): string {
  return course.status || course.guidanceDetails?.status || 'pending';
}

function getDisplayName(student: StudentWithDetails): string {
  if (student.studentInfo) {
    const { firstName, lastName } = student.studentInfo;
    if (firstName || lastName) return `${firstName || ''} ${lastName || ''}`.trim();
  }
  return `${student.FirstName || ''} ${student.LastName || ''}`.trim() || 'Unknown';
}

function getEmail(student: StudentWithDetails): string {
  return student.studentInfo?.email || student.email || 'N/A';
}

function getCreatedDate(student: StudentWithDetails): Date | null {
  const ts = student.createdAt || student.created || student.CreatedAt;
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if ('seconds' in ts) return new Date((ts as FirestoreTimestamp).seconds * 1000);
  return null;
}

function formatDate(student: StudentWithDetails): string {
  const d = getCreatedDate(student);
  return d ? d.toLocaleDateString() : 'N/A';
}

function csvCell(value: string): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCohorts(
  students: StudentWithDetails[],
  courseYearMap: Map<string, string>
): Cohort[] {
  const map = new Map<string, Cohort>();

  for (const student of students) {
    const enrollments = student.courses;

    if (!enrollments || enrollments.length === 0) {
      const key = '__no_course__';
      if (!map.has(key)) {
        map.set(key, { key, courseName: 'No Course Assigned', year: '', section: '', academicYear: '', students: [] });
      }
      const cohort = map.get(key)!;
      if (!cohort.students.some(s => s.uid === student.uid)) cohort.students.push(student);
      continue;
    }

    for (const course of enrollments) {
      const courseName = course.courseName || 'Unnamed Course';
      const courseId = extractCourseId(course.courseRef || course.courseId || '');
      const year =
        course.year ||
        extractYearFromName(courseName) ||
        courseYearMap.get(courseId) ||
        '';
      const section = getCourseSection(course);
      const academicYear = course.academicYear || '';
      const key = `${courseName}|${year}|${section}|${academicYear}`;

      if (!map.has(key)) {
        map.set(key, { key, courseName, year, section, academicYear, students: [] });
      }
      const cohort = map.get(key)!;
      if (!cohort.students.some(s => s.uid === student.uid)) cohort.students.push(student);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.academicYear !== b.academicYear) return b.academicYear.localeCompare(a.academicYear); // newest first
    if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
    if (a.year !== b.year) return a.year.localeCompare(b.year);
    return a.section.localeCompare(b.section);
  });
}

// --- Component ---

export const Students: React.FC = () => {
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [collapsedCohorts, setCollapsedCohorts] = useState<Set<string>>(new Set());
  const [courseYearMap, setCourseYearMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersSnap, coursesSnap] = await Promise.all([
          AuthService.getInstance().getAllUsers(),
          getDocs(collection(db, 'courses')),
        ]);

        const cMap = new Map<string, string>();
        coursesSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          const year = d.year || d.Year || '';
          if (year) cMap.set(docSnap.id, String(year));
        });
        setCourseYearMap(cMap);

        const onlyStudents = usersSnap.filter(u => u.Role !== 'admin') as StudentWithDetails[];
        setStudents(onlyStudents);
        setFilteredStudents(onlyStudents);
        setError(null);
      } catch (err) {
        console.error('Error fetching students:', err);
        setError('Failed to load students. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Collect all distinct academic years present in the data for the dropdown
  const allAcademicYears = useMemo(() => {
    const years = new Set<string>();
    for (const s of students) {
      for (const c of s.courses || []) {
        if (c.academicYear) years.add(c.academicYear);
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a)); // newest first
  }, [students]);

  useEffect(() => {
    let result = students;

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s =>
        getDisplayName(s).toLowerCase().includes(lower) ||
        getEmail(s).toLowerCase().includes(lower) ||
        (s.courses?.map(c => c.courseName || '').join(' ') || '').toLowerCase().includes(lower)
      );
    }

    if (academicYearFilter) {
      result = result.filter(s =>
        s.courses?.some(c => c.academicYear === academicYearFilter)
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(s => { const d = getCreatedDate(s); return d !== null && d >= from; });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(s => { const d = getCreatedDate(s); return d !== null && d <= to; });
    }

    setFilteredStudents(result);
  }, [searchTerm, academicYearFilter, dateFrom, dateTo, students]);

  const cohorts = useMemo(
    () => buildCohorts(filteredStudents, courseYearMap),
    [filteredStudents, courseYearMap]
  );

  const hasActiveFilters = !!(searchTerm || academicYearFilter || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchTerm('');
    setAcademicYearFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const toggleCohort = (key: string) => {
    setCollapsedCohorts(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Match a student's enrollment to a specific cohort
  const matchCourse = (student: StudentWithDetails, cohort: Cohort) =>
    student.courses?.find(c => {
      const cId = extractCourseId(c.courseRef || c.courseId || '');
      const year = c.year || extractYearFromName(c.courseName || '') || courseYearMap.get(cId) || '';
      return (
        c.courseName === cohort.courseName &&
        year === cohort.year &&
        getCourseSection(c) === cohort.section &&
        (c.academicYear || '') === cohort.academicYear
      );
    });

  const exportCSV = () => {
    const header = ['Name', 'Email', 'Phone', 'Gender', 'Age', 'Student Type', 'Academic Year', 'Course', 'Year', 'Section', 'Status', 'Join Date'];
    const rows: string[] = [header.map(csvCell).join(',')];

    for (const cohort of cohorts) {
      for (const student of cohort.students) {
        const course = matchCourse(student, cohort);
        rows.push([
          csvCell(getDisplayName(student)),
          csvCell(getEmail(student)),
          csvCell(student.studentInfo?.phone || ''),
          csvCell(student.studentInfo?.gender || ''),
          csvCell(String(student.studentInfo?.age || '')),
          csvCell(student.studentInfo?.studentType || ''),
          csvCell(cohort.academicYear),
          csvCell(cohort.courseName),
          csvCell(cohort.year),
          csvCell(cohort.section),
          csvCell(course ? getCourseStatus(course) : ''),
          csvCell(formatDate(student)),
        ].join(','));
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${academicYearFilter || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getRoleClass = (role?: string) => (role === 'admin' ? 'admin' : 'student');
  const getRoleDisplay = (role?: string) => (role === 'admin' ? 'Admin' : 'Student');

  return (
    <div className="students-container">
      {!selectedStudent && (
        <>
          {/* Toolbar */}
          <div className="students-toolbar">
            <div className="students-filter-row">
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search by name, email, or course..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button className="clear-search" onClick={() => setSearchTerm('')} aria-label="Clear search">
                    ×
                  </button>
                )}
              </div>

              {allAcademicYears.length > 0 && (
                <select
                  className="filter-select"
                  value={academicYearFilter}
                  onChange={e => setAcademicYearFilter(e.target.value)}
                >
                  <option value="">All academic years</option>
                  {allAcademicYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              <div className="date-filter-group">
                <label className="date-label">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="date-input" />
                <label className="date-label">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="date-input" />
              </div>

              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={clearFilters}>Clear all</button>
              )}
            </div>

            <div className="students-actions-row">
              <span className="students-count">
                {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                {hasActiveFilters && ` (filtered from ${students.length})`}
              </span>
              <div className="view-toggle">
                <button className={`view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')}>
                  Table
                </button>
                <button className={`view-btn${viewMode === 'stats' ? ' active' : ''}`} onClick={() => setViewMode('stats')}>
                  Stats
                </button>
              </div>
              <button className="export-btn" onClick={exportCSV} disabled={filteredStudents.length === 0}>
                Export CSV
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="loading">Loading students...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : filteredStudents.length === 0 ? (
            <div className="no-students">
              {hasActiveFilters ? 'No students match your filters.' : 'No students found.'}
            </div>
          ) : viewMode === 'table' ? (
            <div className="cohorts-list">
              {cohorts.map(cohort => {
                const isCollapsed = collapsedCohorts.has(cohort.key);
                return (
                  <div key={cohort.key} className="cohort-section">
                    <button
                      className={`cohort-header${isCollapsed ? ' collapsed' : ''}`}
                      onClick={() => toggleCohort(cohort.key)}
                    >
                      <span className="cohort-chevron">{isCollapsed ? '▶' : '▼'}</span>
                      <span className="cohort-title">
                        <span className="cohort-course-name">{cohort.courseName}</span>
                        {cohort.academicYear && (
                          <span className="cohort-tag cohort-tag--academic">{cohort.academicYear}</span>
                        )}
                        {cohort.year && (
                          <span className="cohort-tag">Year {cohort.year}</span>
                        )}
                        {cohort.section && (
                          <span className="cohort-tag">{cohort.section}</span>
                        )}
                      </span>
                      <span className="cohort-count">
                        {cohort.students.length} student{cohort.students.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="students-list">
                        <div className="table-scroll-container">
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Gender</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cohort.students.map(student => {
                                const course = matchCourse(student, cohort);
                                const status = course ? getCourseStatus(course) : null;
                                return (
                                  <tr key={student.uid}>
                                    <td>{getDisplayName(student)}</td>
                                    <td>{getEmail(student)}</td>
                                    <td>{student.studentInfo?.gender || 'N/A'}</td>
                                    <td className={`role-text ${getRoleClass(student.Role)}`}>
                                      {getRoleDisplay(student.Role)}
                                    </td>
                                    <td>
                                      <span className={`status-badge ${status ?? 'pending'}`}>
                                        {(status ?? 'pending').charAt(0).toUpperCase() + (status ?? 'pending').slice(1)}
                                      </span>
                                    </td>
                                    <td>{formatDate(student)}</td>
                                    <td>
                                      <button className="view-button" onClick={() => setSelectedStudent(student)}>
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="stats-grid">
              {cohorts.map(cohort => {
                const genderCounts = cohort.students.reduce((acc, s) => {
                  const g = s.studentInfo?.gender || 'Unknown';
                  acc[g] = (acc[g] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                const statusCounts = cohort.students.reduce((acc, s) => {
                  const course = matchCourse(s, cohort);
                  const st = course ? getCourseStatus(course) : 'pending';
                  acc[st] = (acc[st] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <div key={cohort.key} className="stats-card">
                    <div className="stats-card-header">
                      <h3 className="stats-card-title">{cohort.courseName}</h3>
                      <div className="stats-card-tags">
                        {cohort.academicYear && (
                          <span className="cohort-tag cohort-tag--academic">{cohort.academicYear}</span>
                        )}
                        {cohort.year && <span className="cohort-tag">Year {cohort.year}</span>}
                        {cohort.section && <span className="cohort-tag">{cohort.section}</span>}
                      </div>
                    </div>

                    <div className="stats-card-body">
                      <div className="stats-total">
                        <span className="stats-big-num">{cohort.students.length}</span>
                        <span className="stats-big-label">students</span>
                      </div>

                      {Object.keys(genderCounts).length > 0 && (
                        <div className="stats-breakdown">
                          <div className="stats-breakdown-title">By gender</div>
                          {Object.entries(genderCounts).map(([g, n]) => (
                            <div key={g} className="stats-breakdown-row">
                              <span className="stats-breakdown-label">{g}</span>
                              <span className="stats-breakdown-bar-wrap">
                                <span className="stats-breakdown-bar" style={{ width: `${Math.round((n / cohort.students.length) * 100)}%` }} />
                              </span>
                              <span className="stats-breakdown-val">{n}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {Object.keys(statusCounts).length > 0 && (
                        <div className="stats-breakdown">
                          <div className="stats-breakdown-title">By status</div>
                          {Object.entries(statusCounts).map(([st, n]) => (
                            <div key={st} className="stats-breakdown-row">
                              <span className={`status-badge ${st}`}>
                                {st.charAt(0).toUpperCase() + st.slice(1)}
                              </span>
                              <span className="stats-breakdown-val">{n}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button className="stats-view-students-btn" onClick={() => setViewMode('table')}>
                      View in table
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Student detail */}
      {selectedStudent && (
        <div className="student-detail-content">
          <div className="detail-header">
            <h3>{getDisplayName(selectedStudent)}</h3>
            <button className="back-button" onClick={() => setSelectedStudent(null)}>
              Back to Students
            </button>
          </div>
          <div className="detail-content">
            <div className="detail-grid">
              <div className="detail-section">
                <h4>Personal Information</h4>
                {selectedStudent.studentInfo ? (
                  <>
                    <div className="detail-item"><span className="label">Email:</span><span>{getEmail(selectedStudent)}</span></div>
                    <div className="detail-item"><span className="label">Phone:</span><span>{selectedStudent.studentInfo.phone || 'N/A'}</span></div>
                    <div className="detail-item"><span className="label">Gender:</span><span>{selectedStudent.studentInfo.gender || 'N/A'}</span></div>
                    <div className="detail-item"><span className="label">Age:</span><span>{selectedStudent.studentInfo.age || 'N/A'}</span></div>
                    <div className="detail-item"><span className="label">Student Type:</span><span>{selectedStudent.studentInfo.studentType || 'N/A'}</span></div>
                  </>
                ) : (
                  <div className="no-info">No personal information available</div>
                )}
                <div className="detail-item">
                  <span className="label">Role:</span>
                  <span className={`role-text ${getRoleClass(selectedStudent.Role)}`}>
                    {getRoleDisplay(selectedStudent.Role)}
                  </span>
                </div>
              </div>

              <div className="detail-section">
                <h4>Enrolled Courses</h4>
                {selectedStudent.courses && selectedStudent.courses.length > 0 ? (
                  <div className="courses-list">
                    {selectedStudent.courses.map((course, index) => (
                      <div key={course.courseId || index} className="course-item">
                        <h5>{course.courseName || 'Unnamed Course'}</h5>
                        <div className="course-details">
                          {course.academicYear && (
                            <div className="detail-item">
                              <span className="label">Academic Year:</span>
                              <span><span className="cohort-tag cohort-tag--academic">{course.academicYear}</span></span>
                            </div>
                          )}
                          <div className="detail-item"><span className="label">Type:</span><span>{course.courseType || 'N/A'}</span></div>
                          <div className="detail-item"><span className="label">Section:</span><span>{getCourseSection(course) || 'N/A'}</span></div>
                          <div className="detail-item"><span className="label">Plan:</span><span>{getCoursePlan(course)}</span></div>
                          <div className="detail-item">
                            <span className="label">Status:</span>
                            <span className={`status-text ${getCourseStatus(course)}`}>
                              {getCourseStatus(course).charAt(0).toUpperCase() + getCourseStatus(course).slice(1)}
                            </span>
                          </div>
                          {course.createdOn && (
                            <div className="detail-item"><span className="label">Created:</span><span>{new Date(course.createdOn).toLocaleDateString()}</span></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-courses">No courses enrolled</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

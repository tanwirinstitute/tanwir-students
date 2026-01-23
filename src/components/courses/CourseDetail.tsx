import React, { useEffect, useState } from 'react';
import { usePage } from '../../context/PageContext';
import { CourseService } from '../../services/courses/service/CourseService';
import { Course } from '../../services/courses/types/course';
import { AuthService, UserRole } from '../../services/auth';
import { CourseEnrollment } from '../../services/auth/types';
import { AssignmentService } from '../../services/assignments/service/AssignmentService';
import { CourseAssignments } from '../assignments/CourseAssignments';
import { EmailService } from '../../services/email/emailService';
import { CourseAttachments } from './CourseAttachments';
import { DriveAttachmentForm } from './DriveAttachmentForm';
import { Videos } from '../videos/Videos';
import { CourseAttendance } from './CourseAttendance';

// Syllabus data structure
interface SyllabusSemester {
  name: string;
  courses: string[];
}

interface WeeklyFocus {
  weeks: string;
  theme: string;
  description: string;
}

interface WeeklyScheduleItem {
  week: number;
  date?: string;
  topic?: string;
  description?: string;
  Iman?: string;
  Ihsan?: string;
}

interface Assessment {
  type: string;
  components: string[];
}

interface SyllabusData {
  title: string;
  classTime?: string;
  timeframe?: string;
  instructors?: string[] | string;
  format?: string;
  prerequisites?: string;
  programOverview?: string;
  learningOutcomes?: string[];
  weeklyFocus?: WeeklyFocus[];
  assessment?: Assessment;
  requiredTexts?: string[];
  weeklySchedule?: WeeklyScheduleItem[];
  subjects?: string[];
  
  // Legacy fields for backward compatibility
  overview?: string[];
  audience?: string[];
  semesters?: SyllabusSemester[];
}

type TabType = 'overview' | 'syllabus' | 'grades' | 'assignments' | 'attachments' | 'videos' | 'attendance';

interface StudentGrade {
  assignmentId: string;
  assignmentTitle: string;
  score: number;
  totalPoints: number;
  submittedAt: Date;
}

interface StudentGrades {
  studentId: string;
  studentName: string;
  grades: StudentGrade[];
}

export const CourseDetail: React.FC = () => {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [allStudentGrades, setAllStudentGrades] = useState<StudentGrades[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [enrolledSemesters, setEnrolledSemesters] = useState<string[]>([]);
  const { courseId } = usePage();
  
  useEffect(() => {
    const courseService = CourseService.getInstance();
    const authService = AuthService.getInstance();
  
    const fetchCourseDetail = async () => {
      if (!courseId) return;
  
      setLoading(true);
  
      // Get course from cache (which is now maintained by real-time listener)
      const fetchedCourse = await courseService.getCourseById(courseId);
      setCourse(fetchedCourse ?? null);
      
      console.log('CourseDetail - Course data:', {
        courseId,
        playlist: fetchedCourse?.playlist,
        Playlist: fetchedCourse?.Playlist,
        fallPlaylist: fetchedCourse?.fallPlaylist,
        FallPlaylist: fetchedCourse?.FallPlaylist,
        springPlaylist: fetchedCourse?.springPlaylist,
        SpringPlaylist: fetchedCourse?.SpringPlaylist
      });
      
      // Get user role
      const role = await authService.getUserRole();
      setUserRole(role);

      // Check if current user is enrolled and get semester enrollment
      const currentUser = authService.getCurrentUser();
      if (currentUser && fetchedCourse) {
        courseService.isStudentEnrolled(courseId, currentUser.uid);
        
        // Get user's enrollment data to determine which semesters they're enrolled in
        const userData = await authService.getUserData(currentUser.uid);
        if (userData?.courses) {
          const enrollment: CourseEnrollment | undefined = userData.courses.find((c: any) => {
            const courseRef = c.courseRef || '';
            return courseRef.includes(courseId) || courseId.includes(courseRef.split('/')[1]);
          });
          
          if (enrollment?.guidanceDetails?.plan) {
            // Map plan values to semester tabs
            const plan = enrollment.guidanceDetails.plan;
            if (plan === 'Full Year') {
              setEnrolledSemesters(['fall', 'spring']);
            } else if (plan === 'Fall Semester') {
              setEnrolledSemesters(['fall']);
            } else if (plan === 'Spring Semester') {
              setEnrolledSemesters(['spring']);
            }
          }
        }
      }
      
      // Fetch enrolled students from users collection
      try {
        const allUsers = await authService.getAllUsers();
        
        // Filter users who are enrolled in this course
        // The courseRef format is 'courses/CourseName'
        const enrolled = allUsers.filter(user => {
          if (!user.courses || !Array.isArray(user.courses)) {
            return false;
          }
          
          return user.courses.some(course => {
            // Check different possible formats of course reference
            if (course.courseRef === `courses/${courseId}`) {
              return true;
            }
            
            // Also check if courseRef contains the courseId
            if (course.courseRef && typeof course.courseRef === 'string' && 
                (course.courseRef.includes(courseId) || courseId.includes(course.courseRef.split('/')[1]))) {
              return true;
            }
            
            
            return false;
          });
        });
        
        console.log(`Found ${enrolled.length} students enrolled in course ${courseId}`);
        setEnrolledStudents(enrolled);
      } catch (error) {
        console.error('Error fetching enrolled students:', error);
      }
      
      setLoading(false);
    };
  
    fetchCourseDetail();
  }, [courseId]);
  
  useEffect(() => {
    // Fetch grades data when the grades tab is active and we have course data
    if (activeTab === 'grades' && course && userRole) {
      fetchGradesData();
    }
  }, [activeTab, course, userRole]);
  
  const fetchGradesData = async () => {
    if (!course || !userRole) return;
    
    setGradesLoading(true);
    
    try {
      const authService = AuthService.getInstance();
      const assignmentService = AssignmentService.getInstance();
      
      // Get all assignments for this course
      const assignments = await assignmentService.getAssignments();
      const courseAssignments = assignments.filter(a => a.CourseId === course.Id);
      
      // Fetch all quiz results for this course in a single batch
      const allResults = await assignmentService.getAllQuizResultsForCourse(course.Id);
      
      if (userRole === 'student') {
        // For students, filter only their own grades
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          const studentGrades: StudentGrade[] = [];
          
          // Process each assignment
          for (const assignment of courseAssignments) {
            const assignmentResults = allResults[assignment.AssignmentId] || [];
            
            // Find this student's result for this assignment
            const studentResult = assignmentResults.find(r => r.StudentId === currentUser.uid);
            
            if (studentResult) {
              studentGrades.push({
                assignmentId: assignment.AssignmentId,
                assignmentTitle: assignment.Title,
                score: studentResult.score || 0,
                totalPoints: assignment.Points,
                submittedAt: studentResult.submittedAt
              });
            }
          }
          
          setStudentGrades(studentGrades);
        }
      } else if (userRole === 'admin') {
        // For admins, organize grades by student
        if (enrolledStudents && enrolledStudents.length > 0) {
          const studentGradesMap: Record<string, StudentGrades> = {};
          
          // Initialize the map with student info
          for (const student of enrolledStudents) {
            const studentId = student.uid || student.id || student.studentId;
            const studentName = getDisplayName(student);
            
            studentGradesMap[studentId] = {
              studentId,
              studentName,
              grades: []
            };
          }
          
          // Process each assignment
          for (const assignment of courseAssignments) {
            const assignmentResults = allResults[assignment.AssignmentId] || [];
            
            // Process each result for this assignment
            for (const result of assignmentResults) {
              const studentId = result.StudentId;
              
              // Only process results for enrolled students
              if (studentGradesMap[studentId]) {
                studentGradesMap[studentId].grades.push({
                  assignmentId: assignment.AssignmentId,
                  assignmentTitle: assignment.Title,
                  score: result.score || 0,
                  totalPoints: assignment.Points,
                  submittedAt: result.submittedAt
                });
              }
            }
          }
          
          // Convert the map to an array
          const allStudentGrades = Object.values(studentGradesMap).filter(s => s.grades.length > 0);
          setAllStudentGrades(allStudentGrades);
        }
      }
    } catch (error) {
      console.error('Error fetching grades data:', error);
    } finally {
      setGradesLoading(false);
    }
  };
  
  const toggleStudentExpand = (studentId: string) => {
    console.log('Toggling student:', studentId, 'Current expanded:', expandedStudentId);
    // If the student is already expanded, close it
    // Otherwise, open this student and close any others
    setExpandedStudentId(prevId => prevId === studentId ? null : studentId);
  };

  const getDisplayName = (student: any) => {
    // Try to get name from studentInfo first
    if (student.studentInfo) {
      const info = student.studentInfo;
      if (info.firstName && info.lastName) {
        return `${info.firstName} ${info.lastName}`;
      } else if (info.firstName) {
        return info.firstName;
      } else if (info.lastName) {
        return info.lastName;
      } else if (info.name) {
        return info.name;
      }
    }
    
    // Try email as name if it's not a UID
    if (student.email && !student.email.includes('ID:') && !student.uid.includes(student.email)) {
      return student.email;
    }
    
    // Fall back to FirstName/LastName
    if (student.FirstName || student.LastName) {
      return `${student.FirstName || ''} ${student.LastName || ''}`.trim();
    }
    
    // Fall back to displayName
    if (student.displayName) {
      return student.displayName;
    }
    
    // If we have an email that looks like a name (contains @ but not the UID)
    if (student.uid && student.uid.includes('@') && !student.uid.includes('ID:')) {
      return student.uid;
    }
    
    return 'Unknown';
  };

  const sendWelcomeEmails = async () => {
    if (emailSending) return;
    setEmailSending(true);
    setEmailSent(false); // Reset email sent status
    
    try {
      const emailService = EmailService.getInstance();
      
      // Filter out students without email addresses in studentInfo
      const studentsWithEmails = enrolledStudents.filter(student => 
        student.studentInfo?.email || student.email
      );
      
      if (studentsWithEmails.length === 0) {
        console.error('No valid email addresses found for enrolled students');
        alert('No valid email addresses found for enrolled students');
        setEmailSending(false);
        return;
      }
      
      let success = false;
      
      // Check if this is an Associates Program course
      const isAssociatesProgram = course?.Name?.toLowerCase().includes('associate');
      
      if (isAssociatesProgram) {
        // Format recipients for Associates Program
        const recipients = studentsWithEmails.map(student => ({
          email: student.studentInfo?.email || student.email,
          name: getDisplayName(student)
        }));
        
        console.log(`Sending Associates Program welcome emails to ${recipients.length} students`);
        success = await emailService.sendAssociatesProgramWelcomeEmails(recipients);
      } else {
        // Default to Prophetic Guidance format (just email addresses)
        const studentEmails = studentsWithEmails.map(student => 
          student.studentInfo?.email || student.email
        );
        
        console.log(`Sending Prophetic Guidance welcome emails to ${studentEmails.length} students`);
        success = await emailService.sendPropheticGuidanceWelcomeEmails(studentEmails);
      }
      
      if (success) {
        setEmailSent(true);
        alert(`Welcome emails sent successfully to ${studentsWithEmails.length} students!`);
      } else {
        alert('Failed to send welcome emails. Please check the console for details.');
      }
    } catch (error) {
      console.error('Error sending welcome emails:', error);
      alert('Error sending welcome emails: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setEmailSending(false);
    }
  };

  const renderContent = () => {
    if (activeTab === 'overview' && course) {
      return (
        <div className="course-overview">
          <div className="course-description">
            <h3>About this course</h3>
            <p>{course.Description}</p>
          </div>
          
          <div className="course-instructor">
            <h3>Instructor</h3>
            <p>{course.CreatedBy}</p>
          </div>
          
          <div className="course-students">
            <h3>Enrolled Students</h3>
            
            {enrolledStudents.length > 0 ? (
              <ul className="students-list">
                {enrolledStudents.map((student, index) => (
                  <li key={student.uid || index} className="student-item">
                    <span className="student-name">
                      {getDisplayName(student)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No students enrolled yet.</p>
            )}
            
            {userRole === 'admin' && (
              <button onClick={sendWelcomeEmails} disabled={emailSending}>
                {emailSending ? 'Sending...' : emailSent ? 'Emails sent!' : 'Send welcome emails'}
              </button>
            )}
          </div>
        </div>
      );
    }
    
    if (activeTab === 'syllabus') {
      return (
        <div className="course-syllabus">
          <h3>Course Syllabus</h3>
          {course?.Syllabus ? (
            (() => {
              let syllabus: SyllabusData;
              try {
                console.log('Parsing syllabus:', course.Syllabus);
                syllabus = JSON.parse(course.Syllabus) as SyllabusData;
                console.log('Parsed syllabus:', syllabus);
              } catch (err) {
                console.error('Error parsing syllabus:', err);
                return <p className="error">Invalid syllabus format.</p>;
              }

              return (
                <div className="syllabus-content" style={{ maxWidth: '100%', overflow: 'auto' }}>
                  <h4>{syllabus.title}</h4>
                  
                  <div className="syllabus-metadata" style={{ marginBottom: '20px' }}>
                    {syllabus.classTime && (
                      <p><strong>Class Time:</strong> {syllabus.classTime}</p>
                    )}
                    {syllabus.timeframe && (
                      <p><strong>Timeframe:</strong> {syllabus.timeframe}</p>
                    )}
                    {syllabus.instructors && course && (
                      <div className="instructors-section">
                        <p><strong>Instructors:</strong></p>
                        <ul className="instructors-list">
                          {course.CreatedBy ? 
                            course.CreatedBy.split(',').map((instructor, idx) => (
                              <li key={`instructor-${idx}`}>{instructor.trim()}</li>
                            ))
                            : <li>No instructor information available</li>
                          }
                        </ul>
                      </div>
                    )}
                    {syllabus.format && (
                      <p><strong>Format:</strong> {syllabus.format}</p>
                    )}
                    {syllabus.prerequisites && (
                      <p><strong>Prerequisites:</strong> {syllabus.prerequisites}</p>
                    )}
                  </div>

                  {syllabus.programOverview && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Program Overview</h5>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{syllabus.programOverview}</p>
                    </div>
                  )}
                  
                  {syllabus.subjects && syllabus.subjects.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Subjects</h5>
                      <ul>
                        {syllabus.subjects.map((subject, index) => (
                          <li key={`subject-${index}`}>{subject}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {syllabus.learningOutcomes && syllabus.learningOutcomes.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Learning Outcomes</h5>
                      <ul>
                        {syllabus.learningOutcomes.map((outcome, index) => (
                          <li key={`outcome-${index}`}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {syllabus.weeklyFocus && syllabus.weeklyFocus.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Weekly Focus</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                        {syllabus.weeklyFocus.map((focus, index) => (
                          <div key={`focus-${index}`} className="syllabus-card">
                            <h6 style={{ marginTop: '0' }}>Weeks {focus.weeks}</h6>
                            <p><strong>Theme:</strong> {focus.theme}</p>
                            <p style={{ marginBottom: '0' }}><strong>Description:</strong> {focus.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {syllabus.assessment && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Assessment</h5>
                      <p><strong>Type:</strong> {syllabus.assessment.type}</p>
                      {syllabus.assessment.components && syllabus.assessment.components.length > 0 && (
                        <div>
                          <p><strong>Components:</strong></p>
                          <ul>
                            {syllabus.assessment.components.map((component, index) => (
                              <li key={`component-${index}`}>{component}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {syllabus.requiredTexts && syllabus.requiredTexts.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Required Texts</h5>
                      <ul>
                        {syllabus.requiredTexts.map((text, index) => (
                          <li key={`text-${index}`}>{text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {syllabus.weeklySchedule && syllabus.weeklySchedule.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Weekly Schedule</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                        {syllabus.weeklySchedule.map((schedule, index) => (
                          <div key={`schedule-${index}`} className="syllabus-card">
                            <div className="syllabus-card-header">
                              <h6 style={{ marginTop: '0', marginBottom: '5px' }}>Week {schedule.week}</h6>
                              {schedule.date && (
                                <span className="schedule-date">{schedule.date}</span>
                              )}
                            </div>
                            
                            {/* Traditional topic/description format */}
                            {schedule.topic && (
                              <p><strong>Topic:</strong> {schedule.topic}</p>
                            )}
                            {schedule.description && (
                              <p><strong>Description:</strong> {schedule.description}</p>
                            )}
                            
                            {/* New Iman/Ihsan format */}
                            {(schedule.Iman || schedule.Ihsan) && (
                              <div className="schedule-subjects">
                                {schedule.Iman && (
                                  <div className="schedule-subject">
                                    <h6 className="subject-title">Iman</h6>
                                    <p>{schedule.Iman}</p>
                                  </div>
                                )}
                                {schedule.Ihsan && (
                                  <div className="schedule-subject">
                                    <h6 className="subject-title">Ihsan</h6>
                                    <p>{schedule.Ihsan}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Legacy format support */}
                  {syllabus.overview && syllabus.overview.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Overview</h5>
                      <ul>
                        {syllabus.overview.map((item: string, index: number) => (
                          <li key={`overview-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {syllabus.audience && syllabus.audience.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Who is this for?</h5>
                      <ul>
                        {syllabus.audience.map((item: string, index: number) => (
                          <li key={`audience-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {syllabus.semesters && syllabus.semesters.length > 0 && (
                    <div className="syllabus-section" style={{ marginBottom: '20px' }}>
                      <h5>Semesters</h5>
                      {syllabus.semesters.map((sem: SyllabusSemester, i: number) => (
                        <div key={`semester-${i}`} style={{ marginBottom: '10px' }}>
                          <strong>{sem.name}</strong>
                          <ul>
                            {sem.courses.map((course: string, j: number) => (
                              <li key={`course-${j}`}>{course}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <p className="empty">No syllabus content available for this course.</p>
          )}
        </div>
      );
    }
    
    if (activeTab === 'grades') {
      if (gradesLoading) {
        return <p className="loading">Loading grades...</p>;
      }
      
      if (userRole === 'student') {
        return (
          <div className="student-grades">
            <h3>Your Grades</h3>
            {studentGrades.length > 0 ? (
              <div className="grades-table-container">
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Score</th>
                      <th>Percentage</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentGrades.map((grade, index) => (
                      <tr key={index}>
                        <td>{grade.assignmentTitle}</td>
                        <td>{grade.score} / {grade.totalPoints}</td>
                        <td>{Math.round((grade.score / grade.totalPoints) * 100)}%</td>
                        <td>{grade.submittedAt.toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>Total</strong></td>
                      <td>
                        <strong>
                          {studentGrades.reduce((sum, grade) => sum + grade.score, 0)} / 
                          {studentGrades.reduce((sum, grade) => sum + grade.totalPoints, 0)}
                        </strong>
                      </td>
                      <td>
                        <strong>
                          {Math.round(
                            (studentGrades.reduce((sum, grade) => sum + grade.score, 0) / 
                             studentGrades.reduce((sum, grade) => sum + grade.totalPoints, 0)) * 100
                          )}%
                        </strong>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="empty">No grades available yet.</p>
            )}
          </div>
        );
      } else if (userRole === 'admin') {
        return (
          <div className="admin-grades">
            <h3>Student Grades</h3>
            {allStudentGrades.length > 0 ? (
              <div className="student-grades-list">
                {allStudentGrades.map((student) => {
                  console.log('Rendering student:', student.studentName, 'ID:', student.studentId, 'Expanded:', expandedStudentId === student.studentId);
                  return (
                    <div key={student.studentId} className="student-grades-item">
                      <div 
                        className="student-header" 
                        onClick={() => toggleStudentExpand(student.studentId)}
                      >
                        <h4>{student.studentName}</h4>
                        <span className={`expand-icon ${expandedStudentId === student.studentId ? 'expanded' : ''}`}>
                          {expandedStudentId === student.studentId ? '▼' : '►'}
                        </span>
                      </div>
                      
                      {expandedStudentId === student.studentId && (
                        <div className="grades-table-container">
                          <table className="grades-table">
                            <thead>
                              <tr>
                                <th>Assignment</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Submitted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {student.grades.map((grade, index) => (
                                <tr key={index}>
                                  <td>{grade.assignmentTitle}</td>
                                  <td>{grade.score} / {grade.totalPoints}</td>
                                  <td>{Math.round((grade.score / grade.totalPoints) * 100)}%</td>
                                  <td>{grade.submittedAt.toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td><strong>Total</strong></td>
                                <td>
                                  <strong>
                                    {student.grades.reduce((sum, grade) => sum + grade.score, 0)} / 
                                    {student.grades.reduce((sum, grade) => sum + grade.totalPoints, 0)}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {Math.round(
                                      (student.grades.reduce((sum, grade) => sum + grade.score, 0) / 
                                       student.grades.reduce((sum, grade) => sum + grade.totalPoints, 0)) * 100
                                    )}%
                                  </strong>
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty">No student grades available yet.</p>
            )}
          </div>
        );
      } else {
        return <p className="empty">You don't have permission to view grades.</p>;
      }
    }
    
    if (activeTab === 'assignments') {
      return (
        <div className="course-assignments">
          {courseId ? (
            <CourseAssignments courseId={courseId} />
          ) : (
            <p className="empty">Course ID not found.</p>
          )}
        </div>
      );
    }
    
    if (activeTab === 'attachments') {
      return (
        <div className="course-attachments-container">
          <div className="attachments-header">
            <h3>Course Attachments</h3>
            {userRole === 'admin' && (
              <button 
                className="add-attachment-btn" 
                onClick={() => setShowAttachmentForm(!showAttachmentForm)}
              >
                {showAttachmentForm ? 'Cancel' : 'Add Attachment'}
              </button>
            )}
          </div>
          
          {userRole === 'admin' && showAttachmentForm && (
            <div className="attachment-form-container">
              <DriveAttachmentForm 
                courseId={courseId || ''} 
                onAttachmentAdded={() => {
                  // Refresh course data when a new attachment is added
                  const courseService = CourseService.getInstance();
                  courseService.getCourseById(courseId || '').then(refreshedCourse => {
                    if (refreshedCourse) {
                      setCourse(refreshedCourse);
                      setShowAttachmentForm(false); // Hide form after successful submission
                    }
                  });
                }}
              />
            </div>
          )}
          
          <CourseAttachments 
            attachments={course?.Attachments || []} 
            enrolledSemesters={userRole === 'admin' ? undefined : enrolledSemesters}
          />
        </div>
      );
    }
    
    if (activeTab === 'videos') {
      return (
        <div className="course-videos">
          <h3>Course Videos</h3>
          <Videos 
            playlistId={course?.playlist || course?.Playlist}
            fallPlaylistId={course?.fallPlaylist || course?.FallPlaylist}
            springPlaylistId={course?.springPlaylist || course?.SpringPlaylist}
            enrolledSemesters={userRole === 'admin' ? undefined : enrolledSemesters}
          />
        </div>
      );
    }
    
    if (activeTab === 'attendance') {
      return (
        <div className="course-attendance-container">
          {courseId ? (
            <CourseAttendance courseId={courseId} enrolledStudents={enrolledStudents} />
          ) : (
            <p className="empty">Course ID not found.</p>
          )}
        </div>
      );
    }
    
    return null;
  };
  
  if (loading) {
    return <div className="loading">Loading course details...</div>;
  }
  
  if (!course) {
    return <div className="error">Course not found</div>;
  }
  
  return (
    <div className="course-detail">
      <div className="course-header">
        <h2>{course.Name}</h2>
        <div className="course-meta">
          <span className="level">Section: {course.Section} | Year: {course.Year}</span>
          <span className="enrollment">Students: {enrolledStudents.length}</span>
        </div>
      </div>
      
      <div className="tabs">
          {['overview', 'syllabus', 'grades', 'assignments', 'attachments', 'videos', 'attendance'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as TabType)}
              className={activeTab === tab ? 'active' : ''}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
      </div>
      
      {renderContent()}
    </div>
  );
};
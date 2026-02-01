import React, { useEffect, useState, useRef } from 'react';
import { Course } from '../../services/courses/types/course';
import { CourseService } from '../../services/courses/service/CourseService';
import { CourseCard } from './CourseCard';
import { AuthService, UserRole } from '../../services/auth';
import confusedImage from '../../assets/confused1.webp';

export const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  
  // Add a ref to track if courses have been loaded
  const coursesLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    const fetchCourses = async () => {
      // Skip fetching if courses are already loaded
      if (coursesLoadedRef.current) {
        console.log('Courses: Using cached courses data');
        return;
      }
      
      try {
        setLoading(true);
        const service = CourseService.getInstance();
        const authService = AuthService.getInstance();
        
        const role = await authService.getUserRole();
        setUserRole(role);
        console.log('Courses: User role', role);
        
        // Get current user
        const currentUser = authService.getCurrentUser();
        console.log('Courses: Current user', currentUser?.uid);
        
        if (currentUser) {
          // Get user's enrolled courses
          const enrolledCourseRefs = await authService.getUserEnrolledCourses();
          console.log('Courses: Enrolled course refs', enrolledCourseRefs);
          setEnrolledCourseIds(enrolledCourseRefs);
          
          if (role === 'admin') {
            // Admins can see all courses
            console.log('Courses: User is admin, fetching all courses');
            const response = await service.getCourses();
            console.log('Courses: All courses fetched', response.course.length);
            setCourses(response.course);
          } else {
            // Students can only see enrolled courses
            console.log('Courses: User is student, fetching enrolled courses');
            if (enrolledCourseRefs.length > 0) {
              // Fetch only the enrolled courses
              console.log('Courses: Found enrolled course refs, fetching courses');
              const enrolledCourses: Course[] = [];
              
              for (const courseId of enrolledCourseRefs) {
                console.log('Courses: Fetching course', courseId);
                const course = await service.getCourseById(courseId);
                console.log('Courses: Course data', course);
                if (course) {
                  enrolledCourses.push(course);
                }
              }
              
              console.log('Courses: Setting enrolled courses', enrolledCourses.length);
              setCourses(enrolledCourses);
            } else {
              console.log('Courses: No enrolled courses found');
              setCourses([]);
            }
          }
        } else {
          console.log('Courses: No current user');
          setCourses([]);
        }
        
        // Mark courses as loaded
        coursesLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to fetch courses:', error);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Helper function to check if a user is enrolled in a course
  const isEnrolled = (courseId: string) => {
    return enrolledCourseIds.includes(courseId);
  };

  // Deduplicate courses by name and year (course plan) - show only one course even if multiple sections exist
  const uniqueCourses = courses.reduce((acc: Course[], course) => {
    const courseName = course.name || course.Name || '';
    const courseYear = course.year || course.Year || '';
    const existingCourse = acc.find(c => 
      (c.name || c.Name || '') === courseName && 
      (c.year || c.Year || '') === courseYear
    );
    
    if (!existingCourse) {
      acc.push(course);
    }
    
    return acc;
  }, []);

  return (
    <div className="courses-container">
      {loading ? (
        <div className="loading-container">
          <p>Loading courses...</p>
        </div>
      ) : uniqueCourses.length > 0 ? (
        <div className="courses-grid">
          {uniqueCourses.map((course) => (
            <CourseCard
              key={course.Id}
              courseId={course.Id}
              name={course.name || course.Name || ''}
              description={course.description || course.Description || ''}
              section={course.section || course.Section || ''}
              year={course.year || course.Year || ''}
              createdBy={course.createdBy || course.CreatedBy || ''}
              isEnrolled={isEnrolled(course.Id)}
            />
          ))}
        </div>
      ) : (
        <div className="no-courses" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          minHeight: '60vh'
        }}>
          <img 
            src={confusedImage} 
            alt="Confused" 
            style={{
              width: '200px',
              height: 'auto',
              marginBottom: '1rem'
            }}
          />
          <p style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            marginTop: '1rem'
          }}>
            {userRole === 'student' ? 'You are not enrolled in any courses.' : 'No courses available.'}
          </p>
        </div>
      )}
    </div>
  );
};

import { getFirestore, collection, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { Course, CourseResponse } from '../types/course';

export class CourseService {
  private static instance: CourseService;
  private db = getFirestore();
  private coursesCollection = collection(this.db, 'courses');
  private cachedCourses: Course[] = [];
  private unsubscribe: () => void;

  private constructor() {
    // Set up listener for courses collection
    this.unsubscribe = onSnapshot(this.coursesCollection, (snapshot) => {
      this.cachedCourses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          Id: doc.id,
          name: data.name || '',
          Name: data.Name || data.name || '',
          description: data.description || '',
          Description: data.Description || data.description || '',
          createdBy: data.createdBy || '',
          CreatedBy: data.CreatedBy || data.createdBy || '',
          createdAt: data.createdAt,
          section: data.section || '',
          Section: data.Section || data.section || '',
          year: data.year || '',
          Year: data.Year || data.year || '',
          syllabus: data.syllabus || '',
          Syllabus: data.Syllabus || data.syllabus || '',
          subjects: data.subjects || data.Subjects || [],
          Subjects: data.Subjects || data.subjects || [],
          playlist: data.playlist || data.Playlist || '',
          Playlist: data.Playlist || data.playlist || '',
          fallPlaylist: data.fallPlaylist || data.FallPlaylist || '',
          FallPlaylist: data.FallPlaylist || data.fallPlaylist || '',
          springPlaylist: data.springPlaylist || data.SpringPlaylist || '',
          SpringPlaylist: data.SpringPlaylist || data.springPlaylist || '',
          attachments: data.attachments || data.Attachments || [],
          Attachments: data.Attachments || data.attachments || [],
          Enrollments: data.Enrollments || []
        };
      });
    });
  }

  static getInstance(): CourseService {
    if (!CourseService.instance) {
      CourseService.instance = new CourseService();
    }
    return CourseService.instance;
  }

  async getCourses(): Promise<CourseResponse> {
    // Return cached courses
    return { course: this.cachedCourses };
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    console.log('CourseService.getCourseById called with:', courseId);
    
    // First check the cache
    const cachedCourse = this.cachedCourses.find(course => course.Id === courseId);
    if (cachedCourse) {
      console.log('CourseService.getCourseById: Found course in cache', cachedCourse.name);
      return cachedCourse;
    }
    
    // If not in cache, fetch directly from Firestore
    try {
      console.log('CourseService.getCourseById: Not found in cache, fetching from Firestore');
      const courseDocRef = doc(this.db, 'courses', courseId);
      const courseDocSnap = await getDoc(courseDocRef);
      
      if (courseDocSnap.exists()) {
        const courseData = courseDocSnap.data();
        console.log('CourseService.getCourseById: Raw Firestore data:', courseData);
        
        // Create a course object with both lowercase and uppercase field names
        const course: Course = {
          Id: courseId,
          name: courseData.name || `Course ${courseId}`,
          Name: courseData.Name || courseData.name || `Course ${courseId}`,
          description: courseData.description || 'No description available',
          Description: courseData.Description || courseData.description || 'No description available',
          createdBy: courseData.createdBy || 'Unknown',
          CreatedBy: courseData.CreatedBy || courseData.createdBy || 'Unknown',
          createdAt: courseData.createdAt,
          section: courseData.section || '',
          Section: courseData.Section || courseData.section || '',
          year: courseData.year || '',
          Year: courseData.Year || courseData.year || '',
          syllabus: courseData.syllabus || '',
          Syllabus: courseData.Syllabus || courseData.syllabus || '',
          subjects: courseData.subjects || courseData.Subjects || [],
          Subjects: courseData.Subjects || courseData.subjects || [],
          playlist: courseData.playlist || courseData.Playlist || '',
          Playlist: courseData.Playlist || courseData.playlist || '',
          fallPlaylist: courseData.fallPlaylist || courseData.FallPlaylist || '',
          FallPlaylist: courseData.FallPlaylist || courseData.fallPlaylist || '',
          springPlaylist: courseData.springPlaylist || courseData.SpringPlaylist || '',
          SpringPlaylist: courseData.SpringPlaylist || courseData.springPlaylist || '',
          attachments: courseData.attachments || courseData.Attachments || [],
          Attachments: courseData.Attachments || courseData.attachments || [],
          Enrollments: courseData.Enrollments || []
        };
        
        console.log('CourseService.getCourseById: Mapped course object:', course);
        return course;
      }
      
      console.log('CourseService.getCourseById: Course not found in Firestore');
      return null;
    } catch (error) {
      console.error('Error in CourseService.getCourseById:', error);
      return null;
    }
  }

  // Cleanup method to unsubscribe from listeners
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  // Check if a student is enrolled in a course
  isStudentEnrolled(courseId: string, studentId: string): boolean {
    // Find the course in the cache
    const course = this.cachedCourses.find(c => c.Id === courseId);
    
    // If course not found or no enrollments, return false
    if (!course || !course.Enrollments) {
      return false;
    }
    
    // Check if the student is in the enrollments list
    return course.Enrollments.some(enrollment => 
      enrollment.EnrolleeId === studentId
    );
  }

  // Get course by name
  async getCourseByName(courseName: string): Promise<Course | null> {
    console.log('CourseService.getCourseByName called with:', courseName);
    
    // Check if the course name includes year information (e.g., "Prophetic Guidance - Year 2")
    const yearMatch = courseName.match(/Year (\d+)/i);
    const yearNumber = yearMatch ? yearMatch[1] : null;
    const baseName = courseName.replace(/\s*-?\s*Year \d+/i, '').trim();
    
    console.log(`Parsed course name: base="${baseName}", year=${yearNumber}`);
    
    // First check the cache with year-specific matching if applicable
    let cachedCourse = this.cachedCourses.find(course => {
      // If we have a year number, match both name and year
      if (yearNumber) {
        const nameMatches = course.name === baseName || course.Name === baseName;
        const yearMatches = course.year === yearNumber || course.Year === yearNumber;
        return nameMatches && yearMatches;
      } else {
        // Otherwise just match by the full name
        return course.name === courseName || course.Name === courseName;
      }
    });
    
    if (cachedCourse) {
      console.log('CourseService.getCourseByName: Found course in cache', cachedCourse.name);
      return cachedCourse;
    }
    
    // If not in cache, we need to query Firestore
    try {
      // Since we don't have a direct query by name, we'll have to fetch all courses
      // This is not ideal for performance but works for now
      const snapshot = await getDocs(this.coursesCollection);
      const courses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          Id: doc.id,
          name: data.name || '',
          Name: data.Name || data.name || '',
          description: data.description || '',
          Description: data.Description || data.description || '',
          createdBy: data.createdBy || '',
          CreatedBy: data.CreatedBy || data.createdBy || '',
          createdAt: data.createdAt,
          section: data.section || '',
          Section: data.Section || data.section || '',
          year: data.year || '',
          Year: data.Year || data.year || '',
          syllabus: data.syllabus || '',
          Syllabus: data.Syllabus || data.syllabus || '',
          subjects: data.subjects || data.Subjects || [],
          Subjects: data.Subjects || data.subjects || [],
          attachments: data.attachments || data.Attachments || [],
          Attachments: data.Attachments || data.attachments || [],
          Enrollments: data.Enrollments || []
        };
      });
      
      // Find course with year-specific matching if applicable
      const foundCourse = courses.find(course => {
        if (yearNumber) {
          const nameMatches = course.name === baseName || course.Name === baseName;
          const yearMatches = course.year === yearNumber || course.Year === yearNumber;
          return nameMatches && yearMatches;
        } else {
          return course.name === courseName || course.Name === courseName;
        }
      });
      
      return foundCourse || null;
    } catch (error) {
      console.error('Error in CourseService.getCourseByName:', error);
      return null;
    }
  }
}

import React, { useEffect, useState } from 'react';
import { Home } from './home/Home';
import { Courses } from './courses/Courses';
import { Assignments } from './assignments/Assignments';
import { Videos } from './videos/Videos';
import { CourseDetail } from './courses/CourseDetail';
import { AssignmentDetail } from './assignments/AssignmentDetail';
import { AttachmentViewer } from './courses/AttachmentViewer';
import { Programs } from './programs/Programs';
import { Scholarships } from './scholarships/Scholarships';
import { Students } from './admin/Students';
import QuizCreation from './admin/QuizCreation';
import { AuthService, UserRole } from '../services/auth';
import { usePage } from '../context/PageContext';

interface ContentProps {
  currentPage: string;
}

export const Content: React.FC<ContentProps> = ({ currentPage }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { quizCourseId } = usePage();

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const authService = AuthService.getInstance();
        const role = await authService.getUserRole();
        setUserRole(role);
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  const renderContent = () => {
    // Show loading state while fetching user role
    if (loading) {
      return (
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      );
    }

    switch (currentPage.toLowerCase()) {
      case 'courses':
        return <Courses />;
      case 'home':
        return <Home />;
      case 'assignments':
        return <Assignments />;
      case 'videos':
        return <Videos />;
      case 'coursedetail':
        return <CourseDetail />;
      case 'assignmentdetail':
        return <AssignmentDetail />;
      case 'attachment':
        return <AttachmentViewer />;
      case 'createquiz':
        // Only allow admin users to access the quiz creation page
        if (userRole === 'admin') {
          return <QuizCreation courseId={quizCourseId || undefined} />;
        } else {
          return (
            <div className="unauthorized-container">
              <h2>Unauthorized Access</h2>
              <p>You do not have permission to view this page.</p>
            </div>
          );
        }
      case 'programs':
        // Only allow admin users to access the programs page
        if (userRole === 'admin') {
          return <Programs />;
        } else {
          return (
            <div className="unauthorized-container">
              <h2>Unauthorized Access</h2>
              <p>You do not have permission to view this page.</p>
            </div>
          );
        }
      case 'financial aid':
        // Only allow admin users to access the scholarships page
        if (userRole === 'admin') {
          return <Scholarships />;
        } else {
          return (
            <div className="unauthorized-container">
              <h2>Unauthorized Access</h2>
              <p>You do not have permission to view this page.</p>
            </div>
          );
        }
      case 'students':
        // Only allow admin users to access the students page
        if (userRole === 'admin') {
          return <Students />;
        } else {
          return (
            <div className="unauthorized-container">
              <h2>Unauthorized Access</h2>
              <p>You do not have permission to view this page.</p>
            </div>
          );
        }
      case 'settings':
        return (
          <div>
            <h2>Settings</h2>
            <p>Settings panel will be available here.</p>
          </div>
        );
      default:
        return (
          <div>
            <h2>Page Not Found</h2>
            <p>We couldn't find the page you're looking for.</p>
          </div>
        );
    }
  };

  return <div className="content">{renderContent()}</div>;
};
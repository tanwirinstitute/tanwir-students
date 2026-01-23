import React, { useState, useMemo } from 'react';
import { CourseAttachment } from '../../services/courses/types/course';
import { usePage } from '../../context/PageContext';
import { AttachmentCard } from './AttachmentCard';
import './CourseAttachments.css';

interface CourseAttachmentsProps {
  attachments: CourseAttachment[];
  enrolledSemesters?: string[]; // 'fall', 'spring', or both
}

type SemesterTab = 'fall' | 'spring' | 'all';

export const CourseAttachments: React.FC<CourseAttachmentsProps> = ({ attachments, enrolledSemesters }) => {
  const { courseId } = usePage();
  const [activeTab, setActiveTab] = useState<SemesterTab>('spring');

  // Determine which tabs should be visible based on enrollment
  const visibleTabs = useMemo(() => {
    if (!enrolledSemesters || enrolledSemesters.length === 0) {
      // If no enrollment data, show all tabs (admin or default behavior)
      return ['fall', 'spring', 'all'] as SemesterTab[];
    }
    
    const tabs = [...enrolledSemesters] as SemesterTab[];
    if (!tabs.includes('all')) {
      tabs.push('all'); // Always show 'all' tab
    }
    return tabs;
  }, [enrolledSemesters]);

  // Set default active tab to first visible tab
  React.useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [visibleTabs, activeTab]);

  // Helper function to determine semester based on month
  const getSemester = (date: Date): 'fall' | 'spring' | 'other' => {
    const month = date.getMonth(); // 0-11
    
    // Fall: September (8) - December (11)
    if (month >= 8 && month <= 11) {
      return 'fall';
    }
    // Spring: January (0) - May (4)
    else if (month >= 0 && month <= 4) {
      return 'spring';
    }
    // Other months (Summer)
    else {
      return 'other';
    }
  };

  // Organize attachments by category
  const organizedAttachments = useMemo(() => {
    const fall: CourseAttachment[] = [];
    const spring: CourseAttachment[] = [];

    attachments.forEach(attachment => {
      if (attachment.uploadedAt) {
        const uploadDate = attachment.uploadedAt.toDate ? 
          attachment.uploadedAt.toDate() : 
          new Date(attachment.uploadedAt);

        // Categorize by semester
        const semester = getSemester(uploadDate);
        if (semester === 'fall') {
          fall.push(attachment);
        } else if (semester === 'spring') {
          spring.push(attachment);
        }
      }
    });

    // Sort each category by date (newest first)
    const sortByDate = (a: CourseAttachment, b: CourseAttachment) => {
      const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate() : new Date(a.uploadedAt);
      const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate() : new Date(b.uploadedAt);
      return dateB.getTime() - dateA.getTime();
    };

    const fallSorted = fall.sort(sortByDate);
    const springSorted = spring.sort(sortByDate);
    
    // Filter 'all' based on enrollment
    let allAttachments: CourseAttachment[] = [];
    if (!enrolledSemesters || enrolledSemesters.length === 0) {
      // Admin or no enrollment data - show all attachments
      allAttachments = [...attachments].sort(sortByDate);
    } else {
      // Student - only show attachments from enrolled semesters
      if (enrolledSemesters.includes('fall')) {
        allAttachments = [...allAttachments, ...fall];
      }
      if (enrolledSemesters.includes('spring')) {
        allAttachments = [...allAttachments, ...spring];
      }
      allAttachments = allAttachments.sort(sortByDate);
    }

    return {
      fall: fallSorted,
      spring: springSorted,
      all: allAttachments
    };
  }, [attachments, enrolledSemesters]);

  // Get current attachments based on active tab
  const currentAttachments = organizedAttachments[activeTab];

  if (!attachments || attachments.length === 0) {
    return <p className="empty">No attachments available for this course.</p>;
  }

  return (
    <div className="course-attachments">
      <div className="semester-tabs">
        {visibleTabs.includes('fall') && (
          <button
            className={`semester-tab ${activeTab === 'fall' ? 'active' : ''}`}
            onClick={() => setActiveTab('fall')}
          >
            Fall Semester
            {organizedAttachments.fall.length > 0 && (
              <span className="tab-count">{organizedAttachments.fall.length}</span>
            )}
          </button>
        )}
        {visibleTabs.includes('spring') && (
          <button
            className={`semester-tab ${activeTab === 'spring' ? 'active' : ''}`}
            onClick={() => setActiveTab('spring')}
          >
            Spring Semester
            {organizedAttachments.spring.length > 0 && (
              <span className="tab-count">{organizedAttachments.spring.length}</span>
            )}
          </button>
        )}
        {visibleTabs.includes('all') && (
          <button
            className={`semester-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
            <span className="tab-count">{organizedAttachments.all.length}</span>
          </button>
        )}
      </div>

      {currentAttachments.length > 0 ? (
        <div className="attachments-grid">
          {currentAttachments.map((attachment) => (
            <AttachmentCard 
              key={attachment.id}
              attachment={attachment}
              courseId={courseId}
            />
          ))}
        </div>
      ) : (
        <p className="empty">No attachments in this category.</p>
      )}
    </div>
  );
};

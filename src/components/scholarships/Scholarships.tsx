import React, { useEffect, useState } from 'react';
import { ScholarshipService, ScholarshipApplication } from '../../services/scholarships/scholarshipService';
import { ScholarshipDetail } from './ScholarshipDetail';
import '../../styles/scholarships.css';

const toDate = (value: any): Date | null => {
  if (!value) return null;
  let date: Date;
  if (typeof value?.toDate === 'function') date = value.toDate();
  else if (typeof value === 'object' && 'seconds' in value) date = new Date(value.seconds * 1000);
  else date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: any): string => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';
};

export const Scholarships: React.FC = () => {
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ScholarshipApplication | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const scholarshipService = ScholarshipService.getInstance();
        const data = await scholarshipService.getAllApplications();
        
        // Set default status to 'pending' if not specified
        const processedData = data.map(app => ({
          ...app,
          status: app.status || 'pending'
        }));
        
        setApplications(processedData);
        setError(null);
      } catch (err) {
        console.error('Error fetching scholarship applications:', err);
        setError('Failed to load scholarship applications. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  const handleSelectApplication = (application: ScholarshipApplication) => {
    setSelectedApplication(application);
  };

  const handleCloseDetail = () => {
    setSelectedApplication(null);
    // Refresh the list after closing detail view
    const scholarshipService = ScholarshipService.getInstance();
    scholarshipService.getAllApplications()
      .then(data => {
        const processedData = data.map(app => ({
          ...app,
          status: app.status || 'pending'
        }));
        setApplications(processedData);
      })
      .catch(err => {
        console.error('Error refreshing scholarship applications:', err);
      });
  };

  const filteredApplications = applications
    .filter(app => {
      if (filter === 'all') return true;
      return app.status === filter;
    })
    .sort((a, b) => {
      const aTime = toDate(a.submittedAt)?.getTime() ?? 0;
      const bTime = toDate(b.submittedAt)?.getTime() ?? 0;
      return bTime - aTime; // newest first
    });

  if (loading) {
    return (
      <div className="scholarships-container">
        <h2>Financial Aid Applications</h2>
        <div className="loading-spinner">Loading applications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scholarships-container">
        <h2>Financial Aid Applications</h2>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="scholarships-container">
      <h2>Financial Aid Applications</h2>
      
      {selectedApplication ? (
        <ScholarshipDetail 
          application={selectedApplication} 
          onClose={handleCloseDetail} 
        />
      ) : (
        <>
          <div className="filter-controls">
            <span>Filter by status:</span>
            <div className="filter-buttons">
              <button 
                className={filter === 'all' ? 'active' : ''} 
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={filter === 'pending' ? 'active' : ''} 
                onClick={() => setFilter('pending')}
              >
                Pending
              </button>
              <button 
                className={filter === 'approved' ? 'active' : ''} 
                onClick={() => setFilter('approved')}
              >
                Approved
              </button>
              <button 
                className={filter === 'denied' ? 'active' : ''} 
                onClick={() => setFilter('denied')}
              >
                Denied
              </button>
            </div>
          </div>

          {filteredApplications.length === 0 ? (
            <div className="no-applications">
              No {filter !== 'all' ? filter : ''} applications found.
            </div>
          ) : (
            <div className="applications-list">
              <div className="table-scroll-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Need</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => (
                      <tr key={app.id} className={`status-${app.status}`}>
                        <td>{app.firstName} {app.lastName}</td>
                        <td>{app.course}</td>
                        <td>{app.need}</td>
                        <td>{formatDate(app.submittedAt)}</td>
                        <td className={`status-text ${app.status || 'pending'}`}>
                          {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
                        </td>
                        <td>
                          <button 
                            className="view-button"
                            onClick={() => handleSelectApplication(app)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { ScholarshipApplication, ScholarshipService } from '../../services/scholarships/scholarshipService';
import { AuthService } from '../../services/auth';

interface ScholarshipDetailProps {
  application: ScholarshipApplication;
  onClose: () => void;
}

const formatTimestamp = (value: any): string | null => {
  if (!value) return null;
  let date: Date;
  if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (value && typeof value === 'object' && 'seconds' in value) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const ScholarshipDetail: React.FC<ScholarshipDetailProps> = ({ application, onClose }) => {
  const [comments, setComments] = useState(application.comments || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<string>(application.need || '25%');

  const handleApprove = async () => {
    await handleStatusUpdate('approved');
  };

  const handleDeny = async () => {
    await handleStatusUpdate('denied');
  };

  const handleStatusUpdate = async (status: 'approved' | 'denied') => {
    try {
      setIsSubmitting(true);
      setError(null);
      setEmailStatus(null);
      
      const authService = AuthService.getInstance();
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser) {
        setError('You must be logged in to perform this action.');
        return;
      }
      
      if (!application.id) {
        setError('Application ID is missing.');
        return;
      }
      
      const scholarshipService = ScholarshipService.getInstance();
      
      // Update application status
      await scholarshipService.updateApplicationStatus(
        application.id,
        status,
        currentUser.uid,
        comments,
        selectedNeed // Pass the selected need percentage
      );
      
      setSuccess(`Application has been ${status} successfully.`);
      setEmailStatus(`Decision email has been sent to ${application.email}.`);
      
      // Close the detail view after a short delay
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err) {
      console.error(`Error ${status} application:`, err);
      
      // Check for specific error about discount codes
      if (err instanceof Error && err.message.includes('discount codes')) {
        setError('Cannot approve application: No available discount codes found.');
        setEmailStatus('Please request more discount codes from the administrator before approving additional applications.');
      } else if (err instanceof Error && err.message.includes('email')) {
        setError(`Failed to ${status} application. Please try again.`);
        setEmailStatus(`Note: There was an issue sending the decision email. The status was updated, but the email may not have been delivered.`);
      } else {
        setError(`Failed to ${status} application. Please try again.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="scholarship-detail">
      <div className="detail-header">
        <h3>Application Details</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {emailStatus && <div className="info-message">{emailStatus}</div>}
      
      <div className="detail-content">
        <div className="detail-section">
          <h4>Personal Information</h4>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Name:</label>
              <span>{application.firstName} {application.lastName}</span>
            </div>
            <div className="detail-item">
              <label>Email:</label>
              <span>{application.email}</span>
            </div>
            <div className="detail-item">
              <label>Phone:</label>
              <span>{application.phone}</span>
            </div>
            <div className="detail-item">
              <label>Age:</label>
              <span>{application.age}</span>
            </div>
            <div className="detail-item">
              <label>Gender:</label>
              <span>{application.gender}</span>
            </div>
            <div className="detail-item">
              <label>Employment:</label>
              <span>{application.employment}</span>
            </div>
          </div>
        </div>
        
        <div className="detail-section">
          <h4>Application Details</h4>
          <div className="detail-grid">
            {formatTimestamp(application.submittedAt) && (
              <div className="detail-item">
                <label>Submitted:</label>
                <span>{formatTimestamp(application.submittedAt)}</span>
              </div>
            )}
            <div className="detail-item">
              <label>Course:</label>
              <span>{application.course}</span>
            </div>
            <div className="detail-item">
              <label>Form:</label>
              <span>{application.form}</span>
            </div>
            <div className="detail-item">
              <label>Interest:</label>
              <span>{application.interest}</span>
            </div>
            <div className="detail-item">
              <label>Need:</label>
              <span>{application.need}</span>
            </div>
            <div className="detail-item">
              <label>Reason:</label>
              <span>{application.reason}</span>
            </div>
            <div className="detail-item">
              <label>Zakat:</label>
              <span>{application.zakat}</span>
            </div>
            <div className="detail-item">
              <label>Status:</label>
              <span className={`status-${application.status || 'pending'}`}>
                {application.status || 'pending'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="detail-section">
          <h4>Zakat Consent</h4>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Consented to use of zakat funds for tuition:</label>
              <span className={application.consented ? 'status-approved' : 'status-denied'}>
                {application.consented ? 'Yes' : 'No'}
              </span>
            </div>
            {application.consented && formatTimestamp(application.consentedAt) && (
              <div className="detail-item">
                <label>Consented on:</label>
                <span>{formatTimestamp(application.consentedAt)}</span>
              </div>
            )}
            {formatTimestamp(application.consentEmailSentAt) && (
              <div className="detail-item">
                <label>Consent email sent:</label>
                <span>{formatTimestamp(application.consentEmailSentAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h4>Review</h4>
          <div className="comments-section">
            <label htmlFor="comments">Comments:</label>
            <textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add your comments here..."
              rows={4}
            />
          </div>
          
          <div className="need-selector">
            <label htmlFor="need">Need Percentage:</label>
            <select
              id="need"
              value={selectedNeed}
              onChange={(e) => setSelectedNeed(e.target.value)}
            >
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
            </select>
          </div>
          
          <div className="button-group">
            {application.status === 'pending' && (
              <>
                <button
                  className="approve-button"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Approve'}
                </button>
                <button
                  className="deny-button"
                  onClick={handleDeny}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Deny'}
                </button>
              </>
            )}
            <button 
              className="close-button-alt" 
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

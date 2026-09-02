import React, { useEffect, useMemo, useState } from 'react';
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

// An application is "active" while it still needs a decision: pending, and
// submitted within the last 2 months. Older pending applications are stale and
// drop out of the Active view.
const ACTIVE_WINDOW_MONTHS = 2;

const submittedWithinActiveWindow = (value: any): boolean => {
  const date = toDate(value);
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ACTIVE_WINDOW_MONTHS);
  return date.getTime() >= cutoff.getTime();
};

const isActive = (app: ScholarshipApplication): boolean =>
  (app.status || 'pending') === 'pending' && submittedWithinActiveWindow(app.submittedAt);

type Filter = 'active' | 'all' | 'pending' | 'approved' | 'denied';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
];

export const Scholarships: React.FC = () => {
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ScholarshipApplication | null>(null);
  const [filter, setFilter] = useState<Filter>('active');

  const [backfillDate, setBackfillDate] = useState('2026-09-01');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const loadApplications = async () => {
    const scholarshipService = ScholarshipService.getInstance();
    const data = await scholarshipService.getAllApplications();
    setApplications(data.map(app => ({ ...app, status: app.status || 'pending' })));
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadApplications();
        setError(null);
      } catch (err) {
        console.error('Error fetching scholarship applications:', err);
        setError('Failed to load scholarship applications. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectApplication = (application: ScholarshipApplication) => {
    setSelectedApplication(application);
  };

  const handleCloseDetail = () => {
    setSelectedApplication(null);
    loadApplications().catch(err => {
      console.error('Error refreshing scholarship applications:', err);
    });
  };

  // Pending records with no parseable submittedAt are invisible under the Active
  // filter, so surface them for a one-click fix.
  const undatedApplications = useMemo(
    () => applications.filter(app => (app.status || 'pending') === 'pending' && !toDate(app.submittedAt)),
    [applications],
  );

  const handleBackfillDates = async () => {
    const parsed = toDate(`${backfillDate}T12:00:00`);
    if (!parsed) {
      setBackfillMessage('Enter a valid date first.');
      return;
    }

    setBackfilling(true);
    setBackfillMessage(null);
    try {
      const scholarshipService = ScholarshipService.getInstance();
      const targets = undatedApplications.filter(app => app.id);
      await Promise.all(targets.map(app => scholarshipService.setSubmittedDate(app.id!, parsed)));
      await loadApplications();
      setBackfillMessage(
        `Set submitted date to ${parsed.toLocaleDateString('en-US', { dateStyle: 'medium' })} for ${targets.length} application(s).`,
      );
    } catch (err) {
      console.error('Error backfilling submitted dates:', err);
      setBackfillMessage('Failed to update some applications. Please try again.');
    } finally {
      setBackfilling(false);
    }
  };

  const filteredApplications = applications
    .filter(app => {
      if (filter === 'all') return true;
      if (filter === 'active') return isActive(app);
      return (app.status || 'pending') === filter;
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
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  className={filter === key ? 'active' : ''}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filter === 'active' && (
            <p className="filter-hint">
              Pending applications submitted in the last {ACTIVE_WINDOW_MONTHS} months.
            </p>
          )}

          {undatedApplications.length > 0 && (
            <div className="backfill-notice">
              <span>
                {undatedApplications.length} application(s) have no submitted date and won't appear under{' '}
                <strong>Active</strong>.
              </span>
              <span className="backfill-actions">
                <input
                  type="date"
                  value={backfillDate}
                  onChange={e => setBackfillDate(e.target.value)}
                  disabled={backfilling}
                />
                <button onClick={handleBackfillDates} disabled={backfilling}>
                  {backfilling ? 'Updating…' : `Set submitted date for ${undatedApplications.length}`}
                </button>
              </span>
              {backfillMessage && <span className="backfill-message">{backfillMessage}</span>}
            </div>
          )}

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
